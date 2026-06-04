/**
 * Monogram-bottle SVG — the brand-safe fallback for a missing/off-brand
 * product image.
 *
 * The photography render brief (docs/photography-render-brief-2026-05.md)
 * mandates a clean rectangular glass flacon with a single gold heart-"L"
 * monogram and NO text. This SVG mirrors that spec so any catalogue page
 * (PDP, FeaturedGrid card, similar-products rail) can drop it in when
 * the underlying photograph is absent or pending a re-render. It also
 * acts as a safer default than a broken `<Image>` fallback while the
 * owner's clean renders are being commissioned.
 *
 * Render notes:
 *   - Purely declarative SVG — no JS at runtime. Pre-rendered server-side.
 *   - Fills 100% of its parent's box; pair with a 3:4 aspect wrapper.
 *   - Single accent color = brand gold (#B89866-ish via HSL token). The
 *     surrounding wash uses the muted background token so the bottle
 *     reads as inset, not floating.
 *   - `aria-label` is the fragrance name when supplied; otherwise an
 *     a11y-safe generic.
 *
 * Usage:
 *   <div className="relative aspect-[3/4]">
 *     <MonogramBottle name={f.name} />
 *   </div>
 */

export function MonogramBottle({
  name,
  className,
}: {
  name?: string
  className?: string
}) {
  const label = name ? `${name} fragrance bottle` : 'Loveli Luxury fragrance bottle'
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="0 0 240 320"
      preserveAspectRatio="xMidYMid meet"
      xmlns="http://www.w3.org/2000/svg"
      className={className ?? 'absolute inset-0 h-full w-full'}
    >
      <defs>
        {/* Subtle warm wash behind the bottle so it sits inside its tile. */}
        <radialGradient id="ll-mb-bg" cx="50%" cy="55%" r="70%">
          <stop offset="0%" stopColor="hsl(38 28% 90%)" stopOpacity="1" />
          <stop offset="100%" stopColor="hsl(38 18% 84%)" stopOpacity="1" />
        </radialGradient>
        {/* Soft drop shadow under the bottle. */}
        <radialGradient id="ll-mb-shadow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="hsl(22 14% 13% / 0.30)" />
          <stop offset="60%" stopColor="hsl(22 14% 13% / 0.10)" />
          <stop offset="100%" stopColor="hsl(22 14% 13% / 0)" />
        </radialGradient>
        {/* Glass body — pale tonal wash. */}
        <linearGradient id="ll-mb-glass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(38 30% 96%)" stopOpacity="0.95" />
          <stop offset="100%" stopColor="hsl(38 20% 86%)" stopOpacity="0.95" />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="240" height="320" fill="url(#ll-mb-bg)" />

      {/* Floor shadow */}
      <ellipse cx="120" cy="290" rx="62" ry="8" fill="url(#ll-mb-shadow)" />

      {/* Atomiser collar */}
      <rect
        x="103"
        y="50"
        width="34"
        height="10"
        rx="2"
        fill="hsl(38 25% 70%)"
        stroke="hsl(38 25% 55%)"
        strokeWidth="0.75"
      />

      {/* Cap */}
      <rect
        x="96"
        y="22"
        width="48"
        height="28"
        rx="3"
        fill="hsl(38 22% 78%)"
        stroke="hsl(38 22% 60%)"
        strokeWidth="0.75"
      />
      {/* Cap highlight */}
      <rect x="101" y="26" width="6" height="18" rx="2" fill="hsl(38 30% 92%)" opacity="0.7" />

      {/* Shoulder transition (slight taper) */}
      <path
        d="M 100 60 Q 95 64 95 70 L 95 78 L 145 78 L 145 70 Q 145 64 140 60 Z"
        fill="url(#ll-mb-glass)"
        stroke="hsl(38 25% 55%)"
        strokeOpacity="0.45"
        strokeWidth="0.75"
      />

      {/* Bottle body — clean rectangular flacon. */}
      <rect
        x="78"
        y="78"
        width="84"
        height="200"
        rx="5"
        fill="url(#ll-mb-glass)"
        stroke="hsl(38 25% 55%)"
        strokeOpacity="0.45"
        strokeWidth="0.75"
      />

      {/* Body highlight — long vertical glint on the left edge. */}
      <rect
        x="84"
        y="86"
        width="5"
        height="184"
        rx="2"
        fill="hsl(38 38% 96%)"
        opacity="0.6"
      />

      {/* Label panel — black oval centred on body. */}
      <ellipse cx="120" cy="178" rx="34" ry="48" fill="hsl(22 14% 11%)" />
      {/* Label inner ring — subtle gold hairline. */}
      <ellipse
        cx="120"
        cy="178"
        rx="32"
        ry="46"
        fill="none"
        stroke="hsl(38 50% 60%)"
        strokeWidth="0.75"
        opacity="0.7"
      />

      {/* The monogram itself — a stylised heart-"L".
          The brief mandates a single gold mark, no text. We draw a heart
          containing a serif "L" stroke; both elements are gold. */}
      <g transform="translate(120 178)">
        {/* Heart */}
        <path
          d="M 0 16
             C -16 2 -24 -8 -16 -16
             C -10 -22 -4 -20 0 -12
             C 4 -20 10 -22 16 -16
             C 24 -8 16 2 0 16 Z"
          fill="none"
          stroke="hsl(38 60% 60%)"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        {/* Centered serif "L" stroke inside the heart */}
        <path
          d="M -3 -8 L -3 6 L 6 6"
          fill="none"
          stroke="hsl(38 60% 60%)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  )
}
