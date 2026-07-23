import { ALL_VIEW_ID, type SavedView, type ViewEntity } from "./views";

// ---------------------------------------------------------------------------
// SYSTEM VIEWS — defined in code, not seeded as rows.
//
// Seeded rows are the same trap as the tenant lookup lists: every new default
// needs a migration that re-seeds every existing tenant, they drift the moment a
// tenant edits one, and a tenant can delete one and never get it back.
// Code-defined system views appear for every tenant automatically, can't be
// deleted, and improve in a release. A tenant customises one by DUPLICATING it
// into their own views — which is also how people discover the feature.
//
// Ids are prefixed `sys:` so they can never collide with a `saved_views` uuid.
//
// Every system view must be expressible in EXISTING url params — if one needs a
// filter the list can't apply, add the filter first. A view that silently does
// nothing is worse than no view.
// ---------------------------------------------------------------------------

const sys = (id: string, name: string, query: Record<string, string>): SavedView => ({
  id: `sys:${id}`,
  name,
  query,
  // System views don't pin columns: they say WHICH records, not how to look at
  // them, so they inherit whatever layout the user has. Only a saved personal
  // view carries a layout.
  columns: null,
  system: true,
  shared: true,
});

const LEAD_VIEWS: SavedView[] = [
  { ...sys("all", "All leads", {}), id: ALL_VIEW_ID },
  sys("new", "New enquiries", { f_status: "new" }),
  sys("survey", "Survey booked", { f_status: "survey_booked" }),
  sys("quoted", "Awaiting decision", { f_status: "quoted" }),
  sys("recent", "Received this month", { range: "this_month" }),
  sys("won-year", "Won this year", { f_status: "won", range: "this_year" }),
  sys("lost", "Lost", { f_status: "lost" }),
  sys("board", "Pipeline board", { view: "board" }),
];

const CUSTOMER_VIEWS: SavedView[] = [
  { ...sys("all", "All customers", {}), id: ALL_VIEW_ID },
  sys("live", "With a live lead", { live: "1" }),
  sys("dnc", "Do not contact", { f_do_not_contact: "1" }),
  sys("risk", "Payment risk", { f_bad_payer: "1" }),
  sys("moved", "Moved away", { f_customer_moved_away: "1" }),
];

const BY_ENTITY: Record<ViewEntity, SavedView[]> = {
  leads: LEAD_VIEWS,
  customers: CUSTOMER_VIEWS,
};

export function systemViews(entity: ViewEntity): SavedView[] {
  return BY_ENTITY[entity];
}

export function allView(entity: ViewEntity): SavedView {
  return BY_ENTITY[entity][0];
}
