import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { LiveVideo } from "@/components/live-video";
import { useJanusCam } from "@/components/janus-cam";
import { LazyWhiteboard } from "@/components/whiteboard-lazy";
import { boxStyle, clampBox, layoutSlate, type Box } from "@/components/player-controls";
import { COPY } from "@inkboard/shared/copy";
import { canJoinLive, type LiveSession } from "@inkboard/shared/live-session";
import { liveFillCamera, timelineHasBoard } from "@inkboard/shared/live-dcn";
import { useLiveBoard } from "@inkboard/shared/use-live-board";

function Glyph({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      {children}
    </svg>
  );
}

export function LiveStage({
  session,
  title,
  educator,
  backTo,
}: {
  session: LiveSession;
  title: string;
  educator?: string;
  backTo: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const ingestRef = useRef<((raw: unknown) => void) | null>(null);
  const [camOff, setCamOff] = useState(false);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(1);
  const [err, setErr] = useState("");
  const [up, setUp] = useState(false);
  const [join, setJoin] = useState(0);
  const [box, setBox] = useState<Box>({ x: 24, y: 24, w: 128, h: 128 });
  const [board, setBoard] = useState<Box>({ x: 8, y: 8, w: 0, h: 0 });
  const userBox = useRef(false);
  const drag = useRef<{ px: number; py: number; bx: number; by: number; bw: number; mode: "move" | "resize"; moved: boolean } | null>(
    null,
  );

  const hls = session.hlsUrl;
  const janus = canJoinLive(session) && !hls;
  const { timeline, clockMs, snapshotSrc } = useLiveBoard(janus ? session : undefined, ingestRef);
  const boardful = timelineHasBoard(timeline);
  const fillCam = janus && liveFillCamera({ streamCanvas: session.streamCanvas, boardful });
  const asLantern = janus && !fillCam;

  useJanusCam(
    janus ? session : undefined,
    videoRef,
    (s) => {
      if (s.error) setErr(s.error);
      if (s.up) {
        setUp(true);
        setErr("");
      }
    },
    (raw) => ingestRef.current?.(raw),
    join,
  );

  const place = useCallback(() => {
    const el = stageRef.current;
    if (!el) return;
    const laid = layoutSlate(
      { width: el.clientWidth, height: el.clientHeight },
      { camOff, pocket: el.clientWidth < 640, pip: true },
    );
    setBoard(laid.board);
    if (!userBox.current) {
      const s = el.clientWidth < 640 ? 120 : 196;
      setBox(clampBox({ ...laid.lantern, w: s, h: s }, el.getBoundingClientRect(), true));
    }
  }, [camOff]);

  useEffect(() => {
    userBox.current = false;
    place();
  }, [place]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (!userBox.current) place();
      else setBox((b) => clampBox(b, el.getBoundingClientRect(), true));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [place]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
    v.volume = volume;
  }, [muted, volume]);

  function toggleFs() {
    const el = wrapRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen();
  }

  const videoEl = (
    <video
      ref={videoRef}
      className={
        asLantern && !camOff
          ? "pointer-events-none absolute top-1/2 left-1/2 max-w-none -translate-x-1/2 -translate-y-[42%] object-cover"
          : "block h-full w-full bg-bg object-contain"
      }
      style={asLantern && !camOff ? { width: "170%", height: "170%" } : undefined}
      playsInline
      autoPlay
      muted={muted}
    >
      <track kind="captions" srcLang="en" label="Captions" />
    </video>
  );

  return (
    <div ref={wrapRef} className="slate">
      <div className="slate-inscribe">
        <Link to={backTo} className="rail-btn" aria-label={COPY.backToTheWall} title={COPY.backToTheWall}>
          <Glyph>
            <path d="M15 6 9 12l6 6" />
          </Glyph>
        </Link>
        <div className="min-w-0 flex-1">
          <p className="slate-title truncate">{title}</p>
          <p className="slate-nudge flex items-center gap-2">
            <span className="live-dot" aria-hidden="true" />
            <span className="text-danger">{COPY.live}</span>
            {educator ? <span className="text-muted">· {educator}</span> : null}
          </p>
        </div>
        {asLantern ? (
          <button
            type="button"
            className="rail-btn"
            onClick={() => setCamOff((on) => !on)}
            aria-label={camOff ? COPY.showCamera : COPY.hideCamera}
            title={camOff ? COPY.showCamera : COPY.hideCamera}
          >
            {camOff ? COPY.showCamera : COPY.hideCamera}
          </button>
        ) : null}
      </div>

      <div ref={stageRef} className="slate-stage">
        {hls ? (
          <section className="slate-field" style={{ inset: 8 }}>
            <LiveVideo src={hls} />
          </section>
        ) : janus ? (
          <>
            {asLantern ? (
              <section className="slate-field" style={board.w ? boxStyle(board) : { inset: 8 }}>
                <LazyWhiteboard timeline={timeline} videoRef={videoRef} clockMs={clockMs} preferClock liveBackdrop={snapshotSrc} />
              </section>
            ) : null}
            <section
              className={asLantern ? `lantern${camOff ? " is-off" : ""}` : "slate-field"}
              style={
                asLantern
                  ? camOff || box.w <= 1
                    ? { position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }
                    : boxStyle(box)
                  : board.w
                    ? boxStyle(board)
                    : { inset: 8 }
              }
            >
              <div className={asLantern && !camOff ? "lantern-face" : "h-full w-full"}>{videoEl}</div>
              {asLantern && !camOff ? (
                <>
                  <div
                    className="absolute inset-0 z-10 cursor-grab touch-none"
                    aria-label="Move teacher"
                    onDoubleClick={() => {
                      userBox.current = false;
                      place();
                    }}
                    onPointerDown={(e) => {
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                      userBox.current = true;
                      drag.current = { px: e.clientX, py: e.clientY, bx: box.x, by: box.y, bw: box.w, mode: "move", moved: false };
                    }}
                    onPointerMove={(e) => {
                      const d = drag.current;
                      const stage = stageRef.current?.getBoundingClientRect();
                      if (!d || !stage) return;
                      const dx = e.clientX - d.px;
                      const dy = e.clientY - d.py;
                      if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
                      if (d.mode === "move") setBox((b) => clampBox({ ...b, x: d.bx + dx, y: d.by + dy }, stage, true));
                      else {
                        const s = d.bw + dx;
                        setBox((b) => clampBox({ ...b, w: s, h: s }, stage, true));
                      }
                    }}
                    onPointerUp={() => {
                      drag.current = null;
                    }}
                  />
                  <button
                    type="button"
                    className="seal-notch absolute z-20"
                    style={{ right: "16%", bottom: "16%" }}
                    aria-label="Resize teacher"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                      userBox.current = true;
                      drag.current = { px: e.clientX, py: e.clientY, bx: box.x, by: box.y, bw: box.w, mode: "resize", moved: false };
                    }}
                    onPointerMove={(e) => {
                      const d = drag.current;
                      const stage = stageRef.current?.getBoundingClientRect();
                      if (!d || !stage || d.mode !== "resize") return;
                      const s = d.bw + (e.clientX - d.px);
                      setBox((b) => clampBox({ ...b, w: s, h: s }, stage, true));
                    }}
                    onPointerUp={() => {
                      drag.current = null;
                    }}
                  />
                </>
              ) : null}
            </section>
          </>
        ) : null}

        {!up && janus && !err ? <span className="slate-buffer" aria-hidden="true" /> : null}
        {err ? (
          <div className="slate-err">
            <p>{err}</p>
            <button
              type="button"
              className="rail-btn mt-2"
              onClick={() => {
                setErr("");
                setUp(false);
                setJoin((n) => n + 1);
              }}
            >
              {COPY.tryAgain}
            </button>
          </div>
        ) : null}
      </div>

      <div className="chalk-rail-wrap">
        <div className="chalk-rail">
          {muted ? (
            <button type="button" className="rail-btn" aria-label={COPY.soundOn} title={COPY.soundOn} onClick={() => setMuted(false)}>
              {COPY.soundOn}
            </button>
          ) : (
            <button type="button" className="rail-btn" aria-label={COPY.mute} title={COPY.mute} onClick={() => setMuted(true)}>
              {COPY.mute}
            </button>
          )}
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={muted ? 0 : volume}
            aria-label={COPY.volume}
            className="live-vol"
            onChange={(e) => {
              const next = Number(e.target.value);
              setVolume(next);
              setMuted(next === 0);
            }}
          />
          <button type="button" className="rail-btn" aria-label={COPY.fullscreen} title={COPY.fullscreen} onClick={toggleFs}>
            {COPY.fullscreen}
          </button>
        </div>
      </div>
    </div>
  );
}
