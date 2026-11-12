/** IZVOR mark: a stylised tree (origin of the timber) on a dark green tile. */
export function LogoMark({ className = 'size-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="14" fill="#14532d" />
      <path d="M32 12 18 34h9l-7 12h10v6h4v-6h10l-7-12h9z" fill="#ecfdf5" />
    </svg>
  );
}
