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
import { DiaryNav } from "@/components/crm/diary-nav";
import { DiaryDayView, DiaryWeekView } from "@/components/crm/diary-views";
import { DiaryMonth } from "@/components/crm/diary-month";
import { DiaryFiltersButton } from "@/components/crm/diary-filters";
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
  const view: DiaryView = isDiaryView(sp.view) ? sp.view : "day";
  const anchor = fromDateParam(sp.d);
  const { from, to } = windowFor(view, anchor);

  const staffIds = (sp.staff ?? "").split(",").filter(Boolean);
  const categories = (sp.cat ?? "")
    .split(",")
    .filter(Boolean)
    .filter((c): c is WorkCategory => WORK_CATEGORIES.some((w) => w.key === c));

  const [events, staff, opts] = await Promise.all([
    getDiary({
      from: from.toISOString(),
      to: to.toISOString(),
      staffIds: staffIds.length ? staffIds : undefined,
      categories: categories.length ? categories : undefined,
    }),
    getDiaryStaff(),
    // The tenant's own appointment types, for the booking dialog's picker.
    getTenantOptionLists(["appointment_type"]),
  ]);

  // The day view draws a row per staff member, so a staff filter narrows the
  // ROWS as well as the events — otherwise you'd filter the diary and still
  // stare at ten empty lanes.
  const shownStaff = staffIds.length ? staff.filter((s) => staffIds.includes(s.id)) : staff;

  // The days the columns span: one for the day view, seven for the week.
  const spannedDays: Date[] = [];
  for (let d = new Date(from); d < to; d = addDays(d, 1)) spannedDays.push(new Date(d));

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
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-[family-name:var(--font-inter-tight)] text-[23px] font-extrabold tracking-[-0.01em] text-[#0a0a0a]">
              Diary
            </h1>

            {/* Period navigation — the label doubles as a date picker, so
                jumping to a week months out doesn't mean twenty arrow clicks. */}
            <DiaryNav
              label={windowLabel(view, anchor)}
              anchor={toDateParam(anchor)}
              prev={keep(prev)}
              next={keep(next)}
              today={keep(toDateParam(new Date()))}
            />

            <div className="ml-auto flex items-center gap-2.5">
              <DiaryFiltersButton staff={staff} />
              <ViewToggle views={DIARY_VIEWS} />
              {/* Booking lands in Stage 3 with the shared appointment dialog. */}
            </div>
          </div>
        </div>

        {/* Day and week share ONE time grid — times down the left in half-hour
            blocks, a job spanning as many as it lasts. Only what a column means
            changes: staff on the day, days on the week. */}
        {view === "day" && (
          <DiaryDayView
            events={events}
            staff={shownStaff}
            day={anchor.toISOString()}
            types={opts.appointment_type ?? []}
          />
        )}
        {view === "week" && (
          <DiaryWeekView
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
