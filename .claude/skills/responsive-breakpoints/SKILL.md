---
name: responsive-breakpoints
description: Apply a consistent, device-tested responsive breakpoint system (phone / tablet / desktop) when building or reviewing responsive web layouts. Use when writing CSS media queries, choosing column counts for card/grid rows, handling hover-vs-touch UI, or auditing a page across real device widths.
---

# Responsive Breakpoints

A reusable responsive system: three device tiers plus a set of **real device widths**
to design and test against. Treat this as the project default — but if a project already
defines its own breakpoints in a design system, follow those for the tier boundaries and
use this skill mainly for the **device-testing widths and the rules** below.

## The three tiers

| Tier | Media query |
|---|---|
| **Phone** | `@media (max-width: 767px)` |
| **Tablet** | `@media (min-width: 768px) and (max-width: 1366px)` |
| **Desktop** | `@media (min-width: 1367px)` |

The tablet upper bound is **1366px on purpose**: it catches *every* iPad orientation,
including iPad Pro 12.9" landscape (1366px wide). With a lower cap, that device falls into
"desktop" and gets desktop-only layouts (e.g. 6-column grids that should be ≤3 on a tablet).

## Device reference sizes (CSS px, width × height)

Design and test against the **real widths**, not just the tier boundaries.

**Phone — narrow floor is 344px; everything must hold at 344px:**

| Device | Width | Height |
|---|---|---|
| Galaxy Z Fold 5 (folded) | **344** | 882 |
| Samsung Galaxy S8+ | 360 | 740 |
| iPhone 12 Pro | 390 | 844 |
| Samsung Galaxy S20 Ultra | 412 | 915 |
| iPhone XR | 414 | 896 |
| iPhone 14 Pro Max | 430 | 932 |

**Tablet (iPad):**

| Device | Portrait | Landscape |
|---|---|---|
| iPad Air | 820 × 1180 | 1180 × 820 |
| iPad Pro 12.9" | 1024 × 1366 | 1366 × 1024 |

## Rules

- **Multi-column card/grid rows:** ≤3 columns on tablet (never 6); 1–2 on phone; single
  column at the 344px floor.
- **Hover-only UI** (slide-out panels, hover reveals, tooltips) must *also* gate on
  `(hover: hover)` — touch tablets can't hover, so give them a static/stacked layout
  instead of broken interactions.
- **The phone constraint is horizontal, not vertical.** Phone heights are generous
  (740–932px), so design for narrow width — don't assume a short viewport.
- **Mobile-first base styles.** Write the base (no-media-query) layout for phone and keep
  it visible without JS, so print and no-JS render correctly; layer tablet/desktop on top.

## How to apply

**Building a page:** write base mobile styles first, then add the tablet and desktop
queries above.

**Reviewing a page:** open it at **344 / 390 / 430** (phone), **820 and 1366** (iPad
portrait/landscape), and **≥1367** (desktop). At each width check: column counts, that
hover UI degrades on touch, and that **nothing overflows at 344px**.
