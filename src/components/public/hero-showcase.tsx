"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { buttonClass, cx } from "@/components/ui";
import { ExcavatorDrawing } from "./equipment-art";
import { container } from "./format";

/**
 * Hero with the site's one signature motion: a large technical drawing of a
 * compact excavator that, on scroll, settles into a real listing card while
 * price, availability and the action reveal in sequence.
 *
 * The server renders the FINAL card. Initial (pre-scroll) state is applied with
 * `motion-safe:` utilities so there is no flash and no hydration mismatch;
 * GSAP only tweens from that computed state to the final one. With reduced
 * motion (or no JS, via <noscript>) the final card is shown statically.
 */
export function HeroShowcase({ children }: { children: ReactNode }) {
  const section = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const el = section.current;
    if (!el) return;
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      mm.add(
        {
          desktop: "(min-width: 1024px) and (prefers-reduced-motion: no-preference)",
          mobile: "(max-width: 1023.98px) and (prefers-reduced-motion: no-preference)",
        },
        (c) => {
          const desktop = Boolean(c.conditions?.desktop);
          const tl = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: desktop
              ? { trigger: el, start: "top top+=64", end: "+=70%", scrub: 0.6, pin: true, anticipatePin: 1 }
              : { trigger: "[data-stage]", start: "top 85%", end: "bottom 60%", scrub: 0.6 },
          });
          tl.to("[data-art]", { x: 0, y: 0, scale: 1, duration: 1, ease: "power1.inOut" }, 0)
            .to("[data-dims]", { opacity: 0, duration: 0.35 }, 0.1)
            .to("[data-chrome]", { opacity: 1, duration: 0.4 }, 0.5)
            .to("[data-reveal='head']", { opacity: 1, y: 0, duration: 0.3 }, 0.7)
            .to("[data-reveal='price']", { opacity: 1, y: 0, duration: 0.3 }, 0.95)
            .to("[data-reveal='avail']", { opacity: 1, y: 0, duration: 0.3 }, 1.15)
            .to("[data-reveal='action']", { opacity: 1, y: 0, duration: 0.3 }, 1.35)
            .to({}, { duration: 0.25 });
        },
      );
    }, el);

    return () => ctx.revert();
  }, []);

  const pending = "motion-safe:opacity-0 motion-safe:[transform:translateY(10px)]";

  return (
    <section ref={section} data-showcase aria-labelledby="hero-title" className="relative overflow-x-clip border-b border-line bg-paper">
      <noscript>
        <style>{`[data-showcase] [data-chrome],[data-showcase] [data-reveal]{opacity:1!important;transform:none!important}[data-showcase] [data-art]{transform:none!important}[data-showcase] [data-dims]{opacity:0!important}`}</style>
      </noscript>
      <div className={cx(container, "grid gap-12 py-12 sm:py-16 lg:min-h-[calc(100svh-4rem)] lg:grid-cols-12 lg:items-center lg:gap-8 lg:py-10")}>
        <div className="lg:col-span-6 xl:col-span-6">{children}</div>

        <div data-stage className="relative lg:col-span-6 lg:pl-6 xl:pl-12">
          <article
            aria-label="Primer oglasa na tržnici"
            className="relative mx-auto w-full max-w-[400px] lg:mr-0"
          >
            <div data-chrome aria-hidden className="absolute inset-0 rounded-md border border-line bg-surface shadow-float motion-safe:opacity-0" />
            <div className="relative">
              <div className="relative p-2">
                <div data-chrome aria-hidden className="absolute inset-2 rounded-sm bg-sunken motion-safe:opacity-0" />
                <div
                  data-art
                  className={cx(
                    "relative origin-center text-ink will-change-transform",
                    "motion-safe:[transform:translate(-4%,14%)_scale(1.45)]",
                    "lg:motion-safe:[transform:translate(-14%,22%)_scale(1.75)]",
                  )}
                >
                  <ExcavatorDrawing className="block aspect-[16/10] h-auto w-full" role="img" aria-label="Tehnična risba kompaktnega bagra" />
                </div>
                <span
                  data-chrome
                  className="absolute top-4 left-4 rounded-xs border border-line-strong bg-surface px-2 py-0.5 text-[11px] font-medium text-steel motion-safe:opacity-0"
                >
                  Primer oglasa
                </span>
              </div>

              <div className="px-5 pt-3 pb-5">
                <div data-reveal="head" className={pending}>
                  <p className="text-[13px] text-steel">Gradbena mehanizacija</p>
                  <p className="mt-1 text-lg font-semibold tracking-tight text-ink">Kompaktni bager 1,8 t</p>
                </div>

                <div className="mt-4 flex items-end justify-between gap-4 border-t border-line pt-4">
                  <p data-reveal="price" className={pending}>
                    <span className="tabular text-[28px] leading-none font-semibold tracking-tight text-ink">95 €</span>
                    <span className="ml-1 text-sm text-steel">/ dan</span>
                  </p>
                  <p data-reveal="avail" className={cx(pending, "flex items-center gap-2 rounded-xs bg-ok-soft px-2 py-1 text-[13px] font-medium text-ok")}>
                    <span aria-hidden className="size-1.5 rounded-full bg-current" />
                    Na voljo
                  </p>
                </div>

                <div data-reveal="action" className={cx(pending, "mt-4")}>
                  <Link href="/equipment?category=gradbena-mehanizacija" className={cx(buttonClass("primary", "md"), "w-full")}>
                    Preveri termin
                  </Link>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
