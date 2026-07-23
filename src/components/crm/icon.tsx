import { cn } from "@/lib/utils";

// Line-icon set — path data transcribed verbatim from the Vision CRM design
// export (24×24 viewBox, stroke icons). Kept in one place so every screen draws
// the same glyphs as the handoff. Sizes/stroke set per-usage via props.

export type IconName =
  | "search"
  | "chevron-down"
  | "chevron-right"
  | "plus"
  | "columns"
  | "filters"
  | "export"
  | "check"
  | "message"
  | "calendar"
  | "envelope"
  | "phone"
  | "eye"
  | "file"
  | "flag"
  | "arrow-right"
  | "pencil"
  | "star"
  | "map-pin"
  | "user"
  | "upload"
  | "download"
  | "trash"
  | "x"
  | "printer"
  | "maximize"
  | "minimize"
  | "minus"
  | "paperclip"
  | "clock"
  | "list"
  | "board";

// Each entry: array of <path d> strings (default), or a render fn for icons
// that need circles/rects.
const PATHS: Record<IconName, string[]> = {
  search: ["M21 21l-4.3-4.3"], // paired with a circle, see render
  "chevron-down": ["M6 9l6 6 6-6"],
  "chevron-right": ["M9 18l6-6-6-6"],
  plus: ["M12 5v14M5 12h14"],
  columns: [], // rect + lines, custom below
  // Rows of content: a bullet plus its line, three times over.
  list: ["M4 6h.01M4 12h.01M4 18h.01", "M9 6h11M9 12h11M9 18h11"],
  board: [], // three standing columns, custom below
  filters: ["M3 6h18M7 12h10M10 18h4"],
  export: ["M12 3v12M7 10l5 5 5-5M4 21h16"],
  check: ["M5 13l5 5L20 7"],
  message: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
  calendar: ["M3 5h18v16H3z", "M16 2v6M8 2v6M3 11h18"],
  envelope: ["M4 4h16v16H4z", "M4 7l8 6 8-6"],
  phone: [
    "M22 16.92V21a1 1 0 0 1-1.1 1A19 19 0 0 1 3 4.1 1 1 0 0 1 4 3h4.1a1 1 0 0 1 1 .8c.12.9.34 1.77.66 2.6a1 1 0 0 1-.23 1L8 9a16 16 0 0 0 7 7l1.6-1.5a1 1 0 0 1 1-.23c.83.32 1.7.54 2.6.66a1 1 0 0 1 .8 1z",
  ],
  eye: ["M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"], // + circle
  file: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z", "M14 2v6h6"],
  flag: ["M4 21V4l12 5-12 5"],
  "arrow-right": ["M5 12h14M13 6l6 6-6 6"],
  pencil: ["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"],
  star: ["M12 2l2.9 6.26L21 9.27l-5 4.87L17.18 21 12 17.77 6.82 21 8 14.14l-5-4.87 6.1-1.01L12 2z"],
  "map-pin": ["M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"], // + circle, see render
  user: [
    "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2",
    "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  ],
  upload: ["M12 16V4M7 9l5-5 5 5", "M4 20h16"],
  download: ["M12 4v12M7 11l5 5 5-5", "M4 20h16"],
  trash: ["M3 6h18", "M8 6V4h8v2", "M6 6l1 14h10l1-14", "M10 10v6M14 10v6"],
  x: ["M6 6l12 12M18 6L6 18"],
  printer: ["M6 9V3h12v6", "M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2", "M6 14h12v7H6z"],
  maximize: ["M8 3H5a2 2 0 0 0-2 2v3", "M21 8V5a2 2 0 0 0-2-2h-3", "M3 16v3a2 2 0 0 0 2 2h3", "M16 21h3a2 2 0 0 0 2-2v-3"],
  minimize: ["M8 3v3a2 2 0 0 1-2 2H3", "M21 8h-3a2 2 0 0 1-2-2V3", "M3 16h3a2 2 0 0 1 2 2v3", "M16 21v-3a2 2 0 0 1 2-2h3"],
  minus: ["M5 12h14"],
  paperclip: [
    "M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48",
  ],
  clock: ["M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z", "M12 7v5l3 2"],
};

type IconProps = {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
};

export function Icon({ name, size = 14, strokeWidth = 2, className }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      {name === "search" && <circle cx="11" cy="11" r="7" />}
      {name === "eye" && <circle cx="12" cy="12" r="3" />}
      {name === "map-pin" && <circle cx="12" cy="10" r="2.6" />}
      {name === "columns" && (
        <>
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 3v18M15 3v18" />
        </>
      )}
      {/* Kanban: three standing columns of unequal fill, so it reads as a board
          rather than as the (framed) "columns" icon next to it. */}
      {name === "board" && (
        <>
          <rect x="3" y="4" width="5" height="16" rx="1.5" />
          <rect x="9.5" y="4" width="5" height="11" rx="1.5" />
          <rect x="16" y="4" width="5" height="7" rx="1.5" />
        </>
      )}
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
