// Illustrative (non-functional) map thumbnail — transcribed verbatim from the
// design export. It's a decorative placeholder for a real map tile; a live map
// lands with geocoding in a later phase, hence the "Illustrative map" caption.
export function IllustrativeMap({ className }: { className?: string }) {
  return (
    <div
      className={`relative h-[110px] overflow-hidden rounded-lg border border-[#e7e7ea] bg-[#e8ece6] ${className ?? ""}`}
    >
      <svg
        viewBox="0 0 300 110"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
        aria-hidden
      >
        <rect width="300" height="110" fill="#e9ede7" />
        <path d="M-10 78 L120 40 L210 66 L320 34" stroke="#cdd6ca" strokeWidth="16" fill="none" />
        <path d="M56 -10 L84 120" stroke="#cdd6ca" strokeWidth="12" fill="none" />
        <path d="M170 -10 L150 120" stroke="#dfe4dc" strokeWidth="9" fill="none" />
        <path
          d="M-10 78 L120 40 L210 66 L320 34"
          stroke="#fff"
          strokeWidth="2"
          strokeDasharray="1 7"
          strokeLinecap="round"
          fill="none"
        />
        <rect x="14" y="20" width="30" height="20" rx="2" fill="#dbe2d7" />
        <rect x="96" y="12" width="34" height="22" rx="2" fill="#dbe2d7" />
        <rect x="216" y="16" width="30" height="24" rx="2" fill="#dbe2d7" />
        <rect x="24" y="72" width="34" height="26" rx="2" fill="#dbe2d7" />
        <rect x="118" y="80" width="40" height="24" rx="2" fill="#dbe2d7" />
        <rect x="232" y="78" width="36" height="26" rx="2" fill="#dbe2d7" />
        <path d="M188 58 L246 44" stroke="#bcd0e6" strokeWidth="6" opacity=".7" fill="none" />
      </svg>
      <div className="absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-full">
        <svg width="26" height="34" viewBox="0 0 26 34" aria-hidden>
          <path
            d="M13 0C5.8 0 0 5.8 0 13c0 9 13 21 13 21s13-12 13-21C26 5.8 20.2 0 13 0z"
            fill="var(--accent-blue)"
          />
          <circle cx="13" cy="13" r="5" fill="#fff" />
        </svg>
      </div>
      <span className="absolute bottom-[5px] right-[6px] rounded bg-white/70 px-[5px] py-px text-[9px] text-[#8a938a]">
        Illustrative map
      </span>
    </div>
  );
}
