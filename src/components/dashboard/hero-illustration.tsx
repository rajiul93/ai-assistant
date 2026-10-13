/** The home banner's picture: a target with an arrow in it, on a stack of books. Pure SVG, no image file. */
export function HeroIllustration({ className }: { className?: string }) {
  return <svg viewBox="0 0 200 160" className={className} aria-hidden="true">
    <ellipse cx="104" cy="146" rx="80" ry="9" fill="#1e3a8a" opacity="0.18" />
    {/* books */}
    <g>
      <rect x="34" y="112" width="138" height="26" rx="6" fill="#6d5dfc" />
      <rect x="40" y="117" width="126" height="16" rx="3" fill="#ede9fe" />
      <rect x="34" y="128" width="138" height="10" rx="5" fill="#5b4be0" />
      <rect x="46" y="86" width="118" height="28" rx="6" fill="#3b82f6" />
      <rect x="52" y="91" width="106" height="17" rx="3" fill="#e0ecff" />
      <rect x="46" y="104" width="118" height="10" rx="5" fill="#2f6fe0" />
      <rect x="58" y="64" width="98" height="24" rx="6" fill="#f59e0b" />
      <rect x="64" y="69" width="86" height="14" rx="3" fill="#fff4d6" />
      <rect x="58" y="80" width="98" height="8" rx="4" fill="#e08a00" />
    </g>
    {/* target */}
    <g transform="translate(118 44)">
      <circle r="38" fill="#ef4444" />
      <circle r="30" fill="#ffffff" />
      <circle r="22" fill="#ef4444" />
      <circle r="14" fill="#ffffff" />
      <circle r="7" fill="#ef4444" />
    </g>
    {/* arrow in the bullseye */}
    <g>
      <line x1="118" y1="44" x2="170" y2="6" stroke="#b45309" strokeWidth="4" strokeLinecap="round" />
      <path d="M170 6 l10 -6 l-2 11 z" fill="#f59e0b" />
      <path d="M163 11 l12 -10 l3 4 l-10 9 z" fill="#fbbf24" />
      <circle cx="118" cy="44" r="3.5" fill="#7c2d12" />
    </g>
  </svg>;
}
