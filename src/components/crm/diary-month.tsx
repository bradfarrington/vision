"use client";

import Link from "next/link";

import { addDays, isSameDay, isWeekend, startOfMonth, startOfWeek, toDateParam } from "@/lib/diary";
import { useCategory } from "@/components/crm/diary-colours";
import type { DiaryEvent } from "@/lib/data/appointments";
import { cn } from "@/lib/utils";

// Diary — MONTH view (design screen 08b). A density overview, not a working
// surface: it answers "which weeks are full and where are the gaps", then you
// click a day to go and actually work it.
//
// So a cell shows a CAPPED few jobs plus a "+N more" — the same rule as the
// customer overview's digests (AGENTS.md § every digest is capped and every cap
// has a destination). Uncapped, one busy day would set the height of its whole
// row and the month would stop being scannable.

const PER_DAY = 3;
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function DiaryMonth({ events, anchor }: { events: DiaryEvent[]; anchor: string }) {
  const anchorDate = new Date(anchor);
  const month = anchorDate.getMonth();
  const first = startOfMonth(anchorDate);
  const gridStart = startOfWeek(first);
  const lastDay = new Date(first.getFullYear(), month + 1, 0);
  const weeks = Math.ceil((+startOfWeek(lastDay) - +gridStart) / (7 * 86_400_000)) + 1;
  const today = new Date();

  const byDay = new Map<string, DiaryEvent[]>();
  for (const e of events) {
    const key = toDateParam(new Date(e.startsAt));
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(e);
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto px-[26px] pb-4">
      <div className="grid grid-cols-7 gap-px rounded-xl border border-[#e7e7ea] bg-[#e7e7ea] [&>*]:bg-white">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="px-2 py-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[#a1a1aa]"
          >
            {d}
          </div>
        ))}

        {Array.from({ length: weeks * 7 }, (_, i) => {
          const d = addDays(gridStart, i);
          const key = toDateParam(d);
          const dayEvents = (byDay.get(key) ?? []).sort(
            (a, b) => +new Date(a.startsAt) - +new Date(b.startsAt),
          );
          // Days from the neighbouring months still render (the grid is whole
          // weeks) but recede, so the month you asked for is the one you read.
          const outside = d.getMonth() !== month;
          const isToday = isSameDay(d, today);

          return (
            <div
              key={key}
              className={cn(
                "flex min-h-[112px] flex-col gap-1 p-1.5",
                outside && "bg-[#fcfcfd]",
                isWeekend(d) && !outside && "bg-[#fafafa]",
              )}
            >
              <Link
                href={`/diary?view=day&d=${key}`}
                className={cn(
                  "flex size-[22px] shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                  isToday
                    ? "bg-[var(--accent-blue)] text-white"
                    : outside
                      ? "text-[#d4d4d8] hover:text-[#71717a]"
                      : "text-[#3f3f46] hover:bg-[#f4f4f5]",
                )}
              >
                {d.getDate()}
              </Link>

              {dayEvents.slice(0, PER_DAY).map((e) => (
                <MonthPill key={e.id} event={e} />
              ))}

              {dayEvents.length > PER_DAY && (
                // The cap's destination — never a dead "+2 more".
                <Link
                  href={`/diary?view=day&d=${key}`}
                  className="px-1 text-[10px] font-medium text-[#71717a] hover:text-[var(--accent-blue)]"
                >
                  +{dayEvents.length - PER_DAY} more
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthPill({ event }: { event: DiaryEvent }) {
  const cat = useCategory(event.category);
  const start = new Date(event.startsAt);
  const href = event.contractId
    ? `/contracts/${event.contractId}`
    : event.leadId
      ? `/leads/${event.leadId}`
      : null;

  const label = (
    <span className="flex min-w-0 items-center gap-1">
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: event.provisional ? "#a1a1aa" : cat.fg }}
      />
      <span className="shrink-0 text-[9.5px] font-medium text-[#71717a]">
        {start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
      </span>
      <span className="min-w-0 truncate text-[10px] text-[#3f3f46]">
        {event.customerName ?? event.title}
      </span>
    </span>
  );

  const title = `${event.title}${event.customerName ? ` — ${event.customerName}` : ""}`;
  if (!href) return <span className="block px-1" title={title}>{label}</span>;
  return (
    <Link href={href} className="block rounded px-1 hover:bg-[#fafafa]" title={title}>
      {label}
    </Link>
  );
}
