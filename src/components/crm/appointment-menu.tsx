"use client";

import { useCallback, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cancelBooking, completeBooking } from "@/app/(app)/diary/actions";
import { useDialogs } from "./dialogs";
import { useDismissOnOutside, useMenuAtPoint } from "./floating-menu";
import { Icon } from "./icon";
import type { IconName } from "./icon";
import type { DiaryEvent } from "@/lib/data/appointments";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Right-click a job in the diary.
//
// Everything you'd want to do to a booking without leaving the day you're
// looking at: open what it's FOR, change when it is, mark it done, call it off.
// Left-click still opens the record — the menu is the shortcut, not the only
// route, so nothing here is hidden behind a gesture that isn't discoverable.
//
// It is `fixed` and positioned at the pointer through the shared
// `useMenuAtPoint`, so it can't be clipped by the grid's scroller and it lands
// correctly inside a dialog's transformed containing block. See AGENTS.md
// § Popover menus.
// ---------------------------------------------------------------------------

export type MenuTarget = { event: DiaryEvent; x: number; y: number };

export function AppointmentMenu({
  target,
  onClose,
  onEdit,
}: {
  target: MenuTarget | null;
  onClose: () => void;
  /** Opens the shared booking dialog seeded with this appointment. */
  onEdit: (event: DiaryEvent) => void;
}) {
  const router = useRouter();
  const { confirm } = useDialogs();
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  const style = useMenuAtPoint({
    point: target ? { x: target.x, y: target.y } : null,
    hostRef: ref,
    width: 232,
  });

  const dismiss = useCallback(() => onClose(), [onClose]);
  useDismissOnOutside({ open: !!target, onDismiss: dismiss, refs: [ref] });

  if (!target || !style) return <div ref={ref} style={{ display: "contents" }} />;

  const e = target.event;
  // What this booking is FOR, best link first: the contract is the job, the
  // lead is the enquiry it came from, the customer is the fallback.
  const links: { href: string; label: string; icon: IconName }[] = [];
  if (e.contractId)
    links.push({
      href: `/contracts/${e.contractId}`,
      label: `Open contract${e.contractRef ? ` ${e.contractRef}` : ""}`,
      icon: "file",
    });
  if (e.leadId)
    links.push({
      href: `/leads/${e.leadId}`,
      label: `Open lead${e.leadRef ? ` ${e.leadRef}` : ""}`,
      icon: "flag",
    });
  if (e.customerId)
    links.push({
      href: `/customers/${e.customerId}`,
      label: e.customerName ? `Open ${e.customerName}` : "Open customer",
      icon: "user",
    });

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  async function markDone() {
    onClose();
    start(async () => {
      await completeBooking(e.id);
      router.refresh();
    });
  }

  async function cancel() {
    onClose();
    // A soft cancel, and the message says so — the visit leaves the diary and
    // frees the person, but stays on the record as history.
    const ok = await confirm({
      title: "Cancel this appointment?",
      message: `It comes off the diary and frees ${e.staffNames.length ? e.staffNames.join(" and ") : "the slot"}, but stays on the record as history. It isn't deleted.`,
      confirmLabel: "Cancel appointment",
      tone: "danger",
    });
    if (!ok) return;
    start(async () => {
      await cancelBooking(e.id);
      router.refresh();
    });
  }

  return (
    <div ref={ref} style={{ display: "contents" }}>
      <div
        style={style}
        className="z-50 flex flex-col overflow-hidden rounded-xl border border-[#e7e7ea] bg-white py-1.5 shadow-[0_8px_28px_rgba(10,10,10,0.14)]"
      >
        <p className="truncate px-3 pb-1.5 pt-0.5 text-[11px] font-bold uppercase tracking-[0.05em] text-[#a1a1aa]">
          {e.customerName ?? e.title}
        </p>

        {links.map((l) => (
          <Item key={l.href} icon={l.icon} onClick={() => go(l.href)}>
            {l.label}
          </Item>
        ))}

        <div className="my-1 h-px bg-[#f4f4f5]" />

        <Item
          icon="calendar"
          onClick={() => {
            onClose();
            onEdit(e);
          }}
        >
          Edit appointment…
        </Item>
        {e.status !== "done" && (
          <Item icon="check" onClick={markDone} disabled={pending}>
            Mark as done
          </Item>
        )}
        <Item icon="x" onClick={cancel} disabled={pending} danger>
          Cancel appointment
        </Item>
      </div>
    </div>
  );
}

function Item({
  icon,
  onClick,
  disabled,
  danger,
  children,
}: {
  icon: IconName;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-2.5 px-3 py-[7px] text-left text-[12.5px] transition-colors disabled:opacity-50",
        danger
          ? "text-[#d64545] hover:bg-[#fdecec]"
          : "text-[#3f3f46] hover:bg-[var(--accent-tint)]",
      )}
    >
      <Icon name={icon} size={13} strokeWidth={1.9} className="shrink-0 opacity-70" />
      <span className="min-w-0 truncate">{children}</span>
    </button>
  );
}
