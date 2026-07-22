"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Icon, type IconName } from "./icon";

// ---------------------------------------------------------------------------
// Global confirm / alert dialogs.
//
// The browser's native confirm()/alert() are unstyleable, say "localhost says",
// and ignore the tenant's accent — never use them. Instead every screen asks the
// app for a dialog and awaits the answer:
//
//   const { confirm } = useDialogs();
//   if (!(await confirm({ title: "Remove this note?", tone: "danger" }))) return;
//
// One provider is mounted in the authenticated app shell, so a single dialog
// element serves the whole CRM and inherits the tenant accent variables set on
// the shell root.
// ---------------------------------------------------------------------------

/** Visual weight. `danger` = destructive/irreversible, `warning` = proceed with
 * care, `accent` = an ordinary decision (tenant accent). */
export type DialogTone = "accent" | "warning" | "danger";

export type ConfirmOptions = {
  title: string;
  /** Supporting sentence — say what actually happens, including what survives. */
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
};

export type AlertOptions = {
  title: string;
  message?: string;
  /** Dismiss button text. Defaults to "OK". */
  closeLabel?: string;
  tone?: DialogTone;
};

type Request =
  | ({ kind: "confirm"; resolve: (ok: boolean) => void } & ConfirmOptions)
  | ({ kind: "alert"; resolve: (ok: boolean) => void } & AlertOptions);

type DialogsApi = {
  /** Ask a yes/no question. Resolves false on cancel, Escape or backdrop click. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Tell the user something they must acknowledge. Resolves when dismissed. */
  alert: (options: AlertOptions) => Promise<void>;
};

const DialogsContext = createContext<DialogsApi | null>(null);

const TONE: Record<DialogTone, { icon: IconName; badge: string; confirm: string }> = {
  accent: {
    icon: "message",
    badge: "bg-[var(--accent-tint)] text-[var(--accent-active)]",
    confirm: "bg-[var(--accent-blue)] hover:bg-[var(--accent-hover)] text-white",
  },
  warning: {
    icon: "flag",
    badge: "bg-[#fdf2dc] text-[#b86e00]",
    confirm: "bg-[#b86e00] hover:bg-[#9a5c00] text-white",
  },
  danger: {
    icon: "trash",
    badge: "bg-[#fdecec] text-[#d64545]",
    confirm: "bg-[#d64545] hover:bg-[#bd3a3a] text-white",
  },
};

export function DialogsProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<Request | null>(null);
  // Guards against double-resolving when Escape and a button race.
  const settled = useRef(false);

  const ask = useCallback((req: Omit<Request, "resolve">): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      settled.current = false;
      setRequest({ ...req, resolve } as Request);
    });
  }, []);

  const api = useMemo<DialogsApi>(
    () => ({
      confirm: (options) => ask({ kind: "confirm", ...options } as Omit<Request, "resolve">),
      alert: (options) =>
        ask({ kind: "alert", ...options } as Omit<Request, "resolve">).then(() => undefined),
    }),
    [ask],
  );

  function settle(answer: boolean) {
    if (settled.current) return;
    settled.current = true;
    request?.resolve(answer);
    setRequest(null);
  }

  const tone = TONE[request?.tone ?? (request?.kind === "confirm" ? "accent" : "warning")];
  const isConfirm = request?.kind === "confirm";

  return (
    <DialogsContext.Provider value={api}>
      {children}
      <Dialog
        open={!!request}
        onOpenChange={(open: boolean) => {
          // Escape / backdrop / close → the safe answer is always "no".
          if (!open) settle(false);
        }}
      >
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          {request && (
            <div className="flex gap-3.5 p-1">
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  tone.badge,
                )}
              >
                <Icon name={tone.icon} size={16} strokeWidth={1.9} />
              </span>
              <div className="min-w-0 flex-1">
                {/* DialogTitle/Description (not plain tags) so the dialog is
                    announced correctly — Base UI wires aria-labelledby from them. */}
                <DialogTitle className="font-[family-name:var(--font-inter-tight)] text-[15.5px] font-bold text-[#0a0a0a]">
                  {request.title}
                </DialogTitle>
                {request.message && (
                  <DialogDescription className="mt-1 text-[12.5px] leading-relaxed text-[#52525b]">
                    {request.message}
                  </DialogDescription>
                )}
                <div className="mt-4 flex items-center justify-end gap-2">
                  {isConfirm && (
                    <button
                      type="button"
                      // Destructive dialogs open with Cancel focused, so a
                      // reflex Enter never deletes anything.
                      autoFocus={request.tone === "danger"}
                      onClick={() => settle(false)}
                      className="rounded-lg border border-[#e7e7ea] bg-white px-3.5 py-2 text-[12.5px] font-semibold text-[#3f3f46] transition-colors hover:bg-[#fafafa]"
                    >
                      {request.cancelLabel ?? "Cancel"}
                    </button>
                  )}
                  <button
                    type="button"
                    autoFocus={request.tone !== "danger"}
                    onClick={() => settle(true)}
                    className={cn(
                      "rounded-lg px-3.5 py-2 text-[12.5px] font-semibold transition-colors",
                      tone.confirm,
                    )}
                  >
                    {isConfirm ? (request.confirmLabel ?? "Confirm") : (request.closeLabel ?? "OK")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DialogsContext.Provider>
  );
}

/**
 * The app's confirm/alert. Throws if used outside the provider — that's a
 * mounting bug, not something to fall back to window.confirm for.
 */
export function useDialogs(): DialogsApi {
  const ctx = useContext(DialogsContext);
  if (!ctx) throw new Error("useDialogs must be used inside <DialogsProvider> (see app/(app)/layout).");
  return ctx;
}
