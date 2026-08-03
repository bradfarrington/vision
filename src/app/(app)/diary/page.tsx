import { getDiary } from "@/lib/data/appointments";
import { getDiaryStaff } from "@/lib/data/staff";
import { getTenantOptionLists } from "@/lib/data/customer-record";
import { WORK_CATEGORIES, type WorkCategory } from "@/lib/appointments";
import {
  addDays,
  fromDateParam,
  isDiaryView,
  shift,
  toDateParam,
  windowFor,
  windowLabel,
  type DiaryView,
} from "@/lib/diary";
import Link from "next/link";
import { redirect } from "next/navigation";

import { defaultViewFor, getDefaultViewId, getSavedViews } from "@/lib/data/saved-views";
import { urlForView } from "@/lib/views/views";
import { ViewSwitcher } from "@/components/crm/view-switcher";

import { DiaryNav } from "@/components/crm/diary-nav";
import { Icon, TOOLBAR_H, btnSecondary } from "@/components/crm/primitives";
import { cn } from "@/lib/utils";
import { DiaryDayView, DiaryWeekView } from "@/components/crm/diary-views";
import { DiaryMonth } from "@/components/crm/diary-month";
import { JobTypeFilter, StaffFilter } from "@/components/crm/diary-filters";
import { NewAppointmentButton } from "@/components/crm/new-appointment-button";
import { ViewToggle } from "@/components/crm/view-toggle";
import { ViewStateSaver } from "@/components/crm/view-state";

// The diary — transcribed from design screens 07 (day), 08a (week), 08b (month).
//
// All three views run the SAME query through getDiary(), so switching never
// changes WHICH jobs you're looking at, only how they're arranged — the rule
// the leads list/board split already follows.
//
// Deliberately NOT built on `data-list.tsx`: the diary is a time canvas, not a
// table, and forcing it through the ListSpec machinery would fight the module
// rather than reuse it. Its toolbar controls ARE the shared ones.

type SearchParams = Promise<Record<string, string | undefined>>;

const DIARY_VIEWS = [
  { value: "day", label: "Day", icon: "clock" as const },
  { value: "week", label: "Week", icon: "columns" as const },
  { value: "month", label: "Month", icon: "calendar" as const },
];

export default async function DiaryPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;

  // A bare /diary lands on YOUR default view, expanded into the URL by a
  // redirect so the address stays honest and shareable — the screen never
  // filters itself behind your back. Any URL that names a view or carries a
  // view param is someone's deliberate destination and is left alone.
  const fallback = await defaultViewFor("diary", sp);
  if (fallback) redirect(urlForView("/diary", sp, fallback));

  const view: DiaryView = isDiaryView(sp.view) ? sp.view : "day";
  const anchor = fromDateParam(sp.d);
  const { from, to } = windowFor(view, anchor);

  const staffIds = (sp.staff ?? "").split(",").filter(Boolean);
  const categories = (sp.cat ?? "")
    .split(",")
    .filter(Boolean)
    .filter((c): c is WorkCategory => WORK_CATEGORIES.some((w) => w.key === c));

  const [events, staff, opts, views, defaultViewId] = await Promise.all([
    getDiary({
      from: from.toISOString(),
      to: to.toISOString(),
      staffIds: staffIds.length ? staffIds : undefined,
      categories: categories.length ? categories : undefined,
    }),
    getDiaryStaff(),
    // The tenant's own appointment types, for the booking dialog's picker.
    getTenantOptionLists(["appointment_type"]),
    getSavedViews("diary"),
    getDefaultViewId("diary"),
  ]);

  // Both working views draw a COLUMN per staff member, so a staff filter
  // narrows the columns as well as the events — otherwise you'd filter the
  // diary and still stare at ten empty lanes.
  const shownStaff = staffIds.length ? staff.filter((s) => staffIds.includes(s.id)) : staff;

  // The days the columns span: one for the day view, seven for the week.
  const spannedDays: Date[] = [];
  for (let d = new Date(from); d < to; d = addDays(d, 1)) spannedDays.push(new Date(d));

  const gridKey = `${view}|${sp.d ?? ""}|${sp.staff ?? ""}|${sp.cat ?? ""}`;

  const prev = toDateParam(shift(view, anchor, -1));
  const next = toDateParam(shift(view, anchor, 1));
  const keep = (d: string) => {
    const p = new URLSearchParams();
    if (view !== "day") p.set("view", view);
    p.set("d", d);
    if (sp.staff) p.set("staff", sp.staff);
    if (sp.cat) p.set("cat", sp.cat);
    return `/diary?${p.toString()}`;
  };

  return (
    <>
      <ViewStateSaver />
      {/* No side/bottom padding on the root — the grid runs to the panel edges,
          same as the list table. The gutter lives on the toolbar block. */}
      <div className="flex flex-1 flex-col gap-[14px] overflow-hidden pt-[22px]">
        <div className="flex flex-col gap-[14px] px-[26px]">
          {/* The toolbar is design screen 07's: the PERIOD on the left with the
              title (Day/Week/Month, then which window you're on), and the
              ACTIONS on the right (what to show, and booking). Left is where
              you are; right is what you do. */}
          {/* ONE ROW, never two. It wraps only below the app's own 1280px
              floor, so every control is sized to fit: the view pill truncates,
              the window label has a modest min-width, and "Find a slot" is
              icon-only. A toolbar that reflows into two rows moves the buttons
              under the pointer and costs a band of the grid's height. */}
          <div className="flex flex-nowrap items-center gap-2">
            <h1 className="shrink-0 font-[family-name:var(--font-inter-tight)] text-[23px] font-extrabold tracking-[-0.01em] text-[#0a0a0a]">
              Diary
            </h1>

            {/* Labelled, not icon-only: a period has no glyph that says "Week"
                the way rows-vs-columns says "board" on the leads list. */}
            <ViewToggle views={DIARY_VIEWS} variant="label" />

            {/* Period navigation — the label doubles as a date picker, so
                jumping to a week months out doesn't mean twenty arrow clicks. */}
            <DiaryNav
              label={windowLabel(view, anchor)}
              anchor={toDateParam(anchor)}
              prev={keep(prev)}
              next={keep(next)}
              today={keep(toDateParam(new Date()))}
            />

            <div className="ml-auto flex shrink-0 items-center gap-2">
              {/* Two dropdowns that state their own answer, rather than one
                  "Filters" button with a count — the diary has exactly two
                  axes and they're the questions asked of it all day. */}
              <JobTypeFilter />
              <StaffFilter staff={staff} />
              {/* Saved views sit WITH the two filters they bundle, not beside
                  the title: on a list the view is the subject of the screen, but
                  the diary's subject is a date, so a second named box next to
                  the period picker just read as a rival filter. */}
              <ViewSwitcher
                entity="diary"
                views={views}
                activeId={sp.sv}
                defaultId={defaultViewId}
                variant="icon"
              />
              {/* "When can we fit this in?" is a different question from
                  "what's on Tuesday", so it's its own screen rather than a
                  mode of this one. Icon-only: it's the one control here that
                  LEAVES the screen, and the row has to fit. */}
              <Link
                href="/diary/slots"
                title="Find a slot"
                aria-label="Find a slot"
                className={cn(TOOLBAR_H, btnSecondary, "!px-2.5")}
              >
                <Icon name="search" size={14} strokeWidth={1.9} />
              </Link>
              <NewAppointmentButton
                staff={staff}
                types={opts.appointment_type ?? []}
                anchor={toDateParam(anchor)}
              />
            </div>
          </div>
        </div>

        {/* STAFF are the columns in both working views — the same person sits
            in the same place whichever period you're on. The day puts half-hour
            slots down the left (working the clock); the week puts DAYS down the
            left (who is on what, and where the gaps are). */}
        {/* Keyed on the RAW params (never on resolved dates — those come from
            the clock and would remount every render): the views hold their
            events in state for optimistic drags, so a new day or filter must
            start from the server's list rather than the previous one's. */}
        {view === "day" && (
          <DiaryDayView
            key={gridKey}
            events={events}
            staff={shownStaff}
            day={anchor.toISOString()}
            types={opts.appointment_type ?? []}
          />
        )}
        {view === "week" && (
          <DiaryWeekView
            key={gridKey}
            events={events}
            days={spannedDays.map((d) => d.toISOString())}
            staff={shownStaff}
            types={opts.appointment_type ?? []}
          />
        )}
        {view === "month" && <DiaryMonth events={events} anchor={anchor.toISOString()} />}
      </div>
    </>
  );
}
