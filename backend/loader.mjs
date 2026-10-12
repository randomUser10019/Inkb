import { existsSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const srcRoot = join(dirname(fileURLToPath(import.meta.url)), "src");
const sharedRoot = join(dirname(fileURLToPath(import.meta.url)), "../shared/src/lib");

function existingFile(base) {
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.mjs`,
    `${base}.js`,
    join(base, "index.ts"),
    join(base, "index.mjs"),
  ];
  for (const file of candidates) {
    if (existsSync(file) && statSync(file).isFile()) return file;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@inkboard/shared/")) {
    const rest = specifier.slice("@inkboard/shared/".length).replace(/\.tsx?$/, "");
    const file = existingFile(join(sharedRoot, rest));
    if (file) return nextResolve(pathToFileURL(file).href, context);
  }
  if (specifier.startsWith("@/")) {
    const rest = specifier.slice(2);
    const file = existingFile(join(srcRoot, rest));
    if (file) return nextResolve(pathToFileURL(file).href, context);
  }
  if (specifier.startsWith("./") || specifier.startsWith("../")) {
    const parent = context.parentURL ? fileURLToPath(context.parentURL) : srcRoot;
    const raw = join(dirname(parent), specifier);
    if (!extname(raw)) {
      const file = existingFile(raw);
      if (file) return nextResolve(pathToFileURL(file).href, context);
    }
  }
  return nextResolve(specifier, context);
}
