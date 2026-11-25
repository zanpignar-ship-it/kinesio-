import type { ComponentProps } from "react";
import { cx, inputClass } from "@/components/ui";

/** Native select with a drawn chevron (keeps platform pickers and accessibility). */
export function Select({ className, children, ...p }: ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cx(inputClass, "appearance-none pr-9", className)} {...p}>
        {children}
      </select>
      <svg viewBox="0 0 20 20" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-steel" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 8l4 4 4-4" />
      </svg>
    </div>
  );
}
