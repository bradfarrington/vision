"use client";

import Link from "next/link";

import { addDays, isSameDay, isWeekend, startOfWeek, toDateParam } from "@/lib/diary";
import { WORK_CATEGORIES, durationLabel } from "@/lib/appointments";
import type { DiaryEvent } from "@/lib/data/appointments";
import { cn } from "@/lib/utils";

// Diary — WEEK view (design screen 08a). Days as columns, jobs stacked inside
// each day in time order.
//
// Deliberately NOT a staff grid like the day view: a week × seven staff is 49
// cells of nothing much, and the question a week answers is different — "how
// busy are we, and where are the gaps" rather than "who is doing what at 2pm".

export function DiaryWeek({ events, anchor }: { events: DiaryEvent[]; anchor: string }) {
  const start = startOfWeek(new Date(anchor));
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = new Date();

  const byDay = new Map<string, DiaryEvent[]>();
  for (const d of days) byDay.set(toDateParam(d), []);
  for (const e of events) {
    const key = toDateParam(new Date(e.startsAt));
    byDay.get(key)?.push(e);
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto px-[26px] pb-4">
      <div className="grid min-w-[900px] grid-cols-7 gap-2">
        {days.map((d) => {
          const key = toDateParam(d);
          const dayEvents = byDay.get(key) ?? [];
          const isToday = isSameDay(d, today);
          return (
            <div
              key={key}
              className={cn(
                "flex min-h-[280px] flex-col rounded-xl border",
                isToday ? "border-[var(--accent-blue)]" : "border-[#e7e7ea]",
                // Weekends shade back — most firms don't work them, so they
                // should read as background rather than as five empty slots.
                isWeekend(d) ? "bg-[#fafafa]" : "bg-white",
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-between gap-1 border-b px-2.5 py-1.5",
                  isToday ? "border-[var(--accent-blue)]" : "border-[#f4f4f5]",
                )}
              >
                {/* The header is a LINK into the day view — the natural move
                    from "Thursday looks heavy" is to go and look at Thursday. */}
                <Link
                  href={`/diary?view=day&d=${key}`}
                  className="min-w-0 truncate text-[12px] font-semibold text-[#0a0a0a] hover:text-[var(--accent-blue)]"
                >
                  {d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })}
                  {isToday && <span className="ml-1 text-[10.5px] font-medium text-[var(--accent-blue)]">today</span>}
                </Link>
                {dayEvents.length > 0 && (
                  <span className="shrink-0 rounded-full bg-[#f4f4f5] px-1.5 text-[10px] font-bold text-[#3f3f46]">
                    {dayEvents.length}
                  </span>
                )}
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-1.5">
                {dayEvents.length === 0 ? (
                  <span className="px-1 py-3 text-center text-[11px] text-[#d4d4d8]">—</span>
                ) : (
                  dayEvents.map((e) => <WeekCard key={e.id} event={e} />)
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekCard({ event }: { event: DiaryEvent }) {
  const cat = WORK_CATEGORIES.find((c) => c.key === event.category)!;
  const start = new Date(event.startsAt);
  const ref = event.contractRef ?? event.leadRef;
  const href = event.contractId
    ? `/contracts/${event.contractId}`
    : event.leadId
      ? `/leads/${event.leadId}`
      : event.customerId
        ? `/customers/${event.customerId}`
        : null;

  const body = (
    <>
      <span className="block truncate text-[11px] font-semibold" style={{ color: cat.fg }}>
        {ref && <span className="font-mono">{ref} · </span>}
        {event.title}
      </span>
      {event.customerName && (
        <span className="block truncate text-[10.5px] text-[#52525b]">{event.customerName}</span>
      )}
      <span className="block truncate text-[10px] text-[#71717a]">
        {start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} ·{" "}
        {durationLabel(event.duration)}
      </span>
      {/* Who is on it — a week is scanned to spot that one person has four
          jobs, so the names have to be on the card. */}
      {event.staffNames.length > 0 && (
        <span className="block truncate text-[10px] text-[#a1a1aa]">
          {event.staffNames.join(" + ")}
        </span>
      )}
    </>
  );

  const className = cn(
    "block overflow-hidden rounded-lg border px-1.5 py-1",
    href && "hover:brightness-[0.97]",
  );
  const style = {
    background: event.provisional ? "#fff" : cat.bg,
    borderColor: event.provisional ? "#a1a1aa" : cat.bg,
    borderStyle: event.provisional ? "dashed" : "solid",
  } as const;

  if (!href) return <div className={className} style={style}>{body}</div>;
  return (
    <Link href={href} className={className} style={style}>
      {body}
    </Link>
  );
}
