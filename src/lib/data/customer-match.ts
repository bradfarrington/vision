import { createClient } from "@/lib/supabase/server";
import { isCommercial } from "@/lib/format";

// ---------------------------------------------------------------------------
// "Is this someone we already know?"
//
// A lead is captured as loose details — a name, a number, an address — and only
// THEN matched against the customer book. Nobody remembers whether the 4,000th
// caller is a repeat customer, so the CRM has to recognise them instead.
//
// Two rules this module exists to hold:
//   - It only ever SUGGESTS. Linking is always an explicit click, because two
//     different Smiths in the same town are a real thing and silently merging
//     them is unrecoverable.
//   - It says WHY it matched ("Same mobile", "Same address"), so the person on
//     the phone can judge a suggestion instead of trusting a score.
// ---------------------------------------------------------------------------

/** What the capture step has so far. Every field is optional. */
export type MatchCriteria = {
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email?: string;
  mobile?: string;
  homeTelephone?: string;
  houseName?: string;
  houseNumber?: string;
  street?: string;
  town?: string;
  postcode?: string;
};

export type CustomerMatch = {
  id: string;
  name: string;
  customerNumber: number | null;
  addressLine: string | null;
  town: string | null;
  postcode: string | null;
  email: string | null;
  mobile: string | null;
  homeTelephone: string | null;
  leadCount: number;
  score: number;
  /** strong = a phone/email/address hit; possible = name or postcode alone. */
  strength: "strong" | "possible";
  /** Human reasons, shown on the candidate card. */
  reasons: string[];
  /** The customer's own values for the fields the capture step collects, so the
   *  review can diff them without a second read. */
  fields: MatchFields;
};

export type MatchFields = {
  title: string | null;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  customer_type: string | null;
  email: string | null;
  mobile: string | null;
  home_telephone: string | null;
  house_name: string | null;
  house_number: string | null;
  street: string | null;
  locality: string | null;
  town: string | null;
  county: string | null;
  postcode: string | null;
  what_3_words: string | null;
};

const MATCH_SELECT =
  "id, customer_number, title, first_name, last_name, company_name, customer_type, " +
  "email, phone, mobile, mobile_2, home_telephone, work_telephone, " +
  "house_name, house_number, street, locality, town, county, postcode, what_3_words, " +
  "leads(id)";

/** Score at or above which a candidate is near-certainly the same person. */
const STRONG = 50;
/** Below this a candidate is noise and is not shown at all. */
const FLOOR = 18;
const MAX_RESULTS = 6;
/** Candidate rows pulled back before scoring. */
const CANDIDATE_LIMIT = 80;

// --- normalising ------------------------------------------------------------
function norm(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

/** Last 9 digits — enough to equate 07700 900123, +447700900123 and 07700900123. */
function phoneKey(v: string | null | undefined): string {
  const digits = (v ?? "").replace(/\D/g, "");
  return digits.length >= 9 ? digits.slice(-9) : "";
}

function postKey(v: string | null | undefined): string {
  return (v ?? "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

/**
 * A LIKE pattern with a wildcard between every character, so a stored value
 * matches whatever spacing it happens to use — "B772RL" finds "B77 2RL", and
 * "07700900123" finds "07700 900123". Deliberately loose: it is a CANDIDATE
 * filter, and every hit is re-checked exactly in `score()` below.
 */
function loosePattern(chars: string): string {
  return `%${chars.split("").join("%")}%`;
}

/** Quote a value for a PostgREST or() term (comma/paren-delimited). */
function orValue(v: string): string {
  return `"${v.replace(/[\\"]/g, "\\$&")}"`;
}

// --- the query --------------------------------------------------------------
/**
 * Candidates for the details captured so far, best first.
 *
 * ONE query: an or() of every signal we have, deliberately loose, then scored
 * exactly in JS. The loose phone/postcode patterns can't use an index, so this
 * scans — fine at a few thousand customers, and the documented upgrade is a
 * normalised phone/postcode column with an index rather than a second query.
 */
export async function matchCustomers(c: MatchCriteria): Promise<CustomerMatch[]> {
  const terms: string[] = [];

  const lastName = norm(c.lastName);
  const companyName = norm(c.companyName);
  const email = norm(c.email);
  const post = postKey(c.postcode);
  const phones = [phoneKey(c.mobile), phoneKey(c.homeTelephone)].filter(Boolean);

  if (lastName.length >= 2) terms.push(`last_name.ilike.${orValue(lastName)}`, `last_name_2.ilike.${orValue(lastName)}`);
  if (companyName.length >= 3) terms.push(`company_name.ilike.${orValue(`%${companyName}%`)}`);
  if (email.includes("@")) terms.push(`email.ilike.${orValue(email)}`);
  if (post.length >= 5) {
    terms.push(`postcode.ilike.${orValue(loosePattern(post))}`);
  }
  for (const p of phones) {
    const pat = orValue(loosePattern(p));
    terms.push(
      `mobile.ilike.${pat}`,
      `mobile_2.ilike.${pat}`,
      `home_telephone.ilike.${pat}`,
      `work_telephone.ilike.${pat}`,
      `phone.ilike.${pat}`,
    );
  }

  // Nothing worth matching on yet — a bare first name is not a signal.
  if (terms.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select(MATCH_SELECT)
    .or(terms.join(","))
    .limit(CANDIDATE_LIMIT);
  if (error) throw new Error(`matchCustomers: ${error.message}`);

  return ((data ?? []) as unknown as CandidateRow[])
    .map((row) => toMatch(row, c))
    .filter((m) => m.score >= FLOOR)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, MAX_RESULTS);
}

/** One customer shaped as a match — for the `?customer=` deep link, which
 *  arrives already linked from a customer record's "New lead" button. */
export async function getCustomerAsMatch(id: string): Promise<CustomerMatch | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("customers")
    .select(MATCH_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getCustomerAsMatch: ${error.message}`);
  if (!data) return null;
  return toMatch(data as unknown as CandidateRow, {});
}

type CandidateRow = MatchFields & {
  id: string;
  customer_number: number | null;
  phone: string | null;
  mobile_2: string | null;
  work_telephone: string | null;
  last_name_2?: string | null;
  leads: { id: string }[] | null;
};

// --- scoring ----------------------------------------------------------------
function toMatch(row: CandidateRow, c: MatchCriteria): CustomerMatch {
  const reasons: string[] = [];
  let score = 0;

  // Contact details are identity: a shared mobile or email is as close to proof
  // as this gets, so they alone clear the "strong" bar.
  const typedPhones = [
    { key: phoneKey(c.mobile), label: "mobile" },
    { key: phoneKey(c.homeTelephone), label: "phone number" },
  ].filter((p) => p.key);
  const rowPhones = [row.mobile, row.mobile_2, row.home_telephone, row.work_telephone, row.phone]
    .map(phoneKey)
    .filter(Boolean);
  const phoneHit = typedPhones.find((p) => rowPhones.includes(p.key));
  if (phoneHit) {
    score += 60;
    reasons.push(`Same ${phoneHit.label}`);
  }

  const email = norm(c.email);
  if (email && email === norm(row.email)) {
    score += 55;
    reasons.push("Same email");
  }

  // Address: the postcode alone is a neighbourhood (~15 houses), so it is only
  // a weak signal until the house number or name agrees with it.
  const post = postKey(c.postcode);
  const samePostcode = post.length >= 5 && post === postKey(row.postcode);
  const sameHouse =
    (!!norm(c.houseNumber) && norm(c.houseNumber) === norm(row.house_number)) ||
    (!!norm(c.houseName) && norm(c.houseName) === norm(row.house_name));
  if (samePostcode && sameHouse) {
    score += 50;
    reasons.push("Same address");
  } else if (samePostcode) {
    score += 22;
    reasons.push("Same postcode");
  } else if (norm(c.street) && norm(c.street) === norm(row.street) && norm(c.town) === norm(row.town)) {
    score += 15;
    reasons.push("Same street");
  }

  const lastName = norm(c.lastName);
  const firstName = norm(c.firstName);
  if (lastName && lastName === norm(row.last_name)) {
    score += 20;
    if (firstName && firstName === norm(row.first_name)) {
      score += 18;
      reasons.push("Same name");
    } else {
      reasons.push("Same surname");
    }
  }

  const company = norm(c.companyName);
  if (company && company === norm(row.company_name)) {
    score += 45;
    reasons.push("Same company");
  }

  const person = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
  const name = isCommercial(row.customer_type)
    ? row.company_name || person || "Unnamed customer"
    : person || "Unnamed customer";

  return {
    id: row.id,
    name,
    customerNumber: row.customer_number,
    addressLine:
      [row.house_name, row.house_number, row.street].filter(Boolean).join(" ").trim() || null,
    town: row.town,
    postcode: row.postcode,
    email: row.email,
    mobile: row.mobile,
    homeTelephone: row.home_telephone,
    leadCount: (row.leads ?? []).length,
    score,
    strength: score >= STRONG ? "strong" : "possible",
    reasons,
    fields: {
      title: row.title,
      first_name: row.first_name,
      last_name: row.last_name,
      company_name: row.company_name,
      customer_type: row.customer_type,
      email: row.email,
      mobile: row.mobile,
      home_telephone: row.home_telephone,
      house_name: row.house_name,
      house_number: row.house_number,
      street: row.street,
      locality: row.locality,
      town: row.town,
      county: row.county,
      postcode: row.postcode,
      what_3_words: row.what_3_words,
    },
  };
}
