import { useEffect } from "react";
import { COPY } from "@inkboard/shared/copy";

export function PlayerMore({
  open,
  onOpenChange,
  muted,
  volume,
  fullscreen,
  camOff,
  layout,
  isBoard,
  stripOn = false,
  hasStrip = false,
  sleepOn,
  hasPrev,
  hasNext,
  notesHref,
  onNotes,
  saved,
  onMute,
  onVolume,
  onFullscreen,
  onCam,
  onLayout,
  onStrip,
  onSleep,
  onPrev,
  onNext,
  onSave,
  onKeepClass,
  onChapters,
  onSummarize,
  silenceOn,
  canSkipSilence,
  onSkipSilence,
  clipIn,
  clipOut,
  clipBusy,
  clipHref,
  clipNote,
  onClipIn,
  onClipOut,
  onSaveClip,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  muted: boolean;
  volume: number;
  fullscreen: boolean;
  camOff: boolean;
  layout: "pip" | "side";
  isBoard: boolean;
  stripOn?: boolean;
  hasStrip?: boolean;
  sleepOn: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  notesHref?: string;
  onNotes?: () => void;
  saved: boolean;
  onMute: () => void;
  onVolume: (n: number) => void;
  onFullscreen: () => void;
  onCam: () => void;
  onLayout: () => void;
  onStrip?: () => void;
  onSleep: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSave: () => void;
  onKeepClass?: () => void;
  onChapters?: () => void;
  onSummarize?: () => void;
  silenceOn?: boolean;
  canSkipSilence?: boolean;
  onSkipSilence?: () => void;
  clipIn?: number | null;
  clipOut?: number | null;
  clipBusy?: boolean;
  clipHref?: string;
  clipNote?: string;
  onClipIn?: () => void;
  onClipOut?: () => void;
  onSaveClip?: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  return (
    <div className="player-more">
      <button
        type="button"
        className="rail-btn"
        aria-label={COPY.moreControls}
        title={COPY.moreControls}
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
      >
        <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="6" cy="12" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
          <circle cx="18" cy="12" r="1.1" fill="currentColor" stroke="none" />
        </svg>
      </button>
      {open ? (
        <div className="player-more-tray" role="menu" aria-label={COPY.moreControls}>
          <button type="button" className="player-more-row" role="menuitem" onClick={onMute}>
            {muted ? COPY.unmute : COPY.mute}
          </button>
          <label className="player-more-row">
            <span>{COPY.volume}</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              aria-label={COPY.volume}
              onChange={(e) => onVolume(Number(e.target.value))}
            />
          </label>
          <button type="button" className="player-more-row" role="menuitem" onClick={onFullscreen}>
            {fullscreen ? COPY.exitFullscreen : COPY.fullscreen}
          </button>
          {isBoard && hasStrip ? (
            <button type="button" className="player-more-row" role="menuitem" onClick={onStrip}>
              {stripOn ? COPY.hideSlides : COPY.showSlides}
            </button>
          ) : null}
          {isBoard ? (
            <button type="button" className="player-more-row" role="menuitem" onClick={onCam}>
              {camOff ? COPY.showCamera : COPY.hideCamera}
            </button>
          ) : null}
          {isBoard ? (
            <button type="button" className="player-more-row" role="menuitem" onClick={onLayout}>
              {layout === "pip" ? COPY.sideLayout : COPY.lanternLayout}
            </button>
          ) : null}
          <button type="button" className="player-more-row" role="menuitem" onClick={onSleep}>
            {sleepOn ? COPY.cancelSleep : COPY.sleep15}
          </button>
          {hasPrev ? (
            <button type="button" className="player-more-row" role="menuitem" onClick={onPrev}>
              {COPY.prevClass}
            </button>
          ) : null}
          {hasNext ? (
            <button type="button" className="player-more-row" role="menuitem" onClick={onNext}>
              {COPY.nextClass}
            </button>
          ) : null}
          <button type="button" className="player-more-row" role="menuitem" onClick={onSave}>
            {saved ? COPY.unfold : COPY.fold}
          </button>
          {onKeepClass ? (
            <button type="button" className="player-more-row" role="menuitem" onClick={onKeepClass}>
              {COPY.keepThisClass}
            </button>
          ) : null}
          {onChapters ? (
            <button type="button" className="player-more-row" role="menuitem" onClick={onChapters}>
              {COPY.chapters}
            </button>
          ) : null}
          {onSummarize ? (
            <button type="button" className="player-more-row" role="menuitem" onClick={onSummarize}>
              {COPY.summarize}
            </button>
          ) : null}
          {canSkipSilence && onSkipSilence ? (
            <button type="button" className="player-more-row" role="menuitem" onClick={onSkipSilence}>
              {silenceOn ? COPY.keepSilence : COPY.skipSilence}
            </button>
          ) : null}
          {onClipIn && onClipOut && onSaveClip ? (
            <>
              <button type="button" className="player-more-row" role="menuitem" onClick={onClipIn}>
                {COPY.markIn}
                {clipIn != null ? ` · ${clipIn.toFixed(0)}s` : ""}
              </button>
              <button type="button" className="player-more-row" role="menuitem" onClick={onClipOut}>
                {COPY.markOut}
                {clipOut != null ? ` · ${clipOut.toFixed(0)}s` : ""}
              </button>
              <button type="button" className="player-more-row" role="menuitem" disabled={clipBusy} onClick={onSaveClip}>
                {clipBusy ? COPY.savingClip : COPY.saveClip}
              </button>
              {clipHref ? (
                <a href={clipHref} className="player-more-row" download>
                  {COPY.clipReady}
                </a>
              ) : null}
              {clipNote ? <p className="player-more-note">{clipNote}</p> : null}
            </>
          ) : null}
          <p className="player-more-note">
            {COPY.shortcuts}: {COPY.keysHint}
          </p>
          {notesHref ? (
            onNotes ? (
              <button type="button" className="player-more-row" role="menuitem" onClick={onNotes}>
                {COPY.notes}
              </button>
            ) : (
              <a href={notesHref} className="player-more-row" role="menuitem" target="_blank" rel="noreferrer">
                {COPY.notes}
              </a>
            )
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
