import { usePlayerModel } from "@/components/player/use-player-model.tsx";
import { useClassCore } from "@/components/player/use-class-core";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePlayback } from "@/components/player/use-playback";
import { PlayerTransport } from "@/components/player-transport";
export { PlayerMore } from "@/components/player-more";
export const DOUBLE_TAP_MS = 250;
import { LazyWhiteboard } from "@/components/whiteboard-lazy";
import { Glyph } from "@/components/player-glyph";
import { SlideStrip } from "@/components/slide-strip";
import { notesHref } from "@inkboard/shared/notes";
import { isBoardClass, firstInkSec, slideAt, type Timeline } from "@inkboard/shared/dcn";
import { loadLessonTimeline, resolveLessonNotes } from "@/lib/lesson-api";
import { readPlayerPrefs, writePlayerPrefs } from "@inkboard/shared/player-prefs";
import { isLater, toggleLater } from "@inkboard/shared/library";
import { loadCourseDetail, type UaLesson } from "@/lib/unacademy";
import { peekProgress, saveProgress } from "@inkboard/shared/watch-history";
import { completeLessonInPlan } from "@inkboard/shared/planner/storage";
import { PLAYER_HELP_MS, PLAYER_IDLE_MS } from "@inkboard/shared/hand";
import { COPY } from "@inkboard/shared/copy";
import { usePlayerSession } from "@/components/player/use-player-session";
import { SeekHover } from "@/components/seek-hover";
import { readPrepared, writePrepared } from "@/lib/prepared-media";
import { getExam } from "@inkboard/shared/exams";
import { readExamId } from "@inkboard/shared/exam-pref";
import {
  assignMediaTime,
  clampBox,
  clampSeek,
  cycleSpeed,
  formatSpeed,
  formatTime,
  jumpSlideTime,
  layoutSlate,
  mediaDuration,
  nextSlideUid,
  playerHotkey,
  rebatePins,
  seekBarIntent,
  seekBarLayers,
  showSeekSpinner,
  SLEEP_MINUTES,
  stepSpeed,
  boxStyle,
  timeFromClientX,
  keepPlayingAfterSeek,
  playGlyph,
  followMediaClock,
  SEEK_HOLD_MS,
  bufferedPct,
  type Box,
} from "@/components/player-controls";
import { PlannerPlayerChip } from "@/components/planner-chip";
import { addBookmark, bookmarksFor } from "@inkboard/shared/planner/bookmarks";
import { focusProgress, readFocusRun, shouldNudgeBreak } from "@inkboard/shared/planner/focus";
import { SaveClassDialog } from "@/components/save-chapter";
import { StudyTray } from "@/components/study-tray";
import { NotesReader } from "@/components/notes-reader";
import { apiJson } from "@/lib/api-client";
import type { PreparedMedia, SpriteSheet } from "@/lib/sprite-sheet";
import { boardChapters, chapterHits, chaptersToVtt, skipSilenceTo, type SilenceRange } from "@/lib/study";

type VideoLayout = "pip" | "side";

export function ClassPlayer({
  timeline,
  title,
  educator,
  teacherSlug,
  courseId,
  fromCourse,
  backTo,
  notesUrl,
  startAt,
  focus,
  sprites,
}: {
  timeline: Timeline;
  title: string;
  educator?: string;
  teacherSlug?: string;
  courseId?: string;
  fromCourse?: string;
  backTo?: string;
  notesUrl?: string | null;
  startAt?: number;
  focus?: boolean;
  sprites?: SpriteSheet | null;
}) {
  const core = useClassCore({
    timeline, title, educator, teacherSlug, courseId, fromCourse, backTo, notesUrl, startAt, focus, sprites,
  });
  const {
    videoRef, wrapRef, stageRef, dragRef, userBoxRef, setLayout, camOff, setCamOff, box, setBox, boardBox, setBoardBox,
    setSideStrip, setCanPlay, stripOn, setStripOn, layout, fs, playing, setPlaying, breakNudge, setBreakNudge,
    playedMs, lastTick, setEnded, setErr, tapTimer, resolvedNotes, setMoreOpen, setKeepOpen,
    seek, toggleFs, jumpSlide, time, duration, listen, audioUrl, hoverT, sheet,
    nav, sleepUntil, setSleepUntil, sleepLeft, help, isBoard, timeMs, ended, canPlay, err,
    wantPlay, round, nextLesson, holdEnd, openLesson, advanceLeft, slide, pins,
    chaptersOpen, chapterQuery, setChapterQuery, setChaptersOpen, summaryBusy, summary, summaryNote,
    keepOpen, setSheet, setAudioUrl, setHlsUrl, setSilence, setWaveform, setJobId, notesOpen, setNotesOpen,
  } = core;
  void tapTimer;

  const placeVideo = useCallback(
    (next: "pip" | "side") => {
      if (!core.isBoard) return;
      const stageEl = stageRef.current;
      if (!stageEl) return;
      const width = stageEl.clientWidth;
      const height = stageEl.clientHeight;
      if (width < 8 || height < 8) return;
      const pocket = width < 640;
      const nextLayout = pocket ? "pip" : next;
      if (pocket && next === "side") setLayout("pip");
      const laid = layoutSlate(
        { width, height },
        { camOff, pocket, pip: nextLayout === "pip", filmOn: stripOn },
      );
      setSideStrip(laid.sideStrip);
      setBoardBox((prev) =>
        prev.x === laid.board.x && prev.y === laid.board.y && prev.w === laid.board.w && prev.h === laid.board.h
          ? prev
          : laid.board,
      );
      if (!userBoxRef.current) setBox(laid.lantern);
    },
    [core.isBoard, camOff, stripOn, setBoardBox, setBox, setLayout, setSideStrip, stageRef, userBoxRef],
  );

  useEffect(() => {
    userBoxRef.current = false;
    placeVideo(layout);
  }, [layout, placeVideo, fs, userBoxRef]);

  useEffect(() => {
    const probe = document.createElement("video");
    setCanPlay(probe.canPlayType("video/webm") !== "");
  }, [timeline.videoUrl, setCanPlay]);

  useEffect(() => {
    const el = stageRef.current;
    const onWinResize = () => placeVideo(layout);
    if (!el || typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", onWinResize);
      return () => window.removeEventListener("resize", onWinResize);
    }
    const ro = new ResizeObserver(() => {
      if (!userBoxRef.current) {
        placeVideo(layout);
        return;
      }
      setBox((b) => clampBox(b, { width: el.clientWidth, height: el.clientHeight }, round));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [layout, placeVideo, setBox, stageRef, userBoxRef]);

  useEffect(() => {
    if (!playing) {
      lastTick.current = null;
      return;
    }
    const id = window.setInterval(() => {
      if (document.hidden) return;
      const now = performance.now();
      if (lastTick.current != null) playedMs.current += now - lastTick.current;
      lastTick.current = now;
      if (shouldNudgeBreak(playedMs.current, breakNudge)) setBreakNudge(true);
    }, 1000);
    return () => window.clearInterval(id);
  }, [playing, breakNudge, lastTick, playedMs, setBreakNudge]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onEnded = () => {
      setEnded(true);
      setPlaying(false);
      completeLessonInPlan(timeline.id, "auto");
    };
    v.addEventListener("ended", onEnded);
    return () => v.removeEventListener("ended", onEnded);
  }, [timeline.id, timeline.videoUrl, setEnded, setPlaying, videoRef]);

  function retryClass() {
    const v = videoRef.current;
    setErr("");
    setEnded(false);
    if (!v) return;
    v.load();
    void v.play().catch(() => setErr(COPY.slateSlipped));
  }

  function onKeepClass() {
    setMoreOpen(false);
    setKeepOpen(true);
  }

  const playerModel = usePlayerModel({ ...core, placeVideo, ClassPlayer });
  const {
    stampNow, onPointerDown, onPointerMove, onPointerUp, onBarPointer, hideChrome, shownTime, barMax,
    layers, glyph, showBuffer, clockLabel, previewing, pipW, pipH, focusRun,
    replayClass, stayOnClass, chapters, studyMarks, chapterList, revisionNotes, runSummary,
    saveClip, directSrc, videoEl, lineUnder,
  } = playerModel;
  const playbackSrc = listen && audioUrl ? audioUrl : directSrc;


  return (
    <div ref={wrapRef} className="slate">
      {focus && focusRun ? (
        <div className="slate-inscribe" style={{ minHeight: "2.25rem", paddingBlock: "0.25rem" }}>
          <span className="text-caption tabular text-muted">
            {focusRun.index}/{focusRun.total || 1}
          </span>
          <span className="ml-auto h-px flex-1 bg-line" aria-hidden="true" />
          <button
            type="button"
            className="rail-btn"
            aria-label="Back to today’s board"
            title="Back to today’s board"
            onClick={() => void nav({ to: "/planner/today", search: { add: undefined } })}
          >
            <Glyph label="Leave">
              <path d="M14 6h5v12h-5" />
              <path d="M14 12H5" />
              <path d="M8 8l-4 4 4 4" />
            </Glyph>
          </button>
        </div>
      ) : null}

      <div className={`slate-inscribe${hideChrome ? " is-idle" : ""}`}>
        <Link to={backTo ?? "/"} className="rail-btn" aria-label={COPY.backToTheWall} title={COPY.backToTheWall}>
          <Glyph label="Back">
            <path d="M15 6 9 12l6 6" />
          </Glyph>
        </Link>
        <div className="min-w-0 flex-1">
          <p className="slate-title truncate">{title}</p>
          {lineUnder ? (
            breakNudge ? (
              <button
                type="button"
                className="slate-nudge"
                onClick={() => {
                  setBreakNudge(false);
                  playedMs.current = 0;
                }}
              >
                {COPY.fortyStand}
              </button>
            ) : sleepUntil ? (
              <button type="button" className="slate-nudge tabular" onClick={() => setSleepUntil(null)}>
                {formatTime(sleepLeft)}
              </button>
            ) : (
              <p className={`slate-nudge${help ? " is-keys" : ""}`}>{lineUnder}</p>
            )
          ) : null}
        </div>
        {isBoard && timeline.slides.some((s: { url?: string }) => s.url) ? (
          <button
            type="button"
            className="rail-btn"
            onClick={() => setStripOn((on: boolean) => !on)}
            aria-label={stripOn ? COPY.hideSlides : COPY.showSlides}
            title={stripOn ? COPY.hideSlides : COPY.showSlides}
            aria-pressed={stripOn}
          >
            <Glyph label={stripOn ? COPY.hideSlides : COPY.showSlides}>
              <path d="M4 7h16v10H4z" />
              <path d="M4 17h3M9 17h3M14 17h3M19 17h1" />
            </Glyph>
            <span className="hidden text-caption sm:inline">{stripOn ? COPY.hideSlides : COPY.showSlides}</span>
          </button>
        ) : null}
        {isBoard ? (
          <button
            type="button"
            className="rail-btn"
            onClick={() => setCamOff((on: boolean) => !on)}
            aria-label={camOff ? COPY.showCamera : COPY.hideCamera}
            title={camOff ? COPY.showCamera : COPY.hideCamera}
            aria-pressed={!camOff}
          >
            <Glyph label={camOff ? COPY.showCamera : COPY.hideCamera}>
              {camOff ? (
                <>
                  <circle cx="12" cy="12" r="3.5" />
                  <path d="M4 12h2M18 12h2M12 4v2M12 18v2" />
                </>
              ) : (
                <>
                  <circle cx="12" cy="12" r="3.5" />
                  <path d="M4 12s2.5-5 8-5 8 5 8 5-2.5 5-8 5-8-5-8-5z" />
                </>
              )}
            </Glyph>
            <span className="hidden text-caption sm:inline">{camOff ? COPY.showCamera : COPY.hideCamera}</span>
          </button>
        ) : null}
      </div>

      <PlannerPlayerChip lessonId={timeline.id} watchedSec={time} durationSec={duration} focus={focus} />

      <div
        ref={stageRef}
        className="slate-stage"
        onDoubleClick={(e) => {
          if ((e.target as HTMLElement).closest(".lantern")) return;
          toggleFs();
        }}
      >
        {isBoard ? (
          <section
            className="slate-field"
            style={boardBox.w ? boxStyle(boardBox) : { visibility: "hidden" }}
          >
            <LazyWhiteboard timeline={timeline} videoRef={videoRef} clockMs={timeMs} />
          </section>
        ) : (
          <section className="slate-field" style={{ inset: 8 }}>
            {videoEl}
          </section>
        )}

        {showBuffer ? <span className="slate-buffer" aria-hidden="true" /> : null}
        {listen && !isBoard ? <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted">Audio</p> : null}

        {!isBoard && !playing && !ended && canPlay && !err ? (
          <button
            type="button"
            className="slate-play"
            aria-label="Play"
            onClick={() => {
              const v = videoRef.current;
              if (!v) return;
              wantPlay.current = true;
              void v.play().then(() => setPlaying(true)).catch(() => {
                wantPlay.current = false;
                setPlaying(false);
              });
            }}
          >
            <Glyph label="Play">
              <path d="M8 6v12l11-6Z" />
            </Glyph>
          </button>
        ) : null}

        {isBoard ? (
          <section
            className={`lantern${listen ? "" : camOff ? " is-off" : round ? "" : " is-docked"}`}
            style={
              camOff || listen || box.w <= 1
                ? { position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none", left: 0, top: 0 }
                : boxStyle({ x: box.x, y: box.y, w: pipW, h: round ? pipW : pipH })
            }
            onPointerMove={camOff ? undefined : onPointerMove}
            onPointerUp={camOff ? undefined : onPointerUp}
            onPointerCancel={camOff ? undefined : onPointerUp}
          >
            {round && !camOff ? (
              <div
                className="absolute inset-0 z-10 cursor-grab touch-none active:cursor-grabbing"
                onPointerDown={(e) => onPointerDown(e, "move")}
                aria-label="Move the lantern"
              />
            ) : null}
            <div className="lantern-face">{videoEl}</div>
            {round && !camOff ? (
              <button
                type="button"
                aria-label="Resize the lantern"
                className="lantern-resize"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onPointerDown(e, "resize");
                }}
              />
            ) : null}
          </section>
        ) : null}

        {err ? (
          <p className="slate-err">
            {err}{" "}
            <button type="button" className="ink-underline" onClick={retryClass}>
              {COPY.tryAgain}
            </button>
          </p>
        ) : null}
        {!canPlay ? (
          <p className="slate-err">
            {COPY.cantPlayClass}
            {resolvedNotes ? (
              <>
                {" "}
                <a href={resolvedNotes} className="ink-underline" target="_blank" rel="noreferrer">
                  {COPY.notes}
                </a>
              </>
            ) : null}
          </p>
        ) : null}
        {ended ? (
          <div className="slate-end" role="status">
            <p className="font-serif text-h3">{title}</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-4">
              {nextLesson ? (
                <button
                  type="button"
                  className="ink-underline text-sm"
                  onClick={() => {
                    holdEnd.current = true;
                    openLesson(nextLesson);
                  }}
                >
                  {COPY.nextClass}
                  {advanceLeft ? ` · ${advanceLeft}` : ""}
                </button>
              ) : null}
              <button type="button" className="ink-underline text-sm" onClick={replayClass}>
                {COPY.replay}
              </button>
            </div>
            {nextLesson && advanceLeft > 0 ? (
              <button type="button" className="mt-3 text-caption text-muted" onClick={stayOnClass}>
                {COPY.stay}
              </button>
            ) : null}
          </div>
        ) : null}

        {isBoard && stripOn && timeline.slides.some((s: { url?: string }) => s.url) ? (
          <div className="slate-film is-side">
            <SlideStrip vertical slides={timeline.slides} currentUid={slide.uid} onJump={jumpSlide} pins={pins} />
          </div>
        ) : null}
      </div>

      {chaptersOpen ? (
        <StudyTray
          title={title}
          query={chapterQuery}
          onQuery={setChapterQuery}
          chapters={chapterList}
          onSeek={(t) => seek(t, true)}
          onClose={() => setChaptersOpen(false)}
          notes={revisionNotes()}
          summaryBusy={summaryBusy}
          onSummarize={() => void runSummary()}
          summary={summary}
          summaryNote={summaryNote}
        />
      ) : null}

      <PlayerTransport
        {...playerModel}
        prevLesson={playerModel.prevLesson ?? null}
        nextLesson={playerModel.nextLesson ?? null}
        slideUrl={sheet ? null : slideAt(timeline, (hoverT ?? 0) * 1000).url}
        listenLabel={COPY.listen}
        dataSaverLabel={COPY.dataSaver}
        audioSrc={playbackSrc}
      />
      {keepOpen ? (
        <SaveClassDialog
          lessonId={timeline.id}
          title={title}
          onClose={() => setKeepOpen(false)}
          onPrepared={(pack: PreparedMedia) => {
            if (pack.sprites) setSheet(pack.sprites);
            if (pack.audioUrl) setAudioUrl(pack.audioUrl);
            if (pack.hlsUrl) setHlsUrl(pack.hlsUrl);
            if (pack.silence) setSilence(pack.silence);
            if (pack.waveformUrl) setWaveform(pack.waveformUrl);
            if (pack.jobId) setJobId(pack.jobId);
            writePrepared(timeline.id, pack);
          }}
        />
      ) : null}
      {notesOpen && resolvedNotes ? (
        <NotesReader url={resolvedNotes} title={title} onClose={() => setNotesOpen(false)} />
      ) : null}
    </div>
  );
}

