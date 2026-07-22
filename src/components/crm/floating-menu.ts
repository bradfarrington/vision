"use client";

import { useLayoutEffect, useState, type CSSProperties, type RefObject } from "react";

const MENU_GAP = 4; // breathing room between trigger and menu
const VIEWPORT_MARGIN = 8; // never let the menu touch the window edge
const MIN_MENU_HEIGHT = 200; // below this, prefer flipping above the trigger
const MAX_MENU_HEIGHT = 320;

/**
 * Position a popover menu against the VIEWPORT rather than its trigger's box.
 *
 * Every dropdown in the CRM opens inside something that clips — a scrolling tab
 * panel, a bordered list card, a two-pane panel — so an absolutely-positioned
 * menu gets cut in half sooner or later. `fixed` escapes all of that, and
 * unlike a portal it leaves the menu in the React tree, so the tenant accent
 * variables still inherit and the owner's click-outside check keeps working.
 * (Only holds while no ancestor has transform/filter/contain — those would make
 * `fixed` resolve against that ancestor instead.)
 *
 * Returns the style to spread onto the menu, or null before the first measure.
 */

/**
 * A `transform`/`filter`/`perspective` on an ancestor makes it the containing
 * block for `fixed` descendants, so our viewport coordinates would land in the
 * wrong place — the shadcn dialog (translate-centred) is exactly that case.
 * Find that ancestor, if any, so the caller can rebase onto it.
 */
function containingBlock(el: HTMLElement): DOMRect | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (
      cs.transform !== "none" ||
      cs.filter !== "none" ||
      cs.perspective !== "none" ||
      cs.willChange.includes("transform") ||
      cs.contain.includes("paint")
    ) {
      return p.getBoundingClientRect();
    }
  }
  return null;
}
export function useFloatingMenu({
  open,
  triggerRef,
  width,
  align = "start",
  maxHeight = MAX_MENU_HEIGHT,
}: {
  open: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  /** Fixed menu width, or "trigger" to match the trigger's own width. */
  width: number | "trigger";
  /** Which trigger edge the menu lines up with. */
  align?: "start" | "end";
  maxHeight?: number;
}): CSSProperties | null {
  const [style, setStyle] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const el = triggerRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const w = width === "trigger" ? r.width : width;
      const left = Math.min(
        Math.max(VIEWPORT_MARGIN, align === "end" ? r.right - w : r.left),
        Math.max(VIEWPORT_MARGIN, window.innerWidth - w - VIEWPORT_MARGIN),
      );
      const below = window.innerHeight - r.bottom - MENU_GAP - VIEWPORT_MARGIN;
      const above = r.top - MENU_GAP - VIEWPORT_MARGIN;
      const flip = below < MIN_MENU_HEIGHT && above > below;
      // Fit is decided in viewport coordinates, then rebased if a transformed
      // ancestor has hijacked the containing block.
      const cb = containingBlock(el);
      setStyle({
        position: "fixed",
        left: left - (cb?.left ?? 0),
        width: w,
        maxHeight: Math.max(MIN_MENU_HEIGHT, Math.min(maxHeight, flip ? above : below)),
        ...(flip
          ? { bottom: (cb?.bottom ?? window.innerHeight) - r.top + MENU_GAP }
          : { top: r.bottom + MENU_GAP - (cb?.top ?? 0) }),
      });
    };
    place();
    window.addEventListener("resize", place);
    // Capture phase: catches scrolling on any ancestor, not just the window.
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, triggerRef, width, align, maxHeight]);

  return style;
}
