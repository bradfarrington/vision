"use client";

import { useEffect } from "react";

// ---------------------------------------------------------------------------
// Right-click belongs to the APP, not the browser.
//
// Now that a right-click opens our own menu on a diary job — and will on rows,
// cards and records as it spreads — the browser's "Back / Save As / View Page
// Source" menu is both wrong and in the way: it's the same gesture, and every
// item on it is either useless here or actively unhelpful. This is an app, not
// a web page, the same call as hiding the scrollbars.
//
// TWO DELIBERATE EXCEPTIONS, because suppressing it everywhere breaks things
// people genuinely do all day:
//
//  1. **Text fields.** Right-click → Paste is how a phone number gets out of an
//     email and into a lead, and spell-check lives on that menu too.
//  2. **Selected text.** Right-click → Copy on a highlighted postcode or
//     reference is muscle memory; taking it away leaves no obvious substitute.
//
// So the native menu is suppressed on the app's CHROME and canvases, and left
// alone wherever the user is working with text. Anything with its own menu
// calls preventDefault itself and never reaches this.
// ---------------------------------------------------------------------------

const TEXT_ENTRY = "input, textarea, select, [contenteditable=''], [contenteditable='true']";

export function SuppressNativeMenu() {
  useEffect(() => {
    const onMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.(TEXT_ENTRY)) return;
      if ((window.getSelection()?.toString() ?? "").trim()) return;
      e.preventDefault();
    };
    // Bubble phase, so an element's own handler runs first and can do its own
    // thing; by the time it reaches here the only question left is whether to
    // let the browser's menu through.
    document.addEventListener("contextmenu", onMenu);
    return () => document.removeEventListener("contextmenu", onMenu);
  }, []);

  return null;
}
