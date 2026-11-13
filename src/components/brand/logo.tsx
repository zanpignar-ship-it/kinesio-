/** IZVOR mark: a stylised tree (origin of the timber) rising from a spring line. */
export function LogoMark({ className = 'size-7', variant = 'dark' }: { className?: string; variant?: 'dark' | 'light' }) {
  const tile = variant === 'light' ? '#d1fae5' : '#14532d';
  const tree = variant === 'light' ? '#14532d' : '#ecfdf5';
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="16" fill={tile} />
      <path d="M32 11 18 33h9l-7 12h10v5h4v-5h10l-7-12h9z" fill={tree} />
      <path d="M17 54c5-2.5 10-2.5 15 0s10 2.5 15 0" stroke={tree} strokeWidth="2.5" strokeLinecap="round" fill="none" opacity=".7" />
    </svg>
  );
}
