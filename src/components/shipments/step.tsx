import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

/** One numbered step of the shipment workflow, drawn as a vertical timeline. */
export function Step({ n, title, hint, done, last = false, children }: { n: number; title: string; hint?: string; done: boolean; last?: boolean; children: ReactNode }) {
  return (
    <li className="relative pl-12 sm:pl-14">
      {last ? null : <span aria-hidden className="bg-border absolute top-10 bottom-0 left-[1.1rem] w-px sm:left-[1.35rem]" />}
      <span
        className={cn(
          'absolute top-0 left-0 flex size-9 items-center justify-center rounded-full text-sm font-semibold ring-4 ring-background sm:size-11',
          done ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground border-2',
        )}
        aria-hidden
      >
        {done ? <Check className="size-4 sm:size-5" /> : n}
      </span>
      <div className="flex flex-col gap-4 pb-10">
        <div className="flex min-h-9 flex-col justify-center sm:min-h-11">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          {hint ? <p className="text-muted-foreground text-sm">{hint}</p> : null}
        </div>
        {children}
      </div>
    </li>
  );
}
