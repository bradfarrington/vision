export type NavItem = {
  label: string;
  href: string;
  // Exact SVG path data transcribed from VisionSidebar.dc.html (viewBox 0 0 24 24).
  paths: string[];
};

// Fixed nav order + icon geometry straight from VisionSidebar.dc.html. Routes
// are the intended paths; most screens land in later phases.
export const MAIN_NAV: NavItem[] = [
  {
    label: "Dashboard",
    href: "/dashboard",
    paths: ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M14 14h7v7h-7z", "M3 14h7v7H3z"],
  },
  {
    label: "Customers",
    href: "/customers",
    paths: [
      "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
      "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
      "M22 21v-2a4 4 0 0 0-3-3.87",
      "M16 3.13a4 4 0 0 1 0 7.75",
    ],
  },
  { label: "Leads", href: "/leads", paths: ["M3 4h18l-7 8v6l-4 2v-8L3 4z"] },
  {
    label: "Contracts",
    href: "/contracts",
    paths: [
      "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z",
      "M14 2v6h6",
      "M9 15l2 2 4-4",
    ],
  },
  {
    label: "Diary",
    href: "/diary",
    paths: ["M3 5h18v16H3z", "M16 2v6", "M8 2v6", "M3 11h18"],
  },
  {
    label: "Quoting",
    href: "/quoting",
    paths: ["M12 20h9", "M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"],
  },
  {
    label: "Stock",
    href: "/stock",
    paths: ["M21 8l-9-5-9 5v8l9 5 9-5V8z", "M3 8l9 5 9-5", "M12 13v8"],
  },
  {
    label: "Financials",
    href: "/financials",
    paths: ["M2 7h20v11H2z", "M12 12.5a2 2 0 1 0 0-.01", "M6 12.5h.01", "M18 12.5h.01"],
  },
  {
    label: "Communications",
    href: "/communications",
    paths: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
  },
  {
    label: "Marketing",
    href: "/marketing",
    paths: ["M3 11l18-6v14L3 13v-2z", "M11.6 16.8a3 3 0 1 1-5.8-1.6"],
  },
  {
    label: "Workflows",
    href: "/workflows",
    paths: ["M3 3h6v6H3z", "M15 15h6v6h-6z", "M9 6h5a2 2 0 0 1 2 2v7"],
  },
];

export const BOTTOM_NAV: NavItem[] = [
  {
    label: "Notifications",
    href: "/notifications",
    paths: ["M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9", "M13.7 21a2 2 0 0 1-3.4 0"],
  },
  {
    label: "Settings",
    href: "/settings",
    paths: [
      "M4 21v-7",
      "M4 10V3",
      "M12 21v-9",
      "M12 8V3",
      "M20 21v-5",
      "M20 12V3",
      "M2 14h4",
      "M10 8h4",
      "M18 16h4",
    ],
  },
];
