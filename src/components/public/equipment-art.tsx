import type { SVGProps } from "react";

/**
 * Restrained technical line drawings. Strokes use currentColor; amber is only
 * ever used as a fill behind ink lines.
 */

const glyphs: Record<string, string> = {
  excavator:
    "M8 34h20a4 4 0 0 1 0 8H8a4 4 0 0 1 0-8zM10 38h.01M26 38h.01M8 34v-7h13l3 7M11 27v-8h7l2.5 8M21 29l9-14 8 2M38 17l4 13M42 30q-6 1-6.5 8H43z",
  lift: "M10 10h28v4H10zM10 10V6h28v4M12 14l24 16M36 14 12 30M8 30h32v6H8zM13 40a3 3 0 1 0 0 .01M35 40a3 3 0 1 0 0 .01",
  drill: "M8 14h22v10H8zM30 17h6v4h-6zM36 19h8M15 24l-3 14h8l2-14M10 38h12v5H10z",
  hammer: "M10 8h28M18 8v4M30 8v4M17 12h14v16H17zM21 16h6M24 28v12M22 40l2 5 2-5",
  compactor: "M6 38h32v4H6zM12 26h18v12H12zM16 30h10M28 26 40 8M37 6l6 4",
  generator: "M6 14h36v24H6zM11 19h17v14H11zM34 23a2 2 0 1 0 0 .01M34 30a2 2 0 1 0 0 .01M10 38v4M38 38v4M15 23h9M15 27h9",
  compressor: "M13 20h18a7 7 0 0 1 0 14H13a7 7 0 0 1 0-14zM32 38a4 4 0 1 0 0 .01M36 22l6-10M16 20v-3M13 14a3 3 0 1 0 6 0 3 3 0 1 0-6 0",
  trailer: "M4 18v8h34v-8M4 26v6h34v-6M22 38a4 4 0 1 0 0 .01M38 29h8M10 18v8M16 18v8M28 18v8M32 18v8",
  tractor: "M14 25a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM14 32a2 2 0 1 0 0 .01M38 33a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM23 33h10V24H14M14 25V10h12l3 14M32 24v-8M18 14h7l2 8",
  leaf: "M10 38C10 18 24 8 40 8c0 18-12 30-30 30zM10 38l18-18M20 28h8M24 24v-6",
  cleaning: "M8 22h16v16H8zM12 40a3 3 0 1 0 0 .01M24 30c8 0 8-12 14-12M38 18l6-10M12 26h8",
  tent: "M4 40 24 8l20 32zM24 8v32M18 40l6-10 6 10M2 40h44",
};

export function CategoryGlyph({ icon, ...p }: SVGProps<SVGSVGElement> & { icon: string }) {
  const d = glyphs[icon] ?? glyphs.excavator;
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
      <path d={d} />
    </svg>
  );
}

/** Thumbnail used where a listing has no photography: glyph on a measured grid. */
export function ListingArt({ icon, className }: { icon: string; className?: string }) {
  return (
    <div className={["relative overflow-hidden bg-sunken text-ink-2", className].filter(Boolean).join(" ")} aria-hidden>
      <svg className="absolute inset-0 h-full w-full text-line-strong" aria-hidden>
        <defs>
          <pattern id={`g-${icon}`} width="16" height="16" patternUnits="userSpaceOnUse">
            <path d="M16 0H0V16" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#g-${icon})`} opacity="0.55" />
      </svg>
      <CategoryGlyph icon={icon} className="absolute top-1/2 left-1/2 h-[56%] w-[56%] -translate-x-1/2 -translate-y-1/2" />
    </div>
  );
}

/**
 * Side elevation of a compact excavator. `dims` group carries dimension lines
 * and centre marks that read as a technical drawing at large scale.
 */
export function ExcavatorDrawing(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 640 400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      {/* ground */}
      <path d="M24 349H616" strokeWidth={1} opacity={0.5} />

      {/* dozer blade */}
      <path d="M60 304q-7 22 0 44h14v-44z" />
      <path d="M74 316l26-4M74 334l26-4" />

      {/* undercarriage */}
      <rect x="90" y="298" width="244" height="50" rx="25" />
      <rect x="100" y="308" width="224" height="30" rx="15" strokeWidth={1.2} />
      <circle cx="115" cy="323" r="15" />
      <circle cx="115" cy="323" r="4" strokeWidth={1.2} />
      <circle cx="309" cy="323" r="15" />
      <circle cx="309" cy="323" r="4" strokeWidth={1.2} />
      <circle cx="166" cy="330" r="7" strokeWidth={1.4} />
      <circle cx="212" cy="330" r="7" strokeWidth={1.4} />
      <circle cx="258" cy="330" r="7" strokeWidth={1.4} />
      <path d="M118 348v-4M140 348v-4M162 348v-4M184 348v-4M206 348v-4M228 348v-4M250 348v-4M272 348v-4M294 348v-4" strokeWidth={1} />

      {/* slew ring */}
      <path d="M150 298v-10h124v10" />

      {/* upper structure, painted */}
      <path d="M106 288V250q0-12 12-12h132l42 26 8 24z" fill="var(--amber)" />
      <path d="M118 262h52M118 270h52M118 278h52" strokeWidth={1.2} />
      <path d="M146 238v-16h8v16" />

      {/* cab */}
      <path d="M186 238V148q0-10 10-10h62l24 100" />
      <path d="M198 150h56l19 80h-75z" strokeWidth={1.4} />
      <path d="M180 138h86" />
      <path d="M226 150v80" strokeWidth={1} opacity={0.6} />

      {/* boom */}
      <path d="M284 274l14-24q44-118 118-130l50 12-6 22-44-10q-58 12-110 136z" fill="var(--amber)" />
      <circle cx="294" cy="264" r="6" />

      {/* boom cylinder */}
      <path d="M300 252l46-62" strokeWidth={9} />
      <path d="M300 252l46-62" strokeWidth={5} stroke="var(--paper)" />
      <path d="M346 190l18-24" strokeWidth={2.5} />

      {/* arm */}
      <path d="M458 104l22 6 74 176-16 12-86-158z" />
      <circle cx="464" cy="140" r="7" />

      {/* arm cylinder */}
      <path d="M392 122l44-12" strokeWidth={9} />
      <path d="M392 122l44-12" strokeWidth={5} stroke="var(--paper)" />
      <path d="M436 110l26-4" strokeWidth={2.5} />

      {/* bucket cylinder */}
      <path d="M484 150l26 64" strokeWidth={8} />
      <path d="M484 150l26 64" strokeWidth={4} stroke="var(--paper)" />
      <path d="M510 214l20 50" strokeWidth={2.5} />

      {/* bucket */}
      <path d="M530 284q-12 44 24 60l38-8q-4-38-32-56z" />
      <path d="M556 344l5 9M570 341l5 9M584 338l5 9" />
      <circle cx="546" cy="290" r="6" />

      {/* dimension lines and centre marks */}
      <g data-dims strokeWidth={1} opacity={0.55}>
        <path d="M60 376H592M60 370v12M592 370v12" />
        <path d="M612 120V349M606 120h12M606 349h12" />
        <path d="M286 264h16M294 256v16M456 140h16M464 132v16M538 290h16M546 282v16" />
      </g>
    </svg>
  );
}
