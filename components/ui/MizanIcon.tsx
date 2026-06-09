interface MizanIconProps {
  size?: number;
  withBackground?: boolean;
}

export function MizanIcon({ size = 32, withBackground = false }: MizanIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      width={size}
      height={size}
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="mi-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0a0a0f" />
          <stop offset="100%" stopColor="#12121a" />
        </linearGradient>
        <linearGradient id="mi-gold" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c9a84c" />
          <stop offset="50%" stopColor="#e8c96d" />
          <stop offset="100%" stopColor="#b8932a" />
        </linearGradient>
        <linearGradient id="mi-goldb" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#e8c96d" />
          <stop offset="100%" stopColor="#c9a84c" />
        </linearGradient>
      </defs>

      {withBackground && (
        <rect width="200" height="200" rx="44" ry="44" fill="url(#mi-bg)" stroke="#c9a84c" strokeWidth="0.6" strokeOpacity="0.2" />
      )}

      {/* Pillar */}
      <rect x="98.5" y="52" width="3" height="96" rx="1.5" fill="url(#mi-goldb)" />

      {/* Diamond top */}
      <polygon points="100,46 104,52 100,58 96,52" fill="url(#mi-gold)" />

      {/* ── KSA Sword ─────────────────────────────────────────
          Blade: uniform rectangle, tip is a small angled point.
          Guard: slim vertical bar, diamond above and below.
          Grip: single clean polygon — top bar matches blade
          height, thick right end cap, slim bottom bar (1px),
          open D-gap in the middle connecting back to guard.
      ────────────────────────────────────────────────────── */}

      {/* Blade */}
      <rect x="36" y="90" width="110" height="2.5" fill="url(#mi-gold)" />

      {/* Tip — curves upward */}
      <path d="M 36,90 C 34,89.5 33,89 33,89.2 C 33,89.5 34.5,92.5 36,92.5 Z" fill="url(#mi-gold)" />

      {/* Guard vertical bar */}
      <rect x="144.5" y="88" width="3" height="8" rx="1" fill="url(#mi-gold)" />

      {/* Diamond — top of guard */}
      <polygon points="146,85.5 148.5,88 146,90.5 143.5,88" fill="url(#mi-gold)" />

      {/* Diamond — bottom of guard */}
      <polygon points="146,93.5 148.5,96 146,98.5 143.5,96" fill="url(#mi-gold)" />

      {/* Grip — D-shape with rounded pommel */}
      <path
        d="M 147.5,90 L 167,90 A 3,3 0 0 1 170,93 A 3,3 0 0 1 167,96 L 147.5,96 L 147.5,95 L 165.75,95 A 1.25,1.25 0 0 0 167,93.75 A 1.25,1.25 0 0 0 165.75,92.5 L 147.5,92.5 Z"
        fill="url(#mi-gold)"
      />


      {/* ── Chains ───────────────────────────────────────────── */}
      <line
        x1="64" y1="91.25" x2="64" y2="109"
        stroke="#c9a84c" strokeWidth="0.9" strokeOpacity="0.75" strokeDasharray="2,1.5"
      />
      <line
        x1="122" y1="91.25" x2="122" y2="112"
        stroke="#c9a84c" strokeWidth="0.9" strokeOpacity="0.75" strokeDasharray="2,1.5"
      />
      <circle cx="64" cy="101" r="1.4" fill="#c9a84c" opacity="0.85" />
      <circle cx="122" cy="102" r="1.4" fill="#c9a84c" opacity="0.85" />

      {/* ── Pans ─────────────────────────────────────────────── */}
      <path
        d="M 50 110 Q 64 119 78 110"
        fill="none" stroke="url(#mi-gold)" strokeWidth="2.2" strokeLinecap="round"
      />
      <circle cx="50" cy="110" r="2" fill="#e8c96d" />
      <circle cx="78" cy="110" r="2" fill="#e8c96d" />

      <path
        d="M 108 113 Q 122 122 136 113"
        fill="none" stroke="url(#mi-gold)" strokeWidth="2.2" strokeLinecap="round"
      />
      <circle cx="108" cy="113" r="2" fill="#e8c96d" />
      <circle cx="136" cy="113" r="2" fill="#e8c96d" />

      {/* ── Base ─────────────────────────────────────────────── */}
      <rect x="90" y="148" width="20" height="2.5" rx="1.25" fill="url(#mi-gold)" opacity="0.9" />
      <rect x="84" y="152" width="32" height="2" rx="1" fill="url(#mi-gold)" opacity="0.5" />
    </svg>
  );
}
