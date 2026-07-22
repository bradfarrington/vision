"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

import { resolveAddress } from "@/app/(app)/geo/actions";
import {
  addressKey,
  addressLine,
  directionsUrl,
  what3wordsUrl,
  type AddressInput,
  type MatchPrecision,
  type ResolvedLocation,
} from "@/lib/geo";

// ---------------------------------------------------------------------------
// AddressMap — the real map, used everywhere an address is shown.
//
// Renderer is MapLibre GL over OpenStreetMap vector tiles: no API key, no
// account, no per-view billing, and nothing to configure before it works on a
// fresh clone. The tile style is env-overridable (`NEXT_PUBLIC_MAP_STYLE_URL`),
// so moving to a paid or self-hosted tile host later is one environment
// variable and no code change.
//
// MapLibre is ~200KB gzipped, so it is imported DYNAMICALLY inside the effect
// rather than at module scope — a screen that never shows a map never ships the
// renderer, and the customer record only pays for it when the Address tab is
// opened.
//
// The pin goes on the BUILDING (see geocodeAddress in lib/geo.ts). When the
// geocoder can only manage the street or the postcode, the map says so rather
// than implying door-level accuracy — a map that quietly rounds to the middle
// of a postcode will eventually send a fitter to the wrong house.
// ---------------------------------------------------------------------------

const DEFAULT_STYLE = "https://tiles.openfreemap.org/styles/positron";
const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || DEFAULT_STYLE;

/**
 * How far in to zoom for each quality of match — never further than we actually
 * know. This is the ONLY place the match precision shows itself: the map does
 * not editorialise about what the geocoder could or could not pin down. The
 * precision is still recorded in `address_locations` if it is ever needed.
 */
const ZOOM_FOR: Record<MatchPrecision, number> = {
  address: 18,
  street: 17,
  postcode: 16,
  outcode: 12,
};

/**
 * Attribution lives in the card's fine print, NOT on the canvas.
 *
 * The map's own control was tried twice and rejected both times: MapLibre's
 * `compact: true` renders EXPANDED until the user's first drag (it adds
 * `maplibregl-compact-show` alongside `maplibregl-compact`), and collapsing it
 * to the ⓘ button still puts map-tool chrome on a CRM card, one click from a
 * wall of provider branding.
 *
 * It cannot simply be deleted: OpenStreetMap data is published under the ODbL
 * and crediting it is a licence condition, not a preference. The OSM
 * Foundation's attribution guidelines allow that credit to sit *adjacent to*
 * the map rather than on it — so `attributionControl: false` takes it off the
 * canvas and `<MapCredit>` puts it in the footer as fine print, where it looks
 * like part of our UI. Compliant, and no map branding on the map.
 *
 * If a future provider forbids adjacent attribution (Google and Mapbox both
 * mandate an on-canvas logo), that provider's rules win — do not reuse this.
 */
function MapCredit() {
  return (
    <a
      href="https://www.openstreetmap.org/copyright"
      target="_blank"
      rel="noopener noreferrer"
      className="text-[10px] text-[#c4c4c8] hover:text-[#71717a] hover:underline"
    >
      © OpenStreetMap
    </a>
  );
}

type AddressMapProps = AddressInput & {
  /** what3words reference, if the record holds one. */
  what3words?: string | null;
  /** Height of the map canvas. Fixed by design — a map must never grow with the data. */
  height?: number;
  /** Drag/zoom. Off gives a static locator thumbnail. */
  interactive?: boolean;
  /** The caveat + links strip under the canvas. */
  showFooter?: boolean;
  className?: string;
};

export function AddressMap({
  houseName = null,
  houseNumber = null,
  street = null,
  locality = null,
  town = null,
  county = null,
  postcode = null,
  what3words,
  height = 220,
  interactive = true,
  showFooter = true,
  className = "",
}: AddressMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<MapLibreMarker | null>(null);

  // Bumped by "Try again" to re-run the lookup after a transient failure.
  const [attempt, setAttempt] = useState(0);

  // The address parts stay PRIMITIVE props all the way down to the effect
  // dependencies. Taking them as one object would mean a fresh identity every
  // render and a geocode request on each one.
  const address: AddressInput = { houseName, houseNumber, street, locality, town, county, postcode };
  const line = addressLine(address);
  const addrKey = addressKey(address);

  // Both pieces of async state are STAMPED with the address+attempt they belong
  // to, and the render derives from that stamp. Storing them bare would mean
  // resetting them from an effect when the address changes — a setState-in-
  // effect cascade, and a window where a new address is drawn at the previous
  // one's coordinates.
  const key = `${addrKey ?? ""}#${attempt}`;
  const [resolved, setResolved] = useState<{ key: string; result: ResolvedLocation } | null>(null);
  const [tileError, setTileError] = useState<string | null>(null);

  // --- 1. Address → coordinates (server action, read-through DB cache) -------
  useEffect(() => {
    if (!addrKey) return;
    let cancelled = false;
    const settle = (result: ResolvedLocation) => {
      if (!cancelled) setResolved({ key, result });
    };
    resolveAddress({ houseName, houseNumber, street, locality, town, county, postcode }).then(
      settle,
      () => settle({ status: "unavailable" }),
    );
    return () => {
      cancelled = true;
    };
  }, [addrKey, key, houseName, houseNumber, street, locality, town, county, postcode]);

  // `null` means "still looking" — an unstamped or stale result is not an answer.
  const location: ResolvedLocation | null = !addrKey
    ? { status: "invalid" }
    : resolved?.key === key
      ? resolved.result
      : null;
  const tilesFailed = tileError === key;

  const coords = location?.status === "ok" ? location : null;
  const lat = coords?.lat;
  const lng = coords?.lng;
  const zoom = coords ? ZOOM_FOR[coords.precision] : 15;

  // --- 2. Coordinates → map -------------------------------------------------
  useEffect(() => {
    const container = containerRef.current;
    if (!container || lat == null || lng == null) return;

    let cancelled = false;

    (async () => {
      const maplibregl = (await import("maplibre-gl")).default;
      // Strict Mode runs effects twice; without this the first map is built
      // against a container the second run has already claimed.
      if (cancelled) return;

      const map = new maplibregl.Map({
        container,
        style: STYLE_URL,
        center: [lng, lat],
        zoom,
        interactive,
        // Off the canvas — the credit is rendered as card fine print instead.
        // See MapCredit above before changing this.
        attributionControl: false,
        // A rotated or tilted map helps nobody find a house, and a stray
        // two-finger drag spinning the view reads as a bug.
        dragRotate: false,
        pitchWithRotate: false,
        touchZoomRotate: false,
      });
      mapRef.current = map;

      // Scroll-wheel zoom is deliberately OFF: the map sits inside a scrolling
      // tab panel, and a wheel over it would swallow the page scroll. Zoom is
      // via the buttons, or double-click.
      map.scrollZoom.disable();
      if (interactive) {
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      }

      // Tile host unreachable (it is a free third-party service) — fall back to
      // the address text rather than an endless grey box.
      map.on("error", (e) => {
        if (!cancelled && e?.error && !mapRef.current?.isStyleLoaded()) setTileError(key);
      });

      const el = document.createElement("div");
      el.style.cursor = "default";
      el.setAttribute("aria-hidden", "true");
      el.innerHTML = PIN_SVG;
      markerRef.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([lng, lat])
        .addTo(map);
    })();

    // The card sits in a bento layout that resizes with the window; the GL
    // canvas does not track its box on its own.
    const observer = new ResizeObserver(() => mapRef.current?.resize());
    observer.observe(container);

    return () => {
      cancelled = true;
      observer.disconnect();
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [lat, lng, zoom, interactive, key]);

  const retry = () => setAttempt((n) => n + 1);

  return (
    <div className={className}>
      <div
        className="relative overflow-hidden rounded-lg border border-[#e7e7ea] bg-[#f4f4f5]"
        style={{ height }}
      >
        {coords && !tilesFailed ? (
          <div ref={containerRef} className="h-full w-full" />
        ) : (
          <MapPlaceholder
            state={tilesFailed ? { status: "unavailable" } : location}
            line={line}
            onRetry={retry}
          />
        )}
      </div>

      {/* Links only. The map never narrates how confident it is — a caption
          hedging about what "could not be identified" makes staff distrust a
          pin that is, in practice, on the right street. Precision is still
          recorded in the cache, and it quietly sets the zoom. */}
      {showFooter && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]">
          <MapCredit />
          <span className="ml-auto flex items-center gap-3">
            {line && (
              <a
                href={directionsUrl(line)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[var(--accent-blue)] hover:underline"
              >
                Directions →
              </a>
            )}
            {what3words && (
              <a
                href={what3wordsUrl(what3words)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[var(--accent-blue)] hover:underline"
              >
                what3words →
              </a>
            )}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// The non-map states. Every one of them says what is wrong AND what to do —
// a blank grey rectangle is the worst possible answer to "where is this?".
// ---------------------------------------------------------------------------
function MapPlaceholder({
  state,
  line,
  onRetry,
}: {
  state: ResolvedLocation | null;
  line: string;
  onRetry: () => void;
}) {
  if (state === null) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <span className="animate-pulse text-[12px] text-[#a1a1aa]">Locating…</span>
      </div>
    );
  }

  const copy: Record<Exclude<ResolvedLocation["status"], "ok">, string> = {
    invalid: "Add an address to show it on the map.",
    "not-found": line
      ? `“${line}” could not be found on the map.`
      : "This address could not be found on the map.",
    unavailable: "The map service could not be reached.",
  };
  const status = state.status as Exclude<ResolvedLocation["status"], "ok">;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 px-4 text-center">
      <span className="text-[12px] text-[#71717a]">{copy[status]}</span>
      {status === "unavailable" && (
        <button
          type="button"
          onClick={onRetry}
          className="text-[11.5px] font-semibold text-[var(--accent-blue)] hover:underline"
        >
          Try again
        </button>
      )}
    </div>
  );
}

// The pin from the design export, re-used verbatim so the real map carries the
// same marker the illustrative one did — tenant accent, white centre.
const PIN_SVG = `<svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
  <path d="M13 0C5.8 0 0 5.8 0 13c0 9 13 21 13 21s13-12 13-21C26 5.8 20.2 0 13 0z" fill="var(--accent-blue)"/>
  <circle cx="13" cy="13" r="5" fill="#fff"/>
</svg>`;
