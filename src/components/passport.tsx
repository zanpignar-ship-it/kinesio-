"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { prefersReducedMotion } from "./motion";

/**
 * Signature moment: opening a unit's digital passport (usually after a QR scan).
 * Scan confirmation line → tag stamps in → status settles → actions rise. ~0.7s total.
 */
export function PassportReveal({ children, fromScan }: { children: ReactNode; fromScan?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current || prefersReducedMotion()) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      if (fromScan) tl.fromTo("[data-pass='scanline']", { scaleX: 0, opacity: 1 }, { scaleX: 1, duration: 0.28, ease: "power2.inOut" }).to("[data-pass='scanline']", { opacity: 0, duration: 0.2 });
      tl.from("[data-pass='figure']", { clipPath: "inset(0 0 100% 0)", duration: 0.45 }, fromScan ? "-=0.1" : 0)
        .from("[data-pass='tag']", { scale: 1.12, opacity: 0, duration: 0.3, ease: "back.out(2)" }, "-=0.25")
        .from("[data-pass='status']", { x: -6, opacity: 0, duration: 0.25 }, "-=0.1")
        .from("[data-pass='action']", { y: 10, opacity: 0, duration: 0.3, stagger: 0.05, clearProps: "transform,opacity" }, "-=0.1")
        .from("[data-pass='section']", { opacity: 0, duration: 0.3, stagger: 0.05, clearProps: "opacity" }, "-=0.2");
    }, ref);
    return () => ctx.revert();
  }, [fromScan]);
  return <div ref={ref}>{children}</div>;
}
