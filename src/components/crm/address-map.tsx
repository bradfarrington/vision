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
// TWO renderers, and the split is by SURFACE, not by deployment:
//
//   The CARD is always MapLibre GL + OpenStreetMap.
//     This is the surface staff look at all day, so it is the one that has to
//     stay quiet: the marker is the TENANT'S accent colour, and the credit is
//     10px of grey in the footer. Free at any volume, however many records get
//     opened.
//
//   FULLSCREEN is Google's Maps Embed API, when a key is configured.
//     Map / Satellite / Street view, all free and unmetered. A Google logo on a
//     full-screen view barely registers, and street view is the whole reason
//     anyone opens it. Without a key, fullscreen falls back to MapLibre and
//     street view becomes a link out.
//
// Why not Google everywhere (tried on 2026-07-22, reverted the same day):
// Google's logo and Terms links are contractually unremovable — unlike OSM,
// whose licence explicitly allows the credit to sit adjacent to the map — and
// an Embed iframe cannot be styled at all (it supports no Map IDs), so the pin
// can never be the tenant's colour. All-Google traded a 10px grey line for a
// permanent watermark on every record.
//
// MapLibre is ~200KB gzipped, so it is imported DYNAMICALLY inside the effect —
// a screen with no map never downloads the renderer.
// ---------------------------------------------------------------------------

const DEFAULT_STYLE = "https://tiles.openfreemap.org/styles/positron";
const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || DEFAULT_STYLE;

// ---------------------------------------------------------------------------
// Google Maps EMBED API — FULLSCREEN ONLY.
//
// Every mode of the Embed API (roadmap, satellite, street view) is free and
// unmetered, which is why fullscreen can offer all three at no cost. Do NOT
// swap these iframes for the Maps JavaScript API without pricing it: the JS API
// bills per map load, and a map load would happen on every record view forever.
//
// It is confined to fullscreen because of what it costs on a card:
//   * the marker is Google's red pin, and CANNOT be the tenant accent — an
//     iframe is not ours to style, and the Embed API supports no Map IDs, so
//     cloud-based map styling does not reach it either.
//   * Google's logo and Terms links sit on the canvas and are contractually
//     unremovable at every tier, including the JS API. Unlike OSM, whose
//     licence allows the credit to sit adjacent to the map.
//   * nothing in the iframe is programmable, so a future drag-to-pin cannot be
//     built on it — that needs the (metered) JS API or the MapLibre path.
//
// The key is public by necessity (the browser fetches the iframe), so it MUST
// be restricted in Google Cloud to the Maps Embed API and to this app's domains
// by HTTP referrer.
const EMBED_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY;

/** Fullscreen gets Google's satellite + street view only if a key is present. */
const USE_GOOGLE_FULLSCREEN = !!EMBED_KEY;

type GoogleView = "roadmap" | "satellite" | "streetview";

const GOOGLE_VIEW_LABEL: Record<GoogleView, string> = {
  roadmap: "Map",
  satellite: "Satellite",
  streetview: "Street view",
};

function googleEmbedSrc(view: GoogleView, lat: number, lng: number, zoom: number): string {
  if (view === "streetview") {
    // `heading` is deliberately unset: given a bare location Google aims the
    // camera from the nearest panorama TOWARDS that point, i.e. at the front of
    // the building. Supplying our own needs the bearing from road to house,
    // which we do not know, and would face a hedge as often as the property.
    return `https://www.google.com/maps/embed/v1/streetview?key=${EMBED_KEY}&location=${lat},${lng}&fov=90`;
  }
  // `place` rather than `view` — it is the mode that drops a marker.
  return `https://www.google.com/maps/embed/v1/place?key=${EMBED_KEY}&q=${lat},${lng}&zoom=${zoom}&maptype=${view}`;
}

function GoogleEmbed({
  view,
  lat,
  lng,
  zoom,
  title,
}: {
  view: GoogleView;
  lat: number;
  lng: number;
  zoom: number;
  title: string;
}) {
  const src = googleEmbedSrc(view, lat, lng, zoom);
  return (
    <iframe
      // Keyed by src: changing an iframe's hash/query does not always reload it.
      key={src}
      src={src}
      title={title}
      loading="lazy"
      allowFullScreen
      // Google's referrer key restriction needs the origin to survive the request.
      referrerPolicy="no-referrer-when-downgrade"
      className="h-full w-full border-0"
    />
  );
}

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
  // `null` = closed. Otherwise it is the view the overlay OPENS ON, so the
  // footer's "Street view" goes straight to the pano rather than landing on the
  // map and making the user hunt for the toggle.
  const [fullscreen, setFullscreen] = useState<GoogleView | null>(null);

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
            {/* Always MapLibre here — see the header comment. The card is the
                surface staff see all day, so it keeps the tenant-accent pin and
                the 10px credit rather than a permanent Google watermark. */}
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
                onClick={() => setFullscreen("roadmap")}
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
            {/* Street view is a view of THIS property, so it opens our own
                overlay on the pano. Sending staff to a new Google Maps tab
                loses the record they were reading. Only when there is no embed
                key does it fall back to being a link out. */}
            {coords &&
              (USE_GOOGLE_FULLSCREEN ? (
                <button
                  type="button"
                  onClick={() => setFullscreen("streetview")}
                  className="font-semibold text-[var(--accent-blue)] hover:underline"
                >
                  Street view →
                </button>
              ) : (
                <StreetViewLink lat={coords.lat} lng={coords.lng} />
              ))}
            {line && <DirectionsLink line={line} />}
            {what3words && <What3WordsLink words={what3words} />}
          </span>
        </div>
      )}

      {fullscreen && showMap && (
        <FullscreenMap
          initialView={fullscreen}
          lat={coords.lat}
          lng={coords.lng}
          zoom={zoom}
          line={line}
          what3words={what3words}
          onTileError={() => setTileError(key)}
          onClose={() => setFullscreen(null)}
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
  initialView,
  lat,
  lng,
  zoom,
  line,
  what3words,
  onTileError,
  onClose,
}: {
  initialView: GoogleView;
  lat: number;
  lng: number;
  zoom: number;
  line: string;
  what3words?: string | null;
  onTileError: () => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<GoogleView>(initialView);

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

        {/* Satellite and street view are VIEWS of this location, not trips
            somewhere else — so they toggle in place rather than sitting beside
            Directions as more links out. Without an embed key there is nothing
            to toggle to, and the link-out stands in for street view. */}
        {USE_GOOGLE_FULLSCREEN ? (
          <div className="flex items-center rounded-lg border border-white/20 bg-white/5 p-0.5">
            {(["roadmap", "satellite", "streetview"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded-[6px] px-2.5 py-1 text-[12.5px] font-semibold transition-colors ${
                  view === v ? "bg-white text-[#0a0a0a]" : "text-white/80 hover:text-white"
                }`}
              >
                {GOOGLE_VIEW_LABEL[v]}
              </button>
            ))}
          </div>
        ) : (
          <StreetViewLink lat={lat} lng={lng} dark />
        )}
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
        {USE_GOOGLE_FULLSCREEN ? (
          <GoogleEmbed
            view={view}
            lat={lat}
            lng={lng}
            // Satellite is the "what does the plot actually look like" view, so
            // it opens a step tighter than the road map.
            zoom={view === "satellite" ? Math.min(zoom + 1, 20) : zoom}
            title={GOOGLE_VIEW_LABEL[view]}
          />
        ) : (
          <>
            <MapCanvas lat={lat} lng={lng} zoom={zoom} scrollZoom onTileError={onTileError} />
            {/* The credit follows the map wherever it goes — the card's footer
                line is not on screen here, so it has to be restated. */}
            <span className="pointer-events-auto absolute bottom-2 left-3">
              <MapCredit dark />
            </span>
          </>
        )}
      </div>
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
