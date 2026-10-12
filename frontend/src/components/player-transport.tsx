import { type CSSProperties, type Dispatch, type PointerEvent, type RefObject, type SetStateAction } from "react";
import { Glyph } from "@/components/player-glyph";
import { SeekHover } from "@/components/seek-hover";
import { PlayerMore } from "@/components/player-more";
import { slideAt, type Timeline } from "@inkboard/shared/dcn";
import { toggleLater } from "@inkboard/shared/library";
import { COPY } from "@inkboard/shared/copy";
import {
  cycleSpeed,
  formatSpeed,
  formatTime,
  SLEEP_MINUTES,
  tipLeft,
} from "@/components/player-controls";
import type { SpriteSheet } from "@/lib/sprite-sheet";
import type { SilenceRange } from "@/lib/study";
import { togglePictureInPicture } from "@/components/player/engine";
import type { UaLesson } from "@/lib/unacademy";

type Chapter = { uid: string; t: number; label: string };
type Layers = { hoverPct: number | null; fillPct: number };

export type PlayerTransportProps = {
  hideChrome: boolean;
  hoverT: number | null;
  scrubbing: boolean;
  onBarPointer: (phase: "move" | "down" | "up" | "leave", e: PointerEvent<HTMLElement>) => void;
  layers: Layers;
  sheet: SpriteSheet | null;
  timeline: Timeline;
  waveform: string | null;
  setWaveform: (v: string | null) => void;
  barMax: number;
  chapters: Chapter[];
  seek: (t: number, keep?: boolean) => void;
  clockLabel: number;
  shownTime: number;
  bufPct: number;
  duration: number;
  previewing: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
  playing: boolean;
  setPlaying: (v: boolean) => void;
  wantPlay: RefObject<boolean>;
  glyph: string;
  speed: number;
  setSpeed: Dispatch<SetStateAction<number>>;
  muted: boolean;
  setMuted: (v: boolean) => void;
  volume: number;
  setVolume: (v: number) => void;
  fs: boolean;
  toggleFs: () => void;
  audioUrl: string | null;
  listen: boolean;
  setListen: Dispatch<SetStateAction<boolean>>;
  holdPlace: () => void;
  hlsUrl: string | null;
  saver: boolean;
  setSaver: Dispatch<SetStateAction<boolean>>;
  stampNow: () => void;
  resolvedNotes: string;
  setNotesOpen: (v: boolean) => void;
  saved: boolean;
  setSaved: (v: boolean) => void;
  title: string;
  teacherSlug?: string;
  courseId?: string;
  moreOpen: boolean;
  setMoreOpen: (v: boolean) => void;
  camOff: boolean;
  setCamOff: Dispatch<SetStateAction<boolean>>;
  layout: "pip" | "side";
  setLayout: Dispatch<SetStateAction<"pip" | "side">>;
  isBoard: boolean;
  stripOn: boolean;
  setStripOn: Dispatch<SetStateAction<boolean>>;
  sleepUntil: number | null;
  setSleepUntil: Dispatch<SetStateAction<number | null>>;
  prevLesson: UaLesson | null;
  nextLesson: UaLesson | null;
  openLesson: (lesson: UaLesson) => void;
  setKeepOpen: (v: boolean) => void;
  setChaptersOpen: Dispatch<SetStateAction<boolean>>;
  runSummary: () => void;
  silenceOn: boolean;
  setSilenceOn: Dispatch<SetStateAction<boolean>>;
  silence: SilenceRange[];
  clipIn: number | null;
  clipOut: number | null;
  clipBusy: boolean;
  clipHref: string;
  clipNote: string;
  setClipIn: (v: number | null) => void;
  setClipOut: (v: number | null) => void;
  setClipHref: (v: string) => void;
  setClipNote: (v: string) => void;
  saveClip: () => void;
  slideUrl?: string | null;
  listenLabel?: string;
  dataSaverLabel?: string;
  audioSrc?: string;
};

export function PlayerTransport(props: PlayerTransportProps) {
  const {
    hideChrome, hoverT, scrubbing, onBarPointer, layers, sheet, timeline, waveform, setWaveform,
    barMax, chapters, seek, clockLabel, shownTime, bufPct, duration, previewing, videoRef, playing, setPlaying,
    wantPlay, glyph, speed, setSpeed, muted, setMuted, volume, setVolume, fs, toggleFs, audioUrl,
    listen, setListen, holdPlace, hlsUrl, saver, setSaver, stampNow, resolvedNotes, setNotesOpen,
    saved, setSaved, title, teacherSlug, courseId, moreOpen, setMoreOpen, camOff, setCamOff, layout,
    setLayout, isBoard, stripOn, setStripOn, sleepUntil, setSleepUntil, prevLesson, nextLesson,
    openLesson, setKeepOpen, setChaptersOpen, runSummary, silenceOn, setSilenceOn, silence, clipIn,
    clipOut, clipBusy, clipHref, clipNote, setClipIn, setClipOut, setClipHref, setClipNote, saveClip,
    slideUrl, listenLabel = COPY.listen, dataSaverLabel = COPY.dataSaver, audioSrc,
  } = props;
  return (
      <div className={`chalk-rail-wrap${hideChrome ? " is-idle" : ""}`}>
        <div
          className={`rail-seek-hit${hoverT != null || scrubbing ? " is-hot" : ""}`}
          onPointerDown={(e) => onBarPointer("down", e)}
          onPointerMove={(e) => onBarPointer("move", e)}
          onPointerUp={(e) => onBarPointer("up", e)}
          onPointerCancel={(e) => onBarPointer("leave", e)}
          onPointerLeave={(e) => onBarPointer("leave", e)}
        >
          {layers.hoverPct != null && hoverT != null ? (
            <SeekHover
              pct={layers.hoverPct}
              label={formatTime(hoverT)}
              time={hoverT}
              sheet={sheet}
              slideUrl={slideUrl !== undefined ? slideUrl : sheet ? null : slideAt(timeline, hoverT * 1000).url}
            />
          ) : null}
          {layers.hoverPct != null ? (
            <span className="rail-seek-ghost" style={{ left: tipLeft(layers.hoverPct) }} aria-hidden="true" />
          ) : null}
          {waveform ? (
            <img src={waveform} alt="" className="rail-wave" onError={() => setWaveform(null)} />
          ) : null}
          <span className="rail-seek-head" style={{ left: tipLeft(layers.fillPct) }} aria-hidden="true" />
          {barMax > 0
            ? chapters.map((ch) => (
                <button
                  key={`${ch.uid}-${Math.round(ch.t * 10)}`}
                  type="button"
                  className="rail-chapter"
                  style={{ left: `${Math.min(100, (ch.t / barMax) * 100)}%` }}
                  title={`${ch.label} · ${formatTime(ch.t)}`}
                  aria-label={`${ch.label} ${formatTime(ch.t)}`}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    seek(ch.t, true);
                  }}
                />
              ))
            : null}
          <input
            type="range"
            min={0}
            max={barMax}
            step={0.1}
            value={Math.min(scrubbing && hoverT != null ? hoverT : shownTime, barMax)}
            aria-label="Seek"
            aria-valuetext={formatTime(clockLabel)}
            tabIndex={-1}
            onChange={() => {}}
            className="rail-seek"
            style={
              {
                ["--seek"]: `${layers.fillPct}%`,
                ["--buf"]: `${Math.max(bufPct, layers.fillPct)}%`,
              } as CSSProperties
            }
          />
        </div>
        <div className="chalk-rail flex flex-wrap items-center gap-1">
          <button
            type="button"
            className="rail-btn is-play inline-flex min-h-11 min-w-11 items-center justify-center"
            onClick={() => {
              const v = videoRef.current;
              if (!v) return;
              if (v.paused || !playing) {
                wantPlay.current = true;
                setPlaying(true);
                void v.play().catch(() => {
                  wantPlay.current = false;
                  setPlaying(false);
                });
              } else {
                wantPlay.current = false;
                v.pause();
                setPlaying(false);
              }
            }}
            aria-label={glyph === "pause" ? "Pause" : "Play"}
            title={glyph === "pause" ? "Pause" : "Play"}
          >
            {glyph === "pause" ? (
              <Glyph label="Pause">
                <path d="M8 6v12M16 6v12" />
              </Glyph>
            ) : (
              <Glyph label="Play">
                <path d="M8 6v12l11-6Z" />
              </Glyph>
            )}
          </button>
          <button type="button" className="rail-btn inline-flex min-h-11 min-w-11 items-center justify-center" onClick={() => seek(shownTime - 10, true)} aria-label="Back 10s" title="Back 10s">
            <Glyph label="Back">
              <path d="M11 7 6 12l5 5" />
              <path d="M18 7 13 12l5 5" />
            </Glyph>
          </button>
          <button
            type="button"
            className="rail-btn inline-flex min-h-11 min-w-11 items-center justify-center"
            onClick={() => seek(shownTime + 10, true)}
            aria-label="Forward 10s"
            title="Forward 10s"
          >
            <Glyph label="Forward">
              <path d="m6 7 5 5-5 5" />
              <path d="m13 7 5 5-5 5" />
            </Glyph>
          </button>
          <span className={`rail-time tabular${previewing ? " is-preview" : ""}`} aria-live="polite">
            {formatTime(clockLabel)} / {formatTime(duration)}
          </span>
          <span className="rail-keys" title={COPY.shortcuts}>
            {COPY.keysHint}
          </span>
          <button
            type="button"
            className="rail-btn tabular is-on inline-flex min-h-11 min-w-11 items-center justify-center"
            onClick={() => setSpeed((s) => cycleSpeed(s))}
            aria-label={`Speed ${formatSpeed(speed)}×`}
            title={`Speed ${formatSpeed(speed)}×`}
          >
            {formatSpeed(speed)}×
          </button>
          <button
            type="button"
            className="rail-btn inline-flex min-h-11 min-w-11 items-center justify-center"
            onClick={() => {
              const v = videoRef.current;
              if (!v) return;
              v.muted = !v.muted;
              setMuted(v.muted);
            }}
            aria-label={muted || volume === 0 ? "Unmute" : "Mute"}
            title={muted || volume === 0 ? "Unmute" : "Mute"}
          >
            {muted || volume === 0 ? (
              <Glyph label="Unmute">
                <path d="M4 10h3l5-4v12l-5-4H4z" />
                <path d="m16 10 4 4M20 10l-4 4" />
              </Glyph>
            ) : (
              <Glyph label="Mute">
                <path d="M4 10h3l5-4v12l-5-4H4z" />
                <path d="M16 9.5c1.2.8 1.2 4.2 0 5" />
              </Glyph>
            )}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            aria-label="Volume"
            className="rail-vol hidden sm:block"
            onChange={(e) => {
              const next = Number(e.target.value);
              setVolume(next);
              setMuted(next === 0);
            }}
          />
          <button type="button" className="rail-btn inline-flex min-h-11 min-w-11 items-center justify-center" onClick={toggleFs} aria-label="Fullscreen" title="Fullscreen">
            {fs ? (
              <Glyph label="Exit fullscreen">
                <path d="M9 9H4V4M15 9h5V4M4 15v5h5M20 15v5h-5" />
              </Glyph>
            ) : (
              <Glyph label="Fullscreen">
                <path d="M9 4H4v5M15 4h5v5M4 15v5h5M20 15v5h-5" />
              </Glyph>
            )}
          </button>
          <button
            type="button"
            className="rail-btn inline-flex min-h-11 min-w-11 items-center justify-center"
            aria-label="Picture in picture"
            title="Picture in picture"
            onClick={() => {
              const v = videoRef.current;
              if (v) void togglePictureInPicture(v, document);
            }}
          >
            <Glyph label="Picture in picture">
              <path d="M4 6h16v12H4z" />
              <path d="M12 11h6v5h-6z" />
            </Glyph>
          </button>
          {audioUrl || audioSrc ? (
            <button
              type="button"
              className={`rail-btn${listen ? " is-on" : ""}`}
              aria-label={listen ? COPY.showVideo : listenLabel}
              title={listen ? COPY.showVideo : listenLabel}
              aria-pressed={listen}
              onClick={() => {
                holdPlace();
                setListen((on) => !on);
              }}
            >
              <span className="text-caption">{listen ? COPY.showVideo : listenLabel}</span>
            </button>
          ) : null}
          {hlsUrl ? (
            <button
              type="button"
              className={`rail-btn${saver ? " is-on" : ""}`}
              aria-label={saver ? COPY.originalVideo : dataSaverLabel}
              title={saver ? COPY.originalVideo : dataSaverLabel}
              aria-pressed={saver}
              onClick={() => {
                holdPlace();
                setListen(false);
                setSaver((on) => !on);
              }}
            >
              <span className="text-caption">{saver ? COPY.originalVideo : dataSaverLabel}</span>
            </button>
          ) : null}
          <button type="button" onClick={stampNow} className="rail-btn inline-flex min-h-11 min-w-11 items-center justify-center" aria-label="Pin this moment" title="Pin this moment">
            <Glyph label="Pin">
              <path d="M12 5v9" />
              <path d="M8 9.5h8" />
              <path d="M12 14v5" />
            </Glyph>
          </button>
          {resolvedNotes ? (
            <button
              type="button"
              className="rail-btn inline-flex min-h-11 min-w-11 items-center justify-center"
              aria-label={COPY.readNotes}
              title={COPY.readNotes}
              onClick={() => setNotesOpen(true)}
            >
              <Glyph label="Notes">
                <path d="M7 5h10v14H7z" />
                <path d="M10 9h4M10 13h4" />
              </Glyph>
            </button>
          ) : null}
          <button
            type="button"
            className={`rail-btn${saved ? " is-on" : ""}`}
            aria-label={saved ? COPY.folded : COPY.fold}
            title={saved ? COPY.folded : COPY.fold}
            onClick={() => setSaved(toggleLater({ lessonId: timeline.id, title, teacher: teacherSlug, course: courseId }))}
          >
            <Glyph label="Fold">
              <path d="M6 4h12v16l-6-4-6 4z" />
            </Glyph>
          </button>
          <PlayerMore
            open={moreOpen}
            onOpenChange={setMoreOpen}
            muted={muted}
            volume={volume}
            fullscreen={fs}
            camOff={camOff}
            layout={layout}
            isBoard={isBoard}
            stripOn={stripOn}
            hasStrip={timeline.slides.some((s) => s.url)}
            sleepOn={Boolean(sleepUntil)}
            hasPrev={Boolean(prevLesson)}
            hasNext={Boolean(nextLesson)}
            notesHref={resolvedNotes || undefined}
            onNotes={resolvedNotes ? () => setNotesOpen(true) : undefined}
            saved={saved}
            onMute={() => {
              const v = videoRef.current;
              if (!v) return;
              v.muted = !v.muted;
              setMuted(v.muted);
            }}
            onVolume={(n) => {
              setVolume(n);
              setMuted(n === 0);
            }}
            onFullscreen={toggleFs}
            onCam={() => setCamOff((on) => !on)}
            onLayout={() => setLayout((cur) => (cur === "pip" ? "side" : "pip"))}
            onStrip={() => setStripOn((on) => !on)}
            onSleep={() => setSleepUntil((cur) => (cur ? null : Date.now() + SLEEP_MINUTES * 60_000))}
            onPrev={() => prevLesson && openLesson(prevLesson)}
            onNext={() => nextLesson && openLesson(nextLesson)}
            onSave={() => setSaved(toggleLater({ lessonId: timeline.id, title, teacher: teacherSlug, course: courseId }))}
            onKeepClass={() => {
              setMoreOpen(false);
              setKeepOpen(true);
            }}
            onChapters={
              chapters.length
                ? () => {
                    setChaptersOpen((open) => !open);
                    setMoreOpen(false);
                  }
                : undefined
            }
            onSummarize={() => {
              setMoreOpen(false);
              void runSummary();
            }}
            silenceOn={silenceOn}
            canSkipSilence={silence.length > 0}
            onSkipSilence={() => setSilenceOn((on) => !on)}
            clipIn={clipIn}
            clipOut={clipOut}
            clipBusy={clipBusy}
            clipHref={clipHref}
            clipNote={clipNote}
            onClipIn={() => {
              setClipIn(shownTime);
              setClipHref("");
              setClipNote("");
            }}
            onClipOut={() => {
              setClipOut(shownTime);
              setClipHref("");
              setClipNote("");
            }}
            onSaveClip={() => void saveClip()}
          />
        </div>
      </div>
  );
}
