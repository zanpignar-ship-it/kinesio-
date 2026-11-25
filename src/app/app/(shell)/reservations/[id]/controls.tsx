"use client";

import { ActionForm, Field, Submit } from "@/components/form";
import { cx, inputClass } from "@/components/ui";
import type { ActionState } from "@/server/action";

type Act = (s: ActionState, fd: FormData) => Promise<ActionState>;

export function TransitionButtons({ action, options }: { action: Act; options: { to: string; label: string; tone: "primary" | "secondary" | "danger" }[] }) {
  if (!options.length) return <p className="text-sm text-steel">Rezervacija je zaključena. Nadaljnjih korakov ni.</p>;
  return (
    <ActionForm action={action} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.to} name="to" value={o.to} type="submit"
          className={cx("inline-flex h-10 items-center rounded-sm px-4 text-sm font-medium transition-colors",
            o.tone === "primary" ? "bg-ink text-white hover:bg-ink-2" : o.tone === "danger" ? "border border-bad/30 text-bad hover:bg-bad-soft" : "border border-line-strong bg-surface hover:border-ink/40")}>
          {o.label}
        </button>
      ))}
    </ActionForm>
  );
}

export function RescheduleForm({ action, start, end }: { action: Act; start: string; end: string }) {
  return (
    <ActionForm action={action} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field name="start" label="Prevzem" type="datetime-local" defaultValue={start} />
        <Field name="end" label="Vračilo" type="datetime-local" defaultValue={end} />
      </div>
      <Submit variant="secondary" pendingLabel="Preverjanje …">Spremeni termin</Submit>
    </ActionForm>
  );
}

export function ReassignForm({ action, options, current }: { action: Act; options: { id: string; code: string }[]; current: string }) {
  if (options.length <= 1) return null;
  return (
    <ActionForm action={action} className="flex items-center gap-2">
      <label className="sr-only" htmlFor={`ra-${current}`}>Zamenjaj enoto</label>
      <select id={`ra-${current}`} name="unitId" defaultValue={current} className={cx(inputClass, "h-8 w-36 text-[13px]")}>
        {options.map((o) => <option key={o.id} value={o.id}>{o.code}</option>)}
      </select>
      <Submit variant="ghost" size="sm" pendingLabel="…">Zamenjaj</Submit>
    </ActionForm>
  );
}
