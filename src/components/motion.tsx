"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** One orchestrated entry for a dashboard surface: children marked [data-enter] rise in sequence once. */
export function EnterSequence({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.from("[data-enter]", { y: 8, opacity: 0, duration: 0.45, ease: "power3.out", stagger: 0.04, clearProps: "transform,opacity" });
    }, ref);
    return () => ctx.revert();
  }, []);
  return <div ref={ref} className={className}>{children}</div>;
}

export function BarChart({ data, label }: { data: { key: string; label: string; value: number; display: string }[]; label: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  useLayoutEffect(() => {
    if (!ref.current || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      gsap.from("rect[data-bar]", { scaleY: 0, transformOrigin: "50% 100%", duration: 0.6, ease: "power2.out", stagger: 0.025 });
    }, ref);
    return () => ctx.revert();
  }, [data]);
  const w = 100 / data.length;
  return (
    <figure>
      <svg ref={ref} viewBox="0 0 100 40" preserveAspectRatio="none" className="h-36 w-full" role="img" aria-label={label}>
        {data.map((d, i) => {
          const h = (d.value / max) * 36;
          return (
            <g key={d.key}>
              <title>{`${d.label}: ${d.display}`}</title>
              <rect data-bar x={i * w + w * 0.18} width={w * 0.64} y={40 - Math.max(h, 0.6)} height={Math.max(h, 0.6)} rx={0.6}
                fill={i === data.length - 1 ? "var(--amber)" : d.value ? "var(--ink)" : "var(--line)"} />
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 flex justify-between text-[11px] text-mute tabular">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </figcaption>
    </figure>
  );
}
