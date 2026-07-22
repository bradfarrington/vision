// ---------------------------------------------------------------------------
// Geocoding — a full UK address → coordinates, and the outbound map links.
//
// Provider chain, best match first:
//   1. Nominatim STRUCTURED search (house + street / town / postcode) — this is
//      what puts the pin on the actual building.
//   2. Nominatim free-text search of the whole address line — catches records
//      whose parts are split across the wrong columns.
//   3. postcodes.io postcode centroid — the safety net, and honestly labelled
//      as approximate in the UI, because it is the middle of ~15 houses.
//
// Neither provider needs an API key or an account, which is why they are here.
// The cost is coverage: OpenStreetMap has excellent UK street data and good but
// NOT complete house-number data, so some addresses legitimately fall through
// to step 3. A guaranteed door-level answer for every UK address needs a keyed
// commercial geocoder (Ordnance Survey Places, Google, getAddress.io) — the
// swap is confined to `geocodeAddress` below and nothing else in the app.
//
// Nominatim's usage policy: identify yourself, no more than one request per
// second, no bulk geocoding. We satisfy it because every result is cached in
// the database forever — an address is geocoded ONCE, then never again.
// ---------------------------------------------------------------------------

/** How precisely we actually know where this is. Drives zoom AND the caption. */
export type MatchPrecision = "address" | "street" | "postcode" | "outcode";

export type GeoPoint = {
  lat: number;
  lng: number;
  precision: MatchPrecision;
  /** What the geocoder says it matched, e.g. "10, Downing Street, Westminster". */
  place: string | null;
};

/**
 * The answer a map component gets back. The failure modes are deliberately
 * distinct: "we don't know where this is" and "we couldn't ask" need different
 * UI and different caching, and collapsing them into `null` loses that.
 *
 * Lives here rather than beside the server action because a `"use server"`
 * module may only export async functions.
 */
export type ResolvedLocation =
  | { status: "ok"; lat: number; lng: number; precision: MatchPrecision; place: string | null }
  | { status: "not-found" }
  | { status: "invalid" }
  | { status: "unavailable" };

/** The address fields a record holds. Every one is optional — records are messy. */
export type AddressInput = {
  houseName?: string | null;
  houseNumber?: string | null;
  street?: string | null;
  locality?: string | null;
  town?: string | null;
  county?: string | null;
  postcode?: string | null;
};

// ---------------------------------------------------------------------------
// Address shaping
// ---------------------------------------------------------------------------

const clean = (v: string | null | undefined) => v?.trim() || null;

/**
 * The first line as a geocoder expects it: "3 Cathedral Close", or
 * "Rose Cottage, Church Lane" when the property is named rather than numbered.
 */
export function streetLine(a: AddressInput): string | null {
  const number = clean(a.houseNumber);
  const name = clean(a.houseName);
  const street = clean(a.street);
  if (!street) return number ?? name;
  if (number) return `${number} ${street}`;
  if (name) return `${name}, ${street}`;
  return street;
}

/** Join the address parts into one human line, for display and directions links. */
export function addressLine(a: AddressInput): string {
  return [streetLine(a), clean(a.locality), clean(a.town), clean(a.county), clean(a.postcode)]
    .filter((p): p is string => !!p)
    .join(", ");
}

/**
 * The cache key. Case, punctuation and spacing vary constantly in typed
 * addresses ("3 Cathedral Cl." vs "3 Cathedral Close,"), and without
 * normalising them the cache fills with duplicate rows for one house.
 */
export function addressKey(a: AddressInput): string | null {
  const line = addressLine(a)
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return line || null;
}

/**
 * Normalise a UK postcode to its canonical form — uppercase, exactly one space
 * before the three-character inward code.
 */
export function normalisePostcode(input: string | null | undefined): string | null {
  if (!input) return null;
  const compact = input.replace(/\s+/g, "").toUpperCase();
  // Shortest valid UK postcode is 5 chars (e.g. M1 1AA), longest 7.
  if (compact.length < 5 || compact.length > 7) return null;
  if (!/^[A-Z0-9]+$/.test(compact)) return null;
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

/** The outward code — "WS13" from "WS13 7LD". */
export function outcodeOf(postcode: string): string | null {
  const normalised = normalisePostcode(postcode);
  return normalised ? normalised.split(" ")[0] : null;
}

// ---------------------------------------------------------------------------
// Providers
// ---------------------------------------------------------------------------

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const POSTCODES_IO = "https://api.postcodes.io";

// Nominatim requires a genuine identifying User-Agent and will block generic
// ones. Point it at this deployment so their admins can reach a human.
const USER_AGENT = `VisionCRM/1.0 (+${process.env.NEXT_PUBLIC_SITE_URL || "https://getvision.uk"})`;

// Coordinates for a building do not move, so the fetch layer may hold them for
// a month. The real cache is `address_locations` in the database.
const FETCH_OPTS: RequestInit & { next?: { revalidate: number } } = {
  headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  next: { revalidate: 60 * 60 * 24 * 30 },
};

/** `null` = a clean "no result"; `undefined` = could not reach the service. */
async function getJson<T>(url: string): Promise<T | null | undefined> {
  try {
    const res = await fetch(url, FETCH_OPTS);
    if (res.status === 404) return null;
    if (!res.ok) return undefined;
    return (await res.json()) as T;
  } catch {
    return undefined;
  }
}

type NominatimHit = {
  lat: string;
  lon: string;
  display_name?: string;
  address?: {
    house_number?: string;
    house_name?: string;
    building?: string;
    road?: string;
    suburb?: string;
    village?: string;
    town?: string;
    city?: string;
    county?: string;
    postcode?: string;
  };
};

/** A short, readable version of what was matched — the first three parts. */
function hitLabel(hit: NominatimHit): string | null {
  const a = hit.address;
  if (a) {
    const first = [a.house_number, a.road].filter(Boolean).join(" ") || a.building || a.house_name;
    const place = a.village || a.town || a.city || a.suburb;
    const label = [first, place, a.postcode].filter(Boolean).join(", ");
    if (label) return label;
  }
  return hit.display_name?.split(",").slice(0, 3).join(",").trim() || null;
}

/** House number present = we found the building; a road alone = the street. */
function hitPrecision(hit: NominatimHit): MatchPrecision {
  const a = hit.address ?? {};
  if (a.house_number || a.house_name || a.building) return "address";
  if (a.road) return "street";
  return "postcode";
}

function toPoint(hit: NominatimHit): GeoPoint | null {
  const lat = Number(hit.lat);
  const lng = Number(hit.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng, precision: hitPrecision(hit), place: hitLabel(hit) };
}

async function nominatim(params: Record<string, string>): Promise<GeoPoint | null | undefined> {
  const qs = new URLSearchParams({
    format: "jsonv2",
    addressdetails: "1",
    limit: "1",
    countrycodes: "gb",
    ...params,
  });
  const hits = await getJson<NominatimHit[]>(`${NOMINATIM}?${qs}`);
  if (hits === undefined) return undefined;
  if (!hits || hits.length === 0) return null;
  return toPoint(hits[0]);
}

// ---------------------------------------------------------------------------
// Google Geocoding — the optional door-level upgrade.
//
// OpenStreetMap's UK house-number coverage is good but not complete, so some
// addresses honestly resolve only to their street. Set GOOGLE_MAPS_API_KEY and
// every lookup goes to Google instead, which has AddressBase-grade UK premise
// data and returns ROOFTOP coordinates. Nothing else in the app changes, and
// the database cache means one paid call per address per tenant, ever.
//
// The key is server-only (no NEXT_PUBLIC_ prefix) — it is never shipped to the
// browser, so it needs no HTTP-referrer restriction, only an API restriction to
// the Geocoding API.
// ---------------------------------------------------------------------------
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

type GoogleResult = {
  formatted_address?: string;
  address_components?: { long_name: string; types: string[] }[];
  geometry?: {
    location?: { lat: number; lng: number };
    location_type?: "ROOFTOP" | "RANGE_INTERPOLATED" | "GEOMETRIC_CENTER" | "APPROXIMATE";
  };
};

/** Google states its own confidence, so we do not have to infer it. */
const GOOGLE_PRECISION: Record<string, MatchPrecision> = {
  ROOFTOP: "address",
  RANGE_INTERPOLATED: "address",
  GEOMETRIC_CENTER: "street",
  APPROXIMATE: "postcode",
};

async function google(line: string): Promise<GeoPoint | null | undefined> {
  const qs = new URLSearchParams({
    address: line,
    region: "gb",
    components: "country:GB",
    key: GOOGLE_KEY as string,
  });
  const body = await getJson<{ status: string; results?: GoogleResult[] }>(
    `https://maps.googleapis.com/maps/api/geocode/json?${qs}`,
  );
  if (body === undefined) return undefined;
  if (!body) return null;
  if (body.status === "ZERO_RESULTS") return null;
  // A denied key or an exhausted quota is an outage, not a missing address —
  // returning `null` here would poison the cache with a permanent negative.
  if (body.status !== "OK" || !body.results?.length) return undefined;

  const hit = body.results[0];
  const loc = hit.geometry?.location;
  if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) return null;
  return {
    lat: loc.lat,
    lng: loc.lng,
    precision: GOOGLE_PRECISION[hit.geometry?.location_type ?? ""] ?? "postcode",
    place: hit.formatted_address?.split(",").slice(0, 3).join(",").trim() || null,
  };
}

type PostcodesIoResult = {
  latitude: number | null;
  longitude: number | null;
  admin_ward?: string | null;
  admin_district?: string | null;
  region?: string | null;
};

/** Postcode (or, failing that, outward-code) centroid. The last resort. */
async function postcodeCentroid(postcode: string): Promise<GeoPoint | null | undefined> {
  const normalised = normalisePostcode(postcode);
  if (!normalised) return null;

  const label = (r: PostcodesIoResult) => {
    const parts = [...new Set([r.admin_ward, r.admin_district].filter(Boolean))];
    return parts.length ? (parts.slice(0, 2).join(", ") as string) : null;
  };

  const exact = await getJson<{ result?: PostcodesIoResult }>(
    `${POSTCODES_IO}/postcodes/${encodeURIComponent(normalised)}`,
  );
  if (exact === undefined) return undefined;
  if (exact?.result?.latitude != null && exact.result.longitude != null) {
    return {
      lat: exact.result.latitude,
      lng: exact.result.longitude,
      precision: "postcode",
      place: label(exact.result),
    };
  }

  // Unit unknown (a typo, or a new build not in the dataset yet) — the outward
  // code at least puts the map in the right town instead of showing nothing.
  const outcode = outcodeOf(normalised);
  if (!outcode) return null;
  const area = await getJson<{ result?: PostcodesIoResult }>(
    `${POSTCODES_IO}/outcodes/${encodeURIComponent(outcode)}`,
  );
  if (area === undefined) return undefined;
  if (area?.result?.latitude != null && area.result.longitude != null) {
    return {
      lat: area.result.latitude,
      lng: area.result.longitude,
      precision: "outcode",
      place: label(area.result),
    };
  }
  return null;
}

/**
 * Geocode a full address.
 *
 *   a GeoPoint  — found, at the precision it reports.
 *   `null`      — the providers answered, and none of them knows this address.
 *   `undefined` — could not reach a provider. NOT a cacheable result.
 */
export async function geocodeAddress(
  address: AddressInput,
): Promise<GeoPoint | null | undefined> {
  const postcode = normalisePostcode(address.postcode);
  const street = streetLine(address);
  const town = clean(address.town) ?? clean(address.locality);
  let unreachable = false;

  // 0. Google, when a key is configured — it answers at roof level far more
  //    often than OSM, so there is no reason to try the others first.
  if (GOOGLE_KEY) {
    const line = addressLine(address);
    if (line) {
      const hit = await google(line);
      if (hit) return hit;
      if (hit === undefined) unreachable = true;
      // A clean ZERO_RESULTS falls through to the free chain rather than
      // giving up — between them they cover more than either alone.
    }
  }

  // 1. Structured — the strongest signal, because the geocoder is told which
  //    part is the street and which is the town rather than guessing.
  if (street && (postcode || town)) {
    const structured = await nominatim({
      street,
      ...(town ? { city: town } : {}),
      ...(clean(address.county) ? { county: clean(address.county) as string } : {}),
      ...(postcode ? { postalcode: postcode } : {}),
    });
    if (structured === undefined) unreachable = true;
    else if (structured?.precision === "address") return structured;
    // A street-level structured hit is held back: the free-text pass below
    // often does better, and we would rather return the building.
    else if (structured) {
      const freeText = await nominatim({ q: addressLine(address) });
      if (freeText?.precision === "address") return freeText;
      return structured;
    }
  }

  // 2. Free text — for records whose parts landed in the wrong columns.
  const line = addressLine(address);
  if (line) {
    const freeText = await nominatim({ q: line });
    if (freeText === undefined) unreachable = true;
    else if (freeText) return freeText;
  }

  // 3. Postcode centroid.
  if (postcode) {
    const centroid = await postcodeCentroid(postcode);
    if (centroid === undefined) unreachable = true;
    else if (centroid) return centroid;
  }

  if (unreachable) return undefined;
  return null;
}

// ---------------------------------------------------------------------------
// Outbound links — the map shows where it is, these get someone there.
// ---------------------------------------------------------------------------

/** Google Maps driving directions to an address. */
export function directionsUrl(destination: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/**
 * Google Street View, opened at our pin.
 *
 * OpenStreetMap has no street-level imagery of its own, and the open
 * alternatives (Mapillary, KartaView, Panoramax) are contributor-driven, so UK
 * residential coverage is patchy — they fail on exactly the estates a surveyor
 * needs. This is Google's documented Maps URLs scheme: no API key, no billing,
 * nothing metered, because it just deep-links their app.
 *
 * Coverage is NOT checked first — that needs the keyed Street View metadata
 * endpoint. Where there is no imagery Google lands on the map instead, which is
 * a soft landing, so the link is always offered.
 */
export function streetViewUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lng}`;
}

/** what3words location, e.g. "filled.count.soap" → its map. */
export function what3wordsUrl(words: string): string {
  return `https://what3words.com/${encodeURIComponent(words.replace(/^\/+/, ""))}`;
}
