import { Link, useNavigate, useParams, useSearch } from "@tanstack/react-router";

import { useQuery } from "@tanstack/react-query";

import { useEffect, useRef, useState } from "react";

import { AppShell } from "@/components/app-shell";

import { LargeStamp, LineSkel, ShelfEmpty } from "@/components/folio/shelf";

import { LiveStage } from "@/components/live-stage";

import { AppErrorComponent } from "@/lib/error-component";

import { COPY } from "@inkboard/shared/copy";

import { canJoinLive, emptyLiveSession, holdJoinableSession } from "@inkboard/shared/live-session";

import { loadClassDetail, loadLiveSession } from "@/lib/unacademy";

function fmtWhen(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function useCountdown(iso: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "";
  const diff = t - now;
  if (diff <= 0) return "starting now";
  const s = Math.floor(diff / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export default function LivePage() {
  const { classId } = useParams({ from: "/live/$classId" });
  const search = useSearch({ from: "/live/$classId" });
  const nav = useNavigate();

  const q = useQuery({
    queryKey: ["live-class", classId, search.slug ?? ""],
    queryFn: () => loadClassDetail({ data: { uid: classId, slug: search.slug } }),
    placeholderData: (prev) => prev,
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return 10_000;
      if (d.replayId) return false;
      if (d.status === "live") return 12_000;
      return 20_000;
    },
  });

  const live = q.data?.status === "live";
  const tokenQ = useQuery({
    queryKey: ["live-token", classId],
    queryFn: () => loadLiveSession({ data: { uid: classId, slug: search.slug } }),
    enabled: Boolean(classId) && !q.data?.replayId,
    placeholderData: (prev) => prev,
    refetchInterval: (query) => {
      const d = query.state.data;
      if (!d) return 12_000;
      if (d.gated) return false;
      if (canJoinLive(d) || d.hlsUrl) return 240_000;
      return 12_000;
    },
  });

  const heldSession = useRef<{ id: string; session?: typeof tokenQ.data }>({ id: classId });
  if (heldSession.current.id !== classId) heldSession.current = { id: classId, session: tokenQ.data };
  heldSession.current.session = holdJoinableSession(heldSession.current.session, tokenQ.data);

  const left = useCountdown(q.data?.status === "upcoming" ? q.data.liveAt : null);

  useEffect(() => {
    if (!q.data?.replayId) return;
    void nav({
      to: "/play/$lessonId",
      params: { lessonId: q.data.replayId },
      search: {
        title: q.data.title,
        teacher: q.data.authorUsername,
        course: q.data.courseUid || search.course,
      },
    });
  }, [q.data?.replayId, q.data?.title, q.data?.authorUsername, q.data?.courseUid, nav, search.course]);

  if (q.isLoading) {
    return (
      <AppShell compact>
        <main className="board-pad">
          <p className="text-seal text-faint">Opening the door</p>
          <LineSkel n={4} />
        </main>
      </AppShell>
    );
  }

  if (q.isError || !q.data) {
    return (
      <AppShell>
        <main className="board-pad">
          <ShelfEmpty
            title={COPY.doorDidNotOpen}
            body={q.error instanceof Error ? q.error.message : COPY.doorDidNotOpen}
            action={
              <Link to="/" className="ink-underline text-sm text-muted">
                {COPY.backToTheWall}
              </Link>
            }
          />
        </main>
      </AppShell>
    );
  }

  const c = q.data;
  const upcoming = c.status === "upcoming";
  const backTo = search.course
    ? `/course/${search.course}`
    : c.authorUsername
      ? `/teacher/${c.authorUsername}`
      : "/";
  const backLabel = search.course ? "← Course" : c.authorName ? `← ${c.authorName}` : "← Wall";
  const session = heldSession.current.session;
  const hls = session?.hlsUrl || c.hlsUrls[0] || null;
  const join = session && canJoinLive(session);
  const onAir = live || Boolean(join);
  if (onAir && (join || hls)) {
    return (
      <LiveStage
        session={
          session && join
            ? session
            : emptyLiveSession(classId, {
                display: c.authorName,
                hlsUrl: hls,
                className: c.title,
                courseName: c.courseName,
                educatorName: c.authorName,
              })
        }
        title={c.title}
        educator={session?.display || c.authorName}
        backTo={backTo}
      />
    );
  }

  const plusWait = Boolean(session?.gated && live);
  const waitTitle = onAir
    ? plusWait
      ? COPY.plusDoor
      : COPY.liveAtDoor
    : upcoming
      ? `Starts in ${left}`
      : COPY.boardIsComing;
  const waitBody = onAir
    ? plusWait
      ? COPY.plusDoor
      : "The live picture is joining. Keep this door open — if the stream does not land, Inkboard opens the synced board when the recording does."
    : upcoming
      ? "This slot has not started yet. Leave this door open — when the class goes live we watch for the picture, then the recording."
      : "The live slot has ended. Waiting for the recording and slides — this door opens the board when they land.";

  return (
    <AppShell compact>
      <main className="board-pad">
        <Link to={backTo} className="ink-underline text-sm text-muted">
          {backLabel}
        </Link>
        <p className="text-seal mt-5 flex items-center gap-2">
          {onAir ? (
            <>
              <span className="live-dot" aria-hidden="true" />
              <span className="text-danger">Live</span>
            </>
          ) : (
            <span className="text-faint">{upcoming ? "Upcoming" : "Door"}</span>
          )}
        </p>
        <h1 className="chalk-draw mt-2 font-serif text-h1">{c.title}</h1>
        <p className="mt-2 text-sm text-muted">
          {c.authorName || c.authorUsername}
          {c.liveAt ? ` · ${fmtWhen(c.liveAt)} IST` : ""}
        </p>

        <p className="mt-8 font-serif text-h3">{waitTitle}</p>

        <div className="mt-8 flex items-start gap-4">
          <LargeStamp src={c.authorAvatar} name={c.authorName || c.title} />
          <div className="min-w-0 max-w-[65ch]">
            <p className="font-serif text-h3">{c.authorName || "Educator"}</p>
            {c.authorUsername ? <p className="mt-1 text-caption text-muted">@{c.authorUsername}</p> : null}
            <p className="mt-3 text-sm leading-relaxed text-muted">{waitBody}</p>
            {c.courseName ? (
              c.courseUid ? (
                <Link
                  to="/course/$courseId"
                  params={{ courseId: c.courseUid }}
                  className="ink-underline mt-4 inline-block text-sm text-muted"
                >
                  {c.courseName}
                </Link>
              ) : (
                <Link to="/" className="ink-underline mt-4 inline-block text-sm text-muted">
                  {c.courseName}
                </Link>
              )
            ) : null}
          </div>
        </div>
      </main>
    </AppShell>
  );
}
