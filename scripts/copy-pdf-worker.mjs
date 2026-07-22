// Copy pdf.js's worker out of node_modules and into /public, where the viewer
// loads it from a plain URL (`/pdf.worker.min.mjs`).
//
// Why a copy rather than an import: the worker is a separate script pdf.js
// spawns at runtime, not a module the page imports, so it has to exist as a
// static asset. Resolving it through `new URL(..., import.meta.url)` leaves it
// at the mercy of whichever bundler is in play; copying it is the same on every
// machine, in dev, in `next build`, and on Vercel (postinstall runs there too).
// The copy is gitignored — the version in node_modules is the source of truth,
// so it can never drift from the pdfjs-dist we actually run.
import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

try {
  const pkg = dirname(require.resolve("pdfjs-dist/package.json"));
  const from = join(pkg, "build", "pdf.worker.min.mjs");
  const to = join(process.cwd(), "public", "pdf.worker.min.mjs");
  await mkdir(dirname(to), { recursive: true });
  await copyFile(from, to);
  console.log("copied pdf.js worker → public/pdf.worker.min.mjs");
} catch (err) {
  // Don't fail the install: everything except the PDF preview still works, and
  // the viewer says so on screen if the worker is missing.
  console.warn("could not copy the pdf.js worker:", err.message);
}
