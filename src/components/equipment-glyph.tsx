/** Technical line drawing used where no equipment photo exists yet. Category-agnostic machine silhouette. */
export function EquipmentGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 140" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 118h200" strokeDasharray="2 5" opacity=".5" />
      <rect x="44" y="96" width="104" height="18" rx="9" />
      <circle cx="56" cy="105" r="6" /><circle cx="136" cy="105" r="6" /><circle cx="96" cy="105" r="3" />
      <path d="M58 96V70h44l10 26" /><path d="M64 70V48h30l8 22" /><path d="M70 54h18v12H70z" opacity=".6" />
      <path d="M112 74l46-34 26 10" /><path d="M158 40l6 30" /><path d="M164 70l-14 16 22 4 6-16z" />
      <path d="M118 78l40-30" opacity=".5" />
    </svg>
  );
}
