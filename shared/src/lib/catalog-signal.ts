/** A loaded course must not grow a catalog banner from a side request. */

export type CatalogSignal = "ok" | "down" | "ignore";

export function catalogSignal(path: string, ok: boolean, status: number): CatalogSignal {
  const pathOnly = path.split("?")[0] || "";
  const primary =
    /^\/api\/(?:courses\/[^/]+|exams\/[^/]+\/(?:hub|teachers|courses|tests|practice)|educators\/[^/]+|search(?:\/[^/]+)?|batches\/[^/]+|live\/feed)$/.test(
      pathOnly,
    );
  const side = /^\/api\/(?:courses|exams|educators|teachers|search|lessons|batches|live)\b/.test(pathOnly);
  if (ok && (primary || side) && !pathOnly.endsWith("/probe")) return "ok";
  if (!ok && primary && status >= 500) return "down";
  return "ignore";
}
