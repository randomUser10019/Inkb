import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const css = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
const theme = css.slice(css.indexOf("@theme {"), css.indexOf("}", css.indexOf("@theme {")));
const kit = readFileSync(new URL("../src/components/ui/kit.tsx", import.meta.url), "utf8");

describe("design tokens", () => {
  it("keeps one brand accent, distinct from the old monochrome pair", () => {
    assert.match(theme, /--color-primary:\s*#d9d4c8/);
    assert.match(theme, /--color-accent:\s*#1aa88e/);
    assert.match(theme, /--font-serif:\s*"Source Serif 4"/);
    assert.match(theme, /--radius-board:\s*12px/);
    assert.match(theme, /--color-success:/);
    assert.match(theme, /--color-danger:/);
    assert.match(theme, /--space-4:/);
  });

  it("exports a dialog with a focus trap and a modal role", () => {
    assert.match(kit, /export function Dialog/);
    assert.match(kit, /aria-modal="true"/);
    assert.match(kit, /e\.key === "Escape"/);
    assert.match(kit, /export function Button/);
    assert.match(kit, /export function EmptyState/);
    assert.match(kit, /export function Tabs/);
    assert.match(kit, /export function Toast/);
    assert.match(kit, /export function Badge/);
    assert.match(kit, /export function Progress/);
    assert.match(kit, /export function Switch/);
    assert.match(kit, /role="switch"/);
    assert.match(kit, /export function Select/);
    assert.match(kit, /export function Tooltip/);
    assert.match(kit, /role="tooltip"/);
    assert.match(kit, /export function Menu/);
    assert.match(kit, /role="menu"/);
    assert.match(kit, /document.body.style.overflow = "hidden"/);
    assert.match(kit, /prev\?\.focus\(\)/);
  });
});
