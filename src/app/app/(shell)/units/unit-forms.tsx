"use client";

import { ActionForm, Field, SelectField, Submit } from "@/components/form";
import type { ActionState } from "@/server/action";

export function StatusForm({ action, options }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; options: { value: string; label: string }[] }) {
  if (options.length === 0) return <p className="text-sm text-steel">Iz tega stanja ni ročnih prehodov.</p>;
  return (
    <ActionForm action={action} resetOnSuccess className="space-y-3">
      <SelectField name="to" label="Novo stanje" options={options} />
      <Field name="reason" label="Opomba" hint="neobvezno" placeholder="npr. zamenjan sveder, poškodovan kabel" />
      <Submit variant="secondary" pendingLabel="Shranjevanje …">Spremeni stanje</Submit>
    </ActionForm>
  );
}

export function BlockForm({ action, defaults }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; defaults: { start: string; end: string } }) {
  return (
    <ActionForm action={action} resetOnSuccess className="space-y-3">
      <SelectField name="kind" label="Vrsta" options={[{ value: "maintenance", label: "Servis" }, { value: "block", label: "Ni na voljo (druga raba)" }]} />
      <div className="grid grid-cols-2 gap-3">
        <Field name="start" label="Od" type="datetime-local" defaultValue={defaults.start} />
        <Field name="end" label="Do" type="datetime-local" defaultValue={defaults.end} />
      </div>
      <Field name="note" label="Opomba" hint="neobvezno" placeholder="Letni servis, menjava olja" />
      <Submit variant="secondary" pendingLabel="Shranjevanje …">Blokiraj termin</Submit>
    </ActionForm>
  );
}
