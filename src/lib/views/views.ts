// ---------------------------------------------------------------------------
// Saved views — the shared model.
//
// A view is a NAMED bundle of everything that shapes a list screen: its query
// (filters, advanced conditions, date range, sort, list-vs-board) and its column
// layout. Selecting one EXPANDS its query into the URL, so the server keeps
// reading plain params and knows nothing about views — which means the URL stays
// shareable and the back button keeps working.
//
// `sv=<id>` rides alongside, recording which view is loaded so the screen can
// tell "this is the saved view" from "this is the saved view plus two changes".
// ---------------------------------------------------------------------------

export type ViewEntity = "leads" | "customers";

/** The URL params a view owns. Everything else is transient or bookkeeping. */
export type ViewQuery = Record<string, string>;

export type ViewColumns = { order: string[]; widths: Record<string, number> } | null;

export type SavedView = {
  id: string;
  name: string;
  query: ViewQuery;
  columns: ViewColumns;
  /** Code-defined, can't be edited or deleted. */
  system: boolean;
  /** Shared with the whole tenant rather than personal. */
  shared: boolean;
};

/**
 * Params that BELONG to a view.
 *
 * `search` is deliberately excluded — a search term is a transient "find me
 * this one thing", not part of a saved arrangement, and baking one into a view
 * would leave people staring at a filtered list with no idea why. `page` and
 * `sv` are bookkeeping.
 */
const VIEW_PARAM_PREFIXES = ["f_"];
const VIEW_PARAM_KEYS = ["fq", "range", "from", "to", "sort", "dir", "view", "stage", "live"];

export function isViewParam(key: string): boolean {
  return VIEW_PARAM_KEYS.includes(key) || VIEW_PARAM_PREFIXES.some((p) => key.startsWith(p));
}

/** Pull the view-owned params out of a query, dropping empties. */
export function pickViewQuery(params: URLSearchParams | Record<string, string | undefined>): ViewQuery {
  const out: ViewQuery = {};
  const entries =
    params instanceof URLSearchParams ? [...params.entries()] : Object.entries(params);
  for (const [k, v] of entries) {
    if (typeof v === "string" && v !== "" && isViewParam(k)) out[k] = v;
  }
  return out;
}

/** Stable comparison — key order must not decide whether a view reads as dirty. */
export function sameQuery(a: ViewQuery, b: ViewQuery): boolean {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  if (ka.length !== kb.length) return false;
  return ka.every((k, i) => kb[i] === k && a[k] === b[k]);
}

export function sameColumns(a: ViewColumns, b: ViewColumns): boolean {
  if (!a || !b) return !a && !b;
  if (a.order.join(",") !== b.order.join(",")) return false;
  const ka = Object.keys(a.widths).sort();
  const kb = Object.keys(b.widths).sort();
  if (ka.length !== kb.length) return false;
  return ka.every((k, i) => kb[i] === k && a.widths[k] === b.widths[k]);
}

/**
 * The params to write when SELECTING a view: its own query, plus an explicit
 * null for every view param it does NOT set, so switching views never leaves
 * the previous one's filters behind.
 */
export function paramsForView(
  view: SavedView | null,
  current: URLSearchParams,
): Record<string, string | null> {
  const updates: Record<string, string | null> = {};
  for (const key of current.keys()) {
    if (isViewParam(key)) updates[key] = null;
  }
  if (view) for (const [k, v] of Object.entries(view.query)) updates[k] = v;
  // `sv` records which view is loaded; the implicit "all" view clears it.
  updates.sv = view && !isAllView(view) ? view.id : null;
  return updates;
}

/** The unfiltered starting point every entity has. */
export const ALL_VIEW_ID = "sys:all";

export function isAllView(view: SavedView): boolean {
  return view.id === ALL_VIEW_ID;
}
