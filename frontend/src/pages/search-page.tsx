import { Link, useNavigate, useSearch } from "@tanstack/react-router";

import { useQuery } from "@tanstack/react-query";

import { useEffect, useMemo, useRef, useState } from "react";

import { Input } from "@/components/ui/kit";

import { AppShell } from "@/components/app-shell";

import { EducatorCatalog, type TeacherTab } from "@/components/educator-catalog";

import { LineSkel, SeekHit, ShelfEmpty } from "@/components/folio/shelf";

import { IndexShelf } from "@/components/folio/wall";

import { COPY } from "@inkboard/shared/copy";

import { useSelectedExam } from "@inkboard/shared/exam-pref";

import { pushRecent } from "@inkboard/shared/library";

import { usernameFromQuery, usernameIfNoHits } from "@inkboard/shared/search-query";

import { isReplayId, searchEducators } from "@/lib/unacademy";

import { shelfEmptyCopy } from "@inkboard/shared/shelf";

import { lectureHref, searchStudy } from "@inkboard/shared/local-search";
import { byCatalogScore } from "@inkboard/shared/catalog-rank";
import { readBookmarks } from "@inkboard/shared/planner/bookmarks";
import { usePlannerSnapshot } from "@inkboard/shared/planner/use-planner";

export default function SearchPage() {
  const { q, topic, sort, tab } = useSearch({ from: "/search" });
  const nav = useNavigate();
  const exam = useSelectedExam();
  const empty = shelfEmptyCopy(q);
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(q);
  const directUser = usernameFromQuery(q);
  const planner = usePlannerSnapshot();
  const localHits = useMemo(() => {
    const tasks = planner.plans.flatMap((plan) =>
      plan.deletedAt
        ? []
        : plan.tasks
            .filter((task) => !task.deletedAt)
            .map((task) => ({
              title: task.title,
              text: task.note ?? "",
              href: task.lessonId ? lectureHref(task.lessonId, 0) : "/planner/today",
              kind: "task" as const,
            })),
    );
    const marks = readBookmarks().map((mark) => ({
      title: mark.title,
      text: mark.note,
      href: lectureHref(mark.lessonId, mark.seconds),
      kind: "bookmark" as const,
    }));
    return searchStudy([...tasks, ...marks], q);
  }, [planner.plans, q]);

  useEffect(() => {
    setDraft(q);
  }, [q]);

  useEffect(() => {
    if (q.trim()) return;
    inputRef.current?.focus();
  }, [q]);

  const lookup = useQuery({
    queryKey: ["seek", q.trim().toLowerCase(), exam?.id ?? ""],
    enabled: q.trim().length >= 2 && !isReplayId(q.trim()) && !directUser,
    queryFn: () => searchEducators({ data: { q: q.trim(), goalId: exam?.id } }),
  });

  const hits = lookup.data?.hits ?? [];
  const fallbackUser =
    !directUser && !lookup.isLoading && lookup.isFetched ? usernameIfNoHits(q, hits.length) : "";
  const usernameQ = directUser || fallbackUser;
  const blank = !q.trim();

  function go(next: string) {
    const t = next.trim();
    if (t.length < 2) return;
    pushRecent(t);
    void nav({ to: "/search", search: { q: t, topic: undefined, sort, tab } });
  }

  const field = (
    <Input
      ref={inputRef}
      className="write-field mt-3 w-full bg-transparent text-left"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          go(draft);
        }
      }}
      aria-label="Search"
      placeholder={COPY.writeWhere}
    />
  );

  return (
    <AppShell>
      {usernameQ ? (
        <EducatorCatalog
          username={usernameQ}
          topicUid={topic}
          sort={sort ?? "latest"}
          tab={tab ?? "courses"}
          exam={exam}
          onTopic={(uid) =>
            void nav({
              to: "/search",
              search: { q: usernameQ, topic: uid, sort, tab },
            })
          }
          onSort={(s) =>
            void nav({
              to: "/search",
              search: { q: usernameQ, topic, sort: s, tab },
            })
          }
          onTab={(next) =>
            void nav({
              to: "/search",
              search: { q: usernameQ, topic, sort, tab: next },
            })
          }
        />
      ) : blank ? (
        <main className="board-pad">
          {field}
        </main>
      ) : (
        <main className="board-pad">
          <Link to="/" className="ink-underline text-sm text-muted">
            ← All exams
          </Link>
          <p className="mt-4 text-sm text-muted">{exam ? exam.name : "Search"}</p>
          {field}
          {localHits.length ? (
            <section className="mt-4" aria-label="On this device">
              <h2 className="text-sm text-muted">On this device</h2>
              <ul className="mt-2">
                {localHits.map((hit) => (
                  <li key={`${hit.kind}:${hit.href}:${hit.title}`}>
                    <a href={hit.href} className="inline-flex min-h-11 items-center text-sm">
                      {hit.title}
                      {hit.snippet.match ? (
                        <span className="ml-2 text-muted">
                          {hit.snippet.before}
                          <mark>{hit.snippet.match}</mark>
                          {hit.snippet.after}
                        </span>
                      ) : null}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {lookup.isLoading ? (
            <LineSkel />
          ) : lookup.isError ? (
            <ShelfEmpty
              title="Search didn’t return"
              body={lookup.error instanceof Error ? lookup.error.message : "The catalog could not be reached."}
              action={
                <button type="button" onClick={() => void lookup.refetch()} className="ink-underline text-sm text-muted">
                  Try again
                </button>
              }
            />
          ) : hits.length === 0 ? (
            <ShelfEmpty title={empty.title} body={empty.body} />
          ) : (
            <div className="mt-8 space-y-8">
              {(() => {
                const inExam = hits.filter((h) => h.inExam);
                const outside = hits.filter((h) => !h.inExam);
                const groups =
                  exam && inExam.length
                    ? [
                        { title: `In ${exam.name}`, items: inExam },
                        ...(outside.length ? [{ title: "Other exams", items: outside }] : []),
                      ]
                    : [{ title: "", items: hits }];
                return groups.map((g) => (
                  <section key={g.title || "all"}>
                    {g.title ? <p className="text-seal mb-2 text-faint">{g.title}</p> : null}
                    <IndexShelf>
                      {byCatalogScore(g.items, q, (hit) => ({
                        title: hit.name,
                        topic: hit.topics || hit.bio,
                        educator: hit.username,
                      })).map((h) => (
                          <SeekHit
                            key={h.uid || h.username}
                            avatar={h.avatar}
                            name={h.name}
                            username={h.username}
                            meta={h.topics || h.bio}
                            onOpen={() => pushRecent(q)}
                          />
                      ))}
                    </IndexShelf>
                  </section>
                ));
              })()}
            </div>
          )}
        </main>
      )}
    </AppShell>
  );
}
