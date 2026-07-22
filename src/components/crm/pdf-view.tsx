"use client";

import { useEffect, useRef, useState } from "react";

import type { Zoom } from "./document-viewer";

// ---------------------------------------------------------------------------
// PdfView — our own PDF renderer, so the page sits on the app canvas.
//
// The browser's built-in viewer paints its own near-black surround inside a
// cross-origin <iframe> and no CSS of ours can reach it, so a PDF looked like a
// different product from every other screen. pdf.js hands us the page as a
// canvas and we frame it ourselves: white sheet, soft shadow, canvas grey
// behind — the same treatment a card gets everywhere else.
//
// Trade-offs taken knowingly: pages render to canvas with NO text layer, so a
// digital PDF can't be text-selected or searched in place (Download still opens
// the real file, and Print still hands off to the browser). Pages render only
// as they come into view, so a long document doesn't rasterise up front.
// ---------------------------------------------------------------------------

// pdf.js's types aren't worth pulling in for the three calls we make.
/* eslint-disable @typescript-eslint/no-explicit-any */
type PdfDoc = { numPages: number; getPage: (n: number) => Promise<any>; destroy: () => Promise<void> };

let pdfjsPromise: Promise<any> | null = null;
function loadPdfjs(): Promise<any> {
  // ~350KB, imported on first PDF only — a record with no PDF never pays for it.
  pdfjsPromise ??= import("pdfjs-dist").then((m) => {
    // Copied out of node_modules at install time — see scripts/copy-pdf-worker.mjs.
    m.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    return m;
  });
  return pdfjsPromise;
}

/** 100% means actual paper size; pdf.js scale 1 is 72dpi against a 96dpi screen. */
const CSS_PER_PT = 96 / 72;
const PAGE_GAP = 16;

export function PdfView({ url, zoom }: { url: string; zoom: Zoom }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<PdfDoc | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The first page's unscaled size, which "Fit" is measured against.
  const [base, setBase] = useState<{ width: number; height: number } | null>(null);
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);

  // --- open the document ---------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    let opened: PdfDoc | null = null;
    // No state reset here: the component is keyed by url at the call site, so a
    // different file arrives as a fresh mount rather than a half-cleared one.
    (async () => {
      try {
        const pdfjs = await loadPdfjs();
        const task = pdfjs.getDocument({ url, isEvalSupported: false });
        const d: PdfDoc = await task.promise;
        if (cancelled) {
          d.destroy();
          return;
        }
        opened = d;
        const first = await d.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        if (cancelled) return;
        setBase({ width: vp.width, height: vp.height });
        setDoc(d);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "This PDF could not be opened.");
      }
    })();

    return () => {
      cancelled = true;
      opened?.destroy();
    };
  }, [url]);

  // --- measure the pane, so "Fit" means fit ---------------------------------
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const measure = () => setBox({ width: el.clientWidth, height: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center p-4 text-center text-[13px] text-[#71717a]">
        <span className="text-[#d64545]">{error}</span>
      </div>
    );
  }

  const padding = PAGE_GAP * 2;
  const scale =
    zoom === "fit"
      ? base && box
        ? Math.min(
            (box.width - padding) / base.width,
            (box.height - padding) / base.height,
          )
        : null
      : zoom * CSS_PER_PT;

  return (
    <div ref={scrollerRef} className="h-full w-full overflow-auto">
      {!doc || scale === null ? (
        <div className="flex h-full w-full items-center justify-center text-[13px] text-[#71717a]">
          Loading…
        </div>
      ) : (
        <div
          className="flex min-h-full min-w-full flex-col items-center gap-4 p-4"
          style={{ width: "max-content", minWidth: "100%" }}
        >
          {Array.from({ length: doc.numPages }, (_, i) => (
            <PdfPage
              key={i + 1}
              doc={doc}
              pageNumber={i + 1}
              scale={scale}
              fallback={base}
              root={scrollerRef}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// One page. Holds its own size from the start so the scroller doesn't jump as
// pages arrive, and only rasterises once it's near the viewport.
function PdfPage({
  doc,
  pageNumber,
  scale,
  fallback,
  root,
}: {
  doc: PdfDoc;
  pageNumber: number;
  scale: number;
  fallback: { width: number; height: number } | null;
  root: React.RefObject<HTMLDivElement | null>;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(pageNumber === 1);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (visible) return;
    const el = holderRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVisible(true);
      },
      { root: root.current, rootMargin: "400px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible, root]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let task: { cancel: () => void } | null = null;

    (async () => {
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      // Render at device resolution, present at CSS size — a 1:1 canvas is
      // visibly soft on a retina screen, and small print is the whole point.
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      setSize({ width: viewport.width, height: viewport.height });
      task = page.render({ canvas, viewport, transform: dpr === 1 ? null : [dpr, 0, 0, dpr, 0, 0] });
      try {
        await (task as any).promise;
      } catch {
        // Cancelled by a zoom change or unmount — not an error worth showing.
      }
    })();

    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [doc, pageNumber, scale, visible]);

  // Before it renders, reserve the page's footprint from the first page's ratio.
  const placeholder = fallback
    ? { width: fallback.width * scale, height: fallback.height * scale }
    : null;
  const shown = size ?? placeholder;

  return (
    <div
      ref={holderRef}
      className="shrink-0 overflow-hidden rounded-sm bg-white shadow-[0_2px_8px_rgba(10,10,10,0.12),0_0_0_1px_rgba(10,10,10,0.04)]"
      style={shown ? { width: shown.width, height: shown.height } : undefined}
    >
      <canvas ref={canvasRef} style={shown ? { width: shown.width, height: shown.height } : undefined} />
    </div>
  );
}
