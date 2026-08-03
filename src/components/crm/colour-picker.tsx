"use client";

import { useRef, useState } from "react";

// ---------------------------------------------------------------------------
// A drag-to-choose colour picker: a saturation/brightness square over a hue
// slider, the shape everyone already knows from every design tool.
//
// Hand-built for the same reason `DatePicker` and `TimePicker` are: the native
// `<input type="color">` opens the OPERATING SYSTEM's colour panel — a
// different window on every platform, unstyleable, ignoring the tenant accent,
// and on macOS a floating palette that outlives the popover that opened it.
// There are now no native date, time or colour inputs in the CRM.
//
// Pointer capture rather than window listeners: the drag keeps following the
// pointer outside the square (which is how you reach pure white or pure black)
// and can't be lost by the pointer crossing another element.
// ---------------------------------------------------------------------------

export function ColourPicker({
  value,
  onChange,
}: {
  /** `#rrggbb`. */
  value: string;
  /** Fires continuously as the handle moves — the preview IS the feedback. */
  onChange: (hex: string) => void;
}) {
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  // Hue is kept in state, not derived: at black or pure white the hue is
  // mathematically undefined, so reading it back from the hex would snap the
  // handle to red the moment you dragged into a corner.
  const parsed = hexToHsv(value);
  const [hue, setHue] = useState(parsed.h);
  const { s, v } = parsed;

  const track = (
    ref: React.RefObject<HTMLDivElement | null>,
    e: React.PointerEvent,
    apply: (x: number, y: number) => void,
  ) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const read = (clientX: number, clientY: number) =>
      apply(
        clamp((clientX - rect.left) / rect.width),
        clamp((clientY - rect.top) / rect.height),
      );
    read(e.clientX, e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Saturation → across, brightness → up. */}
      <div
        ref={svRef}
        onPointerDown={(e) => track(svRef, e, (x, y) => onChange(hsvToHex(hue, x, 1 - y)))}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return;
          const rect = svRef.current?.getBoundingClientRect();
          if (!rect) return;
          onChange(
            hsvToHex(
              hue,
              clamp((e.clientX - rect.left) / rect.width),
              1 - clamp((e.clientY - rect.top) / rect.height),
            ),
          );
        }}
        className="relative h-[116px] w-full cursor-crosshair rounded-md border border-black/10"
        style={{
          background: `linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, hsl(${hue} 100% 50%))`,
          touchAction: "none",
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute size-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
          style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%`, background: value }}
        />
      </div>

      <div
        ref={hueRef}
        onPointerDown={(e) =>
          track(hueRef, e, (x) => {
            const h = Math.round(x * 360);
            setHue(h);
            onChange(hsvToHex(h, s || 1, v || 1));
          })
        }
        onPointerMove={(e) => {
          if (e.buttons !== 1) return;
          const rect = hueRef.current?.getBoundingClientRect();
          if (!rect) return;
          const h = Math.round(clamp((e.clientX - rect.left) / rect.width) * 360);
          setHue(h);
          onChange(hsvToHex(h, s || 1, v || 1));
        }}
        className="relative h-3 w-full cursor-pointer rounded-full border border-black/10"
        style={{
          background:
            "linear-gradient(to right, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)",
          touchAction: "none",
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 size-[14px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
          style={{ left: `${(hue / 360) * 100}%`, background: `hsl(${hue} 100% 50%)` }}
        />
      </div>
    </div>
  );
}

function clamp(n: number): number {
  return Math.min(1, Math.max(0, n));
}

export function isHex(v: string): boolean {
  return /^#[0-9a-f]{6}$/i.test(v.trim());
}

export function hsvToHex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    const x = v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
    return Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(5)}${f(3)}${f(1)}`;
}

export function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const clean = isHex(hex) ? hex.trim() : "#000000";
  const r = parseInt(clean.slice(1, 3), 16) / 255;
  const g = parseInt(clean.slice(3, 5), 16) / 255;
  const b = parseInt(clean.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;

  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}
