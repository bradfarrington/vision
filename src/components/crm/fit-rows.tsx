"use client";

import { Children, useLayoutEffect, useRef, useState } from "react";

/**
 * Renders only the rows that FIT the space it has been given.
 *
 * The customer overview must fill its panel and stop — never scroll, never spill
 * past the padding. Row caps alone can't deliver that, because the space
 * available depends on the window: three notes fit a 27" monitor and not a
 * laptop. So the layout hands each list card whatever height is left over and
 * this measures how many children clear the bottom edge.
 *
 * Rows that don't fit stay in the DOM and keep their space — they are hidden
 * with `visibility`, not `display` — so the measurement stays stable and a
 * resize re-measures against the same layout instead of oscillating (hide a row
 * → container gets shorter → row fits again → hide it again…). The parent clips,
 * so a half-visible row never shows.
 *
 * Whatever is dropped is still reachable: every card using this carries its
 * total count and a "View all →" jump to the tab that owns the full list.
 */
export function FitRows({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const items = Children.toArray(children);
  // Server render shows everything; the first layout pass trims to fit. The
  // container clips, so the untrimmed frame is never visible.
  const [fit, setFit] = useState(items.length);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      let n = 0;
      for (const kid of Array.from(el.children)) {
        const r = kid.getBoundingClientRect();
        // 0.5px of slack absorbs sub-pixel rounding on fractional layouts.
        if (r.bottom - box.top <= el.clientHeight + 0.5) n += 1;
        else break;
      }
      setFit(n);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [items.length]);

  return (
    <div ref={ref} className={`min-h-0 flex-1 overflow-hidden ${className}`}>
      {items.map((child, i) => (
        <div key={i} className={i < fit ? undefined : "invisible"}>
          {child}
        </div>
      ))}
    </div>
  );
}
