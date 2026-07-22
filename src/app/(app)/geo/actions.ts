/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { createClient } from "@/lib/supabase/server";
import { getCompanyId } from "@/lib/company";
import {
  addressKey,
  addressLine,
  geocodeAddress,
  normalisePostcode,
  type AddressInput,
  type GeoPoint,
  type MatchPrecision,
  type ResolvedLocation,
} from "@/lib/geo";

// ---------------------------------------------------------------------------
// Address resolution — the one entry point every map in the CRM calls.
//
// Read-through cache: ask `address_locations` first, only hit the geocoder on a
// miss, then write the answer back. An address is therefore geocoded once per
// tenant, ever, and every subsequent map anywhere in the app is a single
// indexed select. That is what keeps the free providers' fair-use policies
// satisfied at CRM scale.
//
// The geocoder is never called from the browser: it runs here so a tenant's
// customer addresses are not broadcast from staff machines to a third party,
// and so the cache is shared across users rather than per-session.
// ---------------------------------------------------------------------------

/** Re-check an address we previously failed to find after this long — OSM gains
 *  house-number coverage over time, so a negative is not forever. */
const NEGATIVE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const PRECISIONS: MatchPrecision[] = ["address", "street", "postcode", "outcode"];
const asPrecision = (v: unknown): MatchPrecision =>
  PRECISIONS.includes(v as MatchPrecision) ? (v as MatchPrecision) : "postcode";

export async function resolveAddress(address: AddressInput): Promise<ResolvedLocation> {
  const key = addressKey(address);
  if (!key) return { status: "invalid" };

  const companyId = await getCompanyId();
  if (!companyId) return { status: "unavailable" };

  const supabase = await createClient();
  const db = supabase as any;

  const { data: cached } = await db
    .from("address_locations")
    .select("latitude, longitude, match_precision, place, checked_at")
    .eq("address_key", key)
    .maybeSingle();

  if (cached) {
    if (cached.latitude != null && cached.longitude != null) {
      return {
        status: "ok",
        lat: cached.latitude,
        lng: cached.longitude,
        precision: asPrecision(cached.match_precision),
        place: cached.place ?? null,
      };
    }
    // Cached negative — honour it until the TTL is up.
    const age = Date.now() - new Date(cached.checked_at).getTime();
    if (age < NEGATIVE_TTL_MS) return { status: "not-found" };
  }

  const found: GeoPoint | null | undefined = await geocodeAddress(address);

  // Provider unreachable. Say so, and cache nothing — a network blip must not
  // become a permanent "this address doesn't exist".
  if (found === undefined) return { status: "unavailable" };

  await db.from("address_locations").upsert(
    {
      company_id: companyId,
      address_key: key,
      address_line: addressLine(address),
      postcode: normalisePostcode(address.postcode),
      latitude: found?.lat ?? null,
      longitude: found?.lng ?? null,
      match_precision: found?.precision ?? null,
      place: found?.place ?? null,
      checked_at: new Date().toISOString(),
    },
    { onConflict: "company_id,address_key" },
  );

  if (!found) return { status: "not-found" };
  return {
    status: "ok",
    lat: found.lat,
    lng: found.lng,
    precision: found.precision,
    place: found.place,
  };
}
