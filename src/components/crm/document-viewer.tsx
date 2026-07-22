"use client";

import { useEffect, useState } from "react";

import { getDocumentSignedUrl } from "@/app/(app)/documents/actions";
import { Icon } from "./icon";

export type ViewerDoc = {
  id: string;
  name: string;
  file_name: string;
  file_type: string | null;
  /** Human reference, e.g. "D-104" — shown beside the name. */
  reference?: string | null;
  /** Where the file came from, e.g. "Note N-18" or "Lead L-2431". */
  source?: string | null;
};

type Kind = "image" | "pdf" | "text" | "other";

function kindOf(type: string | null): Kind {
  const t = (type ?? "").toLowerCase();
  if (t.startsWith("image/")) return "image";
  if (t === "application/pdf") return "pdf";
  if (t.startsWith("text/")) return "text";
  return "other";
}

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;

/**
 * Zoom is either a scale factor or "fit" — the whole document sized to the
 * pane. **"fit" is the default**: opening a file should show all of it, and
 * zooming in is the deliberate act. (Actual size is a poor default: a scanned
 * A4 survey opens cropped to its top-left corner and every user's first move is
 * to zoom out.) Stepping out of "fit" lands on the nearest sensible scale.
 */
type Zoom = number | "fit";
const ZOOM_FROM_FIT_IN = 1;
const ZOOM_FROM_FIT_OUT = 0.75;

// Fetch a fresh signed URL (private bucket). Callers key the viewer body by
// document id, so this mounts fresh per document — state is only set from the
// async callback, never synchronously in the effect body.
function useSignedUrl(docId: string) {
  const [state, setState] = useState<{ url: string | null; error: string | null; loading: boolean }>(
    { url: null, error: null, loading: true },
  );
  useEffect(() => {
    let live = true;
    getDocumentSignedUrl(docId).then((res) => {
      if (!live) return;
      if (res.error || !res.url) setState({ url: null, error: res.error ?? "Could not open file.", loading: false });
      else setState({ url: res.url, error: null, loading: false });
    });
    return () => {
      live = false;
    };
  }, [docId]);
  return state;
}

async function openDownload(id: string) {
  const res = await getDocumentSignedUrl(id, { download: true });
  if (res.url) window.open(res.url, "_blank");
}

// ---------------------------------------------------------------------------
// Zoom bar — shared − / percent / + control.
// ---------------------------------------------------------------------------
function ZoomBar({ zoom, setZoom }: { zoom: Zoom; setZoom: (z: Zoom) => void }) {
  const fit = zoom === "fit";
  const zoomOut = () =>
    setZoom(fit ? ZOOM_FROM_FIT_OUT : Math.max(ZOOM_MIN, Math.round((zoom - ZOOM_STEP) * 100) / 100));
  const zoomIn = () =>
    setZoom(fit ? ZOOM_FROM_FIT_IN : Math.min(ZOOM_MAX, Math.round((zoom + ZOOM_STEP) * 100) / 100));
  const btn =
    "flex h-7 w-7 items-center justify-center rounded-md border border-[#e7e7ea] bg-white text-[#3f3f46] transition-colors hover:bg-[#fafafa] disabled:opacity-40";
  const label = "text-[#71717a]";
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className={btn}
        aria-label="Zoom out"
        disabled={!fit && zoom <= ZOOM_MIN}
        onClick={zoomOut}
      >
        <Icon name="minus" size={14} strokeWidth={2} />
      </button>
      <button
        type="button"
        onClick={() => setZoom("fit")}
        className={`min-w-[44px] text-center text-[11.5px] font-semibold tabular-nums ${label} hover:underline`}
        title="Fit to view"
      >
        {fit ? "Fit" : `${Math.round(zoom * 100)}%`}
      </button>
      <button
        type="button"
        className={btn}
        aria-label="Zoom in"
        disabled={!fit && zoom >= ZOOM_MAX}
        onClick={zoomIn}
      >
        <Icon name="plus" size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage — the scrollable, zoomable content area. Fills its parent's height.
// ---------------------------------------------------------------------------
function Stage({
  doc,
  url,
  loading,
  error,
  zoom,
}: {
  doc: ViewerDoc;
  url: string | null;
  loading: boolean;
  error: string | null;
  zoom: Zoom;
}) {
  const k = kindOf(doc.file_type);

  if (loading) return <Centered>Loading…</Centered>;
  if (error)
    return (
      <Centered>
        <span className="text-[#d64545]">{error}</span>
      </Centered>
    );
  if (!url) return null;

  if (k === "image") {
    return (
      <div className="h-full w-full overflow-auto p-4">
        <div className="flex min-h-full min-w-full items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={doc.name}
            className="block rounded-md object-contain shadow-lg"
            style={
              zoom === "fit"
                ? { maxWidth: "100%", maxHeight: "100%" }
                : { width: `${zoom * 100}%`, maxWidth: "none", height: "auto" }
            }
          />
        </div>
      </div>
    );
  }

  if (k === "pdf") {
    // Drive the PDF viewer's OWN zoom via the #zoom= param so the page re-renders
    // its vectors at the new scale (crisp small text) — scaling the iframe box
    // only makes the viewer re-fit the same page. Hide its chrome (toolbar / page
    // nav / sidebar); keep the scrollbar so a zoomed page can be panned. Changing
    // the #fragment alone won't re-apply zoom, so the iframe is keyed by zoom to
    // remount. The signed URL keeps its ?token= query; PDF params go after #.
    //
    // "fit" maps to the viewer's own page-fit mode, which sizes the WHOLE page
    // to the pane — `zoom=100` means actual paper size, so an A4 scan opened
    // cropped to its top-left corner.
    // `view=Fit` is the PDF open-parameter Chromium honours; `zoom=page-fit` is
    // pdf.js's spelling of the same thing. Emitting both covers either viewer,
    // and neither is sent when an explicit percentage is chosen.
    const hash =
      zoom === "fit"
        ? "#toolbar=0&navpanes=0&view=Fit&zoom=page-fit"
        : `#toolbar=0&navpanes=0&zoom=${Math.round(zoom * 100)}`;
    return (
      // NB: the surround you actually see around a PDF page is painted by the
      // browser's own PDF viewer INSIDE this cross-origin iframe — CSS can't
      // reach it. This is our canvas showing while it loads.
      <div className="h-full w-full bg-[var(--canvas)]">
        <iframe
          key={String(zoom)}
          src={`${url}${hash}`}
          title={doc.name}
          className="h-full w-full border-0"
        />
      </div>
    );
  }

  if (k === "text") {
    return (
      <div className="h-full w-full overflow-auto">
        <iframe src={url} title={doc.name} className="h-full w-full border-0 bg-white" />
      </div>
    );
  }

  // Non-previewable — offer a download.
  return (
    <Centered>
      <div className="flex flex-col items-center gap-3 rounded-xl border border-[#e7e7ea] bg-white px-8 py-10 text-center shadow-[0_12px_32px_rgba(10,10,10,0.10)]">
        <Icon name="file" size={32} strokeWidth={1.5} className="text-[#a1a1aa]" />
        <p className="text-[13px] font-semibold text-[#0a0a0a]">{doc.file_name}</p>
        <p className="max-w-xs text-[12px] text-[#71717a]">
          This file type can’t be previewed here. Download it to open on your device.
        </p>
        <button
          type="button"
          onClick={() => openDownload(doc.id)}
          className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-blue)] px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-[var(--accent-hover)]"
        >
          <Icon name="download" size={14} strokeWidth={2} /> Download file
        </button>
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-4 text-[13px] text-[#71717a]">
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline viewer — lives in the right-hand pane of the Documents tab.
// ---------------------------------------------------------------------------
export function InlineViewer({ doc, onFullscreen }: { doc: ViewerDoc | null; onFullscreen: () => void }) {
  if (!doc) {
    return (
      <div className="flex h-full min-h-[600px] flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-[#e7e7ea] bg-[#fafafa] text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#a1a1aa] shadow-[0_1px_3px_rgba(10,10,10,0.06)]">
          <Icon name="eye" size={18} strokeWidth={1.75} />
        </span>
        <p className="text-[12.5px] font-medium text-[#71717a]">Select a document to preview</p>
      </div>
    );
  }
  return <InlineBody key={doc.id} doc={doc} onFullscreen={onFullscreen} />;
}

function InlineBody({ doc, onFullscreen }: { doc: ViewerDoc; onFullscreen: () => void }) {
  const { url, error, loading } = useSignedUrl(doc.id);
  const [zoom, setZoom] = useState<Zoom>("fit");
  const k = kindOf(doc.file_type);
  const zoomable = k === "image" || k === "pdf";

  return (
    <div className="flex h-full min-h-[600px] flex-1 flex-col overflow-hidden rounded-xl border border-[#e7e7ea] bg-white">
      <div className="flex items-center gap-2 border-b border-[#f4f4f5] px-3 py-2">
        <Icon name="file" size={15} strokeWidth={1.75} className="shrink-0 text-[var(--accent-blue)]" />
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[#0a0a0a]">
          {doc.name}
          {doc.reference && (
            <span className="ml-1.5 font-mono text-[11px] font-medium text-[#a1a1aa]">
              {doc.reference}
            </span>
          )}
          {doc.source && (
            <span className="ml-1.5 rounded-full bg-[var(--accent-tint)] px-1.5 py-0.5 text-[10.5px] font-semibold text-[var(--accent-active)]">
              {doc.source}
            </span>
          )}
        </span>
        {zoomable && <ZoomBar zoom={zoom} setZoom={setZoom} />}
        <button
          type="button"
          onClick={() => openDownload(doc.id)}
          title="Download"
          aria-label="Download"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e7e7ea] bg-white text-[#3f3f46] transition-colors hover:bg-[#fafafa]"
        >
          <Icon name="download" size={14} strokeWidth={1.9} />
        </button>
        <button
          type="button"
          onClick={onFullscreen}
          title="Full screen"
          aria-label="Full screen"
          className="flex h-7 w-7 items-center justify-center rounded-md border border-[#e7e7ea] bg-white text-[#3f3f46] transition-colors hover:bg-[#fafafa]"
        >
          <Icon name="maximize" size={14} strokeWidth={1.9} />
        </button>
      </div>
      <div className="min-h-0 flex-1 bg-[var(--canvas)]">
        <Stage doc={doc} url={url} loading={loading} error={error} zoom={zoom} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fullscreen viewer — a full-screen overlay (opened from the inline viewer).
// ---------------------------------------------------------------------------
export function FullscreenViewer({ doc, onClose }: { doc: ViewerDoc | null; onClose: () => void }) {
  if (!doc) return null;
  return <FsOverlay key={doc.id} doc={doc} onClose={onClose} />;
}

function FsOverlay({ doc, onClose }: { doc: ViewerDoc; onClose: () => void }) {
  const { url, error, loading } = useSignedUrl(doc.id);
  const [zoom, setZoom] = useState<Zoom>("fit");
  const k = kindOf(doc.file_type);
  const zoomable = k === "image" || k === "pdf";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--canvas)]">
      <div className="flex items-center gap-3 border-b border-[#e7e7ea] bg-white px-4 py-3">
        <Icon name="file" size={16} strokeWidth={1.75} className="text-[var(--accent-blue)]" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#0a0a0a]">
          {doc.name}
          {doc.reference && (
            <span className="ml-1.5 font-mono text-[11.5px] font-medium text-[#a1a1aa]">
              {doc.reference}
            </span>
          )}
          {doc.source && (
            <span className="ml-1.5 rounded-full bg-[var(--accent-tint)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--accent-active)]">
              {doc.source}
            </span>
          )}
        </span>
        {zoomable && <ZoomBar zoom={zoom} setZoom={setZoom} />}
        <button
          type="button"
          onClick={() => openDownload(doc.id)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#e7e7ea] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#3f3f46] transition-colors hover:bg-[#fafafa]"
        >
          <Icon name="download" size={14} strokeWidth={2} /> Download
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#e7e7ea] bg-white text-[#3f3f46] transition-colors hover:bg-[#fafafa]"
        >
          <Icon name="x" size={16} strokeWidth={2} />
        </button>
      </div>
      <div className="min-h-0 flex-1" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <Stage doc={doc} url={url} loading={loading} error={error} zoom={zoom} />
      </div>
    </div>
  );
}
