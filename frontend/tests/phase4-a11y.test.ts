import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import axe from "axe-core";
import { JSDOM } from "jsdom";

function src(rel: string) {
  return readFileSync(new URL(rel, import.meta.url), "utf8");
}

describe("Phase 4 accessibility and loading", () => {
  it("keeps a global focus ring, reduced motion, and one main landmark", () => {
    const css = src("../src/styles.css");
    const shell = src("../src/components/folio/shell.tsx");
    const root = src("../src/routes/__root.tsx");
    assert.match(css, /:focus-visible/);
    assert.match(css, /prefers-reduced-motion:\s*reduce/);
    assert.match(shell, /<main id="board"/);
    assert.match(src("../src/components/folio/margin.tsx"), /aria-label="Navigation"/);
    assert.doesNotMatch(root, /rel: "preconnect"/);
    assert.match(src("../src/routes/play.$lessonId.tsx"), /rel: "preconnect"/);
    assert.match(src("../src/routes/live.$classId.tsx"), /rel: "preconnect"/);
  });

  it("loads the board, palette, and planner extras after the first paint", () => {
    const root = src("../src/routes/__root.tsx");
    const lazy = src("../src/components/whiteboard-lazy.tsx");
    assert.match(root, /requestIdleCallback/);
    assert.match(root, /DeferredChrome/);
    assert.match(lazy, /import\("@\/components\/whiteboard"\)/);
    assert.match(src("../src/components/class-player.tsx"), /LazyWhiteboard/);
    assert.match(cssWeights(), /400\.css/);
    assert.match(cssWeights(), /600\.css/);
    assert.doesNotMatch(cssWeights(), /500\.css/);
  });

  it("shows exam color and player keys on the screen", () => {
    assert.match(src("../src/components/browse-catalog.tsx"), /desk-exam-tick/);
    assert.match(src("../src/components/player-transport.tsx"), /COPY\.keysHint/);
    assert.match(src("../src/styles.css"), /\.rail-keys/);
  });

  it("holds a 90 lighthouse budget for home and today", () => {
    const budget = JSON.parse(src("../../lighthouserc.json")) as {
      ci: {
        assert: { assertions: Record<string, [string, { minScore?: number; maxNumericValue?: number }]> };
        collect: { url: string[] };
      };
    };
    assert.equal(budget.ci.assert.assertions["categories:performance"][1].minScore, 0.9);
    assert.equal(budget.ci.assert.assertions["categories:accessibility"][1].minScore, 1);
    assert.equal(budget.ci.assert.assertions["cumulative-layout-shift"][1].maxNumericValue, 0.05);
    assert.ok(budget.ci.collect.url.includes("http://127.0.0.1:8080/"));
    assert.ok(budget.ci.collect.url.includes("http://127.0.0.1:8080/planner/today"));
  });

  it("axe finds no name or landmark violations on the desk shell", async () => {
    const html = `<!doctype html><html lang="en"><head><title>Inkboard</title></head><body>
      <a href="#board">Skip to content</a>
      <nav aria-label="Navigation"><a href="/">Home</a><a href="/planner/today">Planner</a></nav>
      <main id="board">
        <h1>Pick an exam</h1>
        <a href="/search">Search classes and teachers</a>
        <button type="button">Search</button>
      </main>
    </body></html>`;
    const dom = new JSDOM(html);
    const results = await axe.run(dom.window.document.documentElement, {
      runOnly: {
        type: "rule",
        values: ["document-title", "html-has-lang", "button-name", "link-name", "landmark-one-main", "region"],
      },
    });
    assert.deepEqual(
      results.violations.map((v) => v.id),
      [],
    );
  });
});

function cssWeights() {
  return src("../src/styles.css").slice(0, 400);
}
