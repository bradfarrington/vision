"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker as MapLibreMarker } from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

import { Icon } from "./icon";
import { resolveAddress } from "@/app/(app)/geo/actions";
import {
  addressKey,
  addressLine,
  directionsUrl,
  streetViewUrl,
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
// ---------------------------------------------------------------------------

const DEFAULT_STYLE = "https://tiles.openfreemap.org/styles/positron";
const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || DEFAULT_STYLE;

// Street view inside the app needs Google's Maps EMBED API — the tier that is
// free and unmetered, unlike the Static API which bills per thumbnail. The key
// is public by necessity (it is an iframe URL the browser requests), so it MUST
// be locked to this app's domains with an HTTP-referrer restriction in Google
// Cloud, and restricted to the Maps Embed API alone. Without it the app falls
// back to the free link-out, so street view degrades rather than breaks.
const EMBED_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY;

/**
 * How far in to zoom for each quality of match — never further than we actually
 * know. This is the ONLY place the match precision shows itself: the map does
 * not editorialise about what the geocoder could or could not pin down. An
 * earlier build captioned street-level hits with "the exact building could not
 * be identified" and it was rejected on sight — a pin that is on the right
 * street reads as broken the moment the UI hedges about it, and that distrust
 * spreads to the exact ones too. The precision is still recorded in
 * `address_locations` if it is ever needed.
 */
const ZOOM_FOR: Record<MatchPrecision, number> = {
  address: 18,
  street: 17,
  postcode: 16,
  outcode: 12,
};

// ---------------------------------------------------------------------------
// MapCanvas — one MapLibre instance in a box.
//
// Split out so the inline card and the fullscreen overlay can each own their
// own map. Sharing a single instance between the two was the alternative and it
// is worse: moving a live GL canvas between containers means re-parenting the
// WebGL context, and the inline map would come back showing wherever the user
// had panned to full screen.
// ---------------------------------------------------------------------------
function MapCanvas({
  lat,
  lng,
  zoom,
  interactive = true,
  /** Wheel-zoom. On in fullscreen (nothing behind to scroll), off in a card. */
  scrollZoom = false,
  onTileError,
  className = "",
}: {
  lat: number;
  lng: number;
  zoom: number;
  interactive?: boolean;
  scrollZoom?: boolean;
  onTileError: () => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markerRef = useRef<MapLibreMarker | null>(null);

  // Latest-ref for the callback so the map is not torn down and rebuilt just
  // because the parent re-rendered and handed us a new closure.
  const tileErrorRef = useRef(onTileError);
  useEffect(() => {
    tileErrorRef.current = onTileError;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

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
        // See MapCredit below before changing this.
        attributionControl: false,
        // A rotated or tilted map helps nobody find a house, and a stray
        // two-finger drag spinning the view reads as a bug.
        dragRotate: false,
        pitchWithRotate: false,
        touchZoomRotate: false,
      });
      mapRef.current = map;

      // In a card, wheel-zoom is deliberately OFF: the map sits inside a
      // scrolling tab panel and would swallow the page scroll. Full screen has
      // no page behind it, so the wheel is free to do the obvious thing.
      if (scrollZoom) map.scrollZoom.enable();
      else map.scrollZoom.disable();

      if (interactive) {
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      }

      // Tile host unreachable (it is a free third-party service) — the parent
      // falls back to the address text rather than an endless grey box.
      map.on("error", (e) => {
        if (!cancelled && e?.error && !mapRef.current?.isStyleLoaded()) tileErrorRef.current();
      });

      const el = document.createElement("div");
      el.style.cursor = "default";
      el.setAttribute("aria-hidden", "true");
      el.innerHTML = PIN_SVG;
      markerRef.current = new maplibregl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([lng, lat])
        .addTo(map);
    })();

    // The card sits in a bento layout that resizes with the window, and the
    // overlay resizes with it too; the GL canvas does not track its box.
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
  }, [lat, lng, zoom, interactive, scrollZoom]);

  return <div ref={containerRef} className={`h-full w-full ${className}`} />;
}

type AddressMapProps = AddressInput & {
  /** what3words reference, if the record holds one. */
  what3words?: string | null;
  /** Height of the map canvas. Fixed by design — a map must never grow with the data. */
  height?: number;
  /** Drag/zoom. Off gives a static locator thumbnail. */
  interactive?: boolean;
  /** The credit + links strip under the canvas. */
  showFooter?: boolean;
  /** The expand-to-fullscreen button. */
  allowFullscreen?: boolean;
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
  allowFullscreen = true,
  className = "",
}: AddressMapProps) {
  // Bumped by "Try again" to re-run the lookup after a transient failure.
  const [attempt, setAttempt] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

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

  // --- Address → coordinates (server action, read-through DB cache) ----------
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
  const zoom = coords ? ZOOM_FOR[coords.precision] : 15;
  const showMap = coords && !tilesFailed;

  return (
    <div className={className}>
      <div
        className="relative overflow-hidden rounded-lg border border-[#e7e7ea] bg-[#f4f4f5]"
        style={{ height }}
      >
        {showMap ? (
          <>
            <MapCanvas
              lat={coords.lat}
              lng={coords.lng}
              zoom={zoom}
              interactive={interactive}
              onTileError={() => setTileError(key)}
            />
            {allowFullscreen && (
              // Top-LEFT: the zoom control owns the top-right corner.
              <button
                type="button"
                onClick={() => setFullscreen(true)}
                aria-label="Expand map"
                title="Expand map"
                className="absolute left-2.5 top-2.5 inline-flex size-7 items-center justify-center rounded-md border border-[#e7e7ea] bg-white/95 text-[#3f3f46] shadow-[0_1px_3px_rgba(10,10,10,0.12)] transition-colors hover:text-[var(--accent-blue)]"
              >
                <Icon name="maximize" size={14} strokeWidth={2} />
              </button>
            )}
          </>
        ) : (
          <MapPlaceholder
            state={tilesFailed ? { status: "unavailable" } : location}
            line={line}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        )}
      </div>

      {/* Links only. Precision is never narrated — it quietly sets the zoom. */}
      {showFooter && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]">
          <MapCredit />
          <span className="ml-auto flex items-center gap-3">
            {coords && <StreetViewLink lat={coords.lat} lng={coords.lng} />}
            {line && <DirectionsLink line={line} />}
            {what3words && <What3WordsLink words={what3words} />}
          </span>
        </div>
      )}

      {fullscreen && showMap && (
        <FullscreenMap
          lat={coords.lat}
          lng={coords.lng}
          zoom={zoom}
          line={line}
          what3words={what3words}
          onTileError={() => setTileError(key)}
          onClose={() => setFullscreen(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Fullscreen overlay — same pattern as the document viewer's FullscreenViewer.
//
// Deliberately NOT a portal to document.body. The pin is filled with
// `var(--accent-blue)`, which is set as an inline style on the app shell root
// (tenantThemeVars); a portal would render the marker outside that root and it
// would silently fall back to the platform blue for every tenant with their own
// brand colour. `fixed inset-0` covers the viewport just as well from inside
// the tree, and keeps the theme.
// ---------------------------------------------------------------------------
function FullscreenMap({
  lat,
  lng,
  zoom,
  line,
  what3words,
  onTileError,
  onClose,
}: {
  lat: number;
  lng: number;
  zoom: number;
  line: string;
  what3words?: string | null;
  onTileError: () => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<"map" | "street">("map");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0a0a0a]/90 backdrop-blur-sm">
      <div className="flex items-center gap-3 px-4 py-3 text-white">
        <Icon name="map-pin" size={16} strokeWidth={1.75} className="text-white/70" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{line}</span>

        {/* Street view is a VIEW of this location, not a trip somewhere else —
            so it toggles in place rather than sitting beside Directions as
            another link out. Without an embed key there is nothing to toggle
            to, and the link-out below stands in for it. */}
        {EMBED_KEY && (
          <div className="flex items-center rounded-lg border border-white/20 bg-white/5 p-0.5">
            {(["map", "street"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded-[6px] px-2.5 py-1 text-[12.5px] font-semibold transition-colors ${
                  view === v ? "bg-white text-[#0a0a0a]" : "text-white/80 hover:text-white"
                }`}
              >
                {v === "map" ? "Map" : "Street view"}
              </button>
            ))}
          </div>
        )}

        {!EMBED_KEY && <StreetViewLink lat={lat} lng={lng} dark />}
        {line && <DirectionsLink line={line} dark />}
        {what3words && <What3WordsLink words={what3words} dark />}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-white/5 text-white transition-colors hover:bg-white/15"
        >
          <Icon name="x" size={16} strokeWidth={2} />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {view === "street" && EMBED_KEY ? (
          <StreetViewPane lat={lat} lng={lng} />
        ) : (
          <>
            <MapCanvas lat={lat} lng={lng} zoom={zoom} scrollZoom onTileError={onTileError} />
            {/* The credit follows the map wherever it goes — the card's footer
                line is not on screen here, so it has to be restated. Street
                view is Google's, and carries its own. */}
            <span className="pointer-events-auto absolute bottom-2 left-3">
              <MapCredit dark />
            </span>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Navigable Street View, embedded.
 *
 * Google's Maps Embed API — the tier that is **free and unmetered**, unlike the
 * Street View Static API which bills per thumbnail. The pano is fully
 * interactive: look around, and walk up and down the street with the arrows, so
 * a surveyor can get to the front of the property even when the nearest
 * panorama is a few doors down.
 *
 * `heading` is deliberately NOT set. Given a bare location, Google aims the
 * camera from the nearest panorama TOWARDS that point — which is the front of
 * the building. Passing a heading of our own would need the bearing from the
 * road to the house, which we do not know, and would face the camera at a
 * hedge as often as at the property.
 *
 * Coverage is not pre-checked (that needs the keyed metadata endpoint), so
 * where Google has no imagery this shows their "no imagery" state. The link out
 * to full Google Maps is there as the escape hatch.
 */
function StreetViewPane({ lat, lng }: { lat: number; lng: number }) {
  const src = `https://www.google.com/maps/embed/v1/streetview?key=${EMBED_KEY}&location=${lat},${lng}&fov=90`;
  return (
    <div className="relative h-full w-full">
      <iframe
        key={src}
        src={src}
        title="Street view"
        loading="lazy"
        allowFullScreen
        // Google's referrer restrictions need the origin to survive the request.
        referrerPolicy="no-referrer-when-downgrade"
        className="h-full w-full border-0"
      />
      <span className="absolute bottom-2 right-3">
        <StreetViewLink lat={lat} lng={lng} dark />
      </span>
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

// ---------------------------------------------------------------------------
// Footer bits
// ---------------------------------------------------------------------------

function DirectionsLink({ line, dark = false }: { line: string; dark?: boolean }) {
  return (
    <a
      href={directionsUrl(line)}
      target="_blank"
      rel="noopener noreferrer"
      className={
        dark
          ? "rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-white/15"
          : "font-semibold text-[var(--accent-blue)] hover:underline"
      }
    >
      Directions →
    </a>
  );
}

function StreetViewLink({
  lat,
  lng,
  dark = false,
}: {
  lat: number;
  lng: number;
  dark?: boolean;
}) {
  return (
    <a
      href={streetViewUrl(lat, lng)}
      target="_blank"
      rel="noopener noreferrer"
      className={
        dark
          ? "rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-white/15"
          : "font-semibold text-[var(--accent-blue)] hover:underline"
      }
    >
      Street view →
    </a>
  );
}

function What3WordsLink({ words, dark = false }: { words: string; dark?: boolean }) {
  return (
    <a
      href={what3wordsUrl(words)}
      target="_blank"
      rel="noopener noreferrer"
      className={
        dark
          ? "rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-white/15"
          : "font-semibold text-[var(--accent-blue)] hover:underline"
      }
    >
      what3words →
    </a>
  );
}

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
 * and crediting it is a licence condition, not a preference — and the notice is
 * owed to the people VIEWING the map, so a comment in the source would not
 * satisfy it. The OSM Foundation's guidelines allow that credit to sit
 * *adjacent to* the map rather than on it, so `attributionControl: false` takes
 * it off the canvas and this puts it in the fine print, where it looks like
 * part of our UI.
 *
 * If a future provider forbids adjacent attribution (Google and Mapbox both
 * mandate an on-canvas logo), that provider's rules win — do not reuse this.
 */
function MapCredit({ dark = false }: { dark?: boolean }) {
  return (
    <a
      href="https://www.openstreetmap.org/copyright"
      target="_blank"
      rel="noopener noreferrer"
      className={
        dark
          ? "text-[10px] text-white/35 hover:text-white/80 hover:underline"
          : "text-[10px] text-[#c4c4c8] hover:text-[#71717a] hover:underline"
      }
    >
      © OpenStreetMap
    </a>
  );
}

// The pin from the design export, re-used verbatim so the real map carries the
// same marker the illustrative one did. `var(--accent-blue)` resolves through
// inheritance from the app shell root, so the pin is the TENANT's brand colour
// — which is why this must never render through a portal (see FullscreenMap).
const PIN_SVG = `<svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
  <path d="M13 0C5.8 0 0 5.8 0 13c0 9 13 21 13 21s13-12 13-21C26 5.8 20.2 0 13 0z" fill="var(--accent-blue)"/>
  <circle cx="13" cy="13" r="5" fill="#fff"/>
</svg>`;
