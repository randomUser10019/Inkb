import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Glyph } from "@/components/player-glyph";
import { LazyWhiteboard } from "@/components/whiteboard-lazy";
import { SlideStrip } from "@/components/slide-strip";
import { PlannerPlayerChip } from "@/components/planner-chip";
import { SaveClassDialog } from "@/components/save-chapter";
import { StudyTray } from "@/components/study-tray";
import { NotesReader } from "@/components/notes-reader";
import { PlayerTransport } from "@/components/player-transport";
import { COPY } from "@inkboard/shared/copy";
import { writePrepared } from "@/lib/prepared-media";
import { boxStyle, formatTime } from "@/components/player-controls";
import type { PreparedMedia } from "@/lib/sprite-sheet";

export function PlayerView(p: Record<string, any>) {
  const {
    ClassPlayer, advanceLeft, audioUrl, backTo, barDrag, boardBox, box, breakNudge,
    bufPct, bufferTimer, buffering, camOff, canPlay, chapterQuery, chapterTrack,
    chaptersOpen, chromeHidden, clipBusy, clipHref, clipIn, clipNote, clipOut, courseId,
    courseQ, dragRef, duration, educator, ended, err,
    flashT, flashTimer, focus, fromCourse, fs, help,
    hinted, hlsUrl, holdEnd, holdPlace, hoverT, idleTimer, introSec,
    isBoard, jobId, jumpSlide, keepOpen, lastTap, lastTick, layout,
    listen, liveCourse, moreOpen, muted, nav, nextLesson, notesOpen,
    notesUrl, openLesson, pinRev, pins, placeVideo, playIndex, playedMs,
    playing, playlist, prefs, prevLesson, qc,
    ready, resolvedNotes, resumeAt, resumed, round, saved, saver,
    scrubbing, seek, seekLock, seekLockAt, seekingUi, setAdvanceLeft, setAudioUrl, setBoardBox,
    setBox, setBreakNudge, setBufPct, setBuffering, setCamOff, setCanPlay, setChapterQuery, setChapterTrack,
    setChaptersOpen, setChromeHidden, setClipBusy, setClipHref, setClipIn, setClipNote, setClipOut, setDuration,
    setEnded, setErr, setFlashT, setFs, setHelp, setHlsUrl, setHoverT, setJobId,
    setKeepOpen, setLayout, setListen, setMoreOpen, setMuted, setNotesOpen, setPinRev, setPlaying,
    setReady, setResolvedNotes, setSaved, setSaver, setScrubbing, setSeekingUi, setSheet, setSilence,
    setSilenceOn, setSleepLeft, setSleepUntil, setSpeed, setStripOn, setSummary, setSummaryBusy, setSummaryNote,
    setTime, setVolume, setWaveform, sheet, silence, silenceOn, silenceOnRef, silenceRef,
    sleepLeft, sleepUntil, slide, slideCount, speed, sprites, stageRef, startAt, stripOn, summary, summaryBusy, summaryNote, tapTimer, teacherSlug,
    time, timeMs, timeline, title, toggleFs, userBoxRef, videoRef, volume, wantPlay, waveform, wrapRef, stampNow, onPointerDown,
    onPointerMove, onPointerUp, onBarPointer, hideChrome, shownTime, barMax, layers, glyph,
    showBuffer, clockLabel, previewing, pipW, pipH, focusRun, replayClass, stayOnClass,
    retryClass, chapters, studyMarks, chapterList, revisionNotes, runSummary, saveClip, directSrc,
    videoEl, lineUnder,
  } = p;
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
        hideChrome={hideChrome}
        hoverT={hoverT}
        scrubbing={scrubbing}
        onBarPointer={onBarPointer}
        layers={layers}
        sheet={sheet}
        timeline={timeline}
        waveform={waveform}
        setWaveform={setWaveform}
        barMax={barMax}
        chapters={chapters}
        seek={seek}
        clockLabel={clockLabel}
        shownTime={shownTime}
        bufPct={bufPct}
        duration={duration}
        previewing={previewing}
        videoRef={videoRef}
        playing={playing}
        setPlaying={setPlaying}
        wantPlay={wantPlay}
        glyph={glyph}
        speed={speed}
        setSpeed={setSpeed}
        muted={muted}
        setMuted={setMuted}
        volume={volume}
        setVolume={setVolume}
        fs={fs}
        toggleFs={toggleFs}
        audioUrl={audioUrl}
        listen={listen}
        setListen={setListen}
        holdPlace={holdPlace}
        hlsUrl={hlsUrl}
        saver={saver}
        setSaver={setSaver}
        stampNow={stampNow}
        resolvedNotes={resolvedNotes}
        setNotesOpen={setNotesOpen}
        saved={saved}
        setSaved={setSaved}
        title={title}
        teacherSlug={teacherSlug}
        courseId={courseId}
        moreOpen={moreOpen}
        setMoreOpen={setMoreOpen}
        camOff={camOff}
        setCamOff={setCamOff}
        layout={layout}
        setLayout={setLayout}
        isBoard={isBoard}
        stripOn={stripOn}
        setStripOn={setStripOn}
        sleepUntil={sleepUntil}
        setSleepUntil={setSleepUntil}
        prevLesson={prevLesson ?? null}
        nextLesson={nextLesson ?? null}
        openLesson={openLesson}
        setKeepOpen={setKeepOpen}
        setChaptersOpen={setChaptersOpen}
        runSummary={runSummary}
        silenceOn={silenceOn}
        setSilenceOn={setSilenceOn}
        silence={silence}
        clipIn={clipIn}
        clipOut={clipOut}
        clipBusy={clipBusy}
        clipHref={clipHref}
        clipNote={clipNote}
        setClipIn={setClipIn}
        setClipOut={setClipOut}
        setClipHref={setClipHref}
        setClipNote={setClipNote}
        saveClip={saveClip}
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

