// =============================================================================
// GermaniaApp — Wappen (crest)
// Heraldic shield in the fraternity Couleur: from the bottom black, gold, red
// (so top→bottom: red, gold, black), with crossed Stocherkahn poles behind it
// and the founding year 1816. Returns an inline SVG string.
// =============================================================================
const RED = '#9B1B1B';
const GOLD = '#C8A020';
const BLACK = '#16140F';

export function crestSvg(size = 40): string {
  return `
<svg viewBox="0 0 100 124" width="${size}" height="${(size * 124) / 100}"
     xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Wappen Germania 1816">
  <defs>
    <clipPath id="shield">
      <path d="M12 10 H88 V66 C88 92 68 106 50 116 C32 106 12 92 12 66 Z"/>
    </clipPath>
  </defs>
  <!-- crossed punting poles behind the shield -->
  <g stroke="${GOLD}" stroke-width="4.5" stroke-linecap="round">
    <line x1="14" y1="6" x2="86" y2="112"/>
    <line x1="86" y1="6" x2="14" y2="112"/>
  </g>
  <g stroke="${BLACK}" stroke-width="1.4" stroke-linecap="round" opacity="0.7">
    <line x1="14" y1="6" x2="86" y2="112"/>
    <line x1="86" y1="6" x2="14" y2="112"/>
  </g>
  <!-- tricolour bands clipped to the shield (red, gold, black top→bottom) -->
  <g clip-path="url(#shield)">
    <rect x="10" y="8"  width="80" height="37" fill="${RED}"/>
    <rect x="10" y="45" width="80" height="36" fill="${GOLD}"/>
    <rect x="10" y="81" width="80" height="40" fill="${BLACK}"/>
  </g>
  <!-- shield outline -->
  <path d="M12 10 H88 V66 C88 92 68 106 50 116 C32 106 12 92 12 66 Z"
        fill="none" stroke="${GOLD}" stroke-width="3"/>
  <text x="50" y="103" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif"
        font-size="16" font-weight="700" fill="${GOLD}">1816</text>
</svg>`.trim();
}
