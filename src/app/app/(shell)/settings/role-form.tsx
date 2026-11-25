"use client";
import { ActionForm, Field, SelectField, Submit } from "@/components/form";
import { cx, inputClass } from "@/components/ui";
import type { ActionState } from "@/server/action";

export function RoleForm({ action, role, roles }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; role: string; roles: { value: string; label: string }[] }) {
  return (
    <ActionForm action={action} className="flex items-center gap-2">
      <label className="sr-only" htmlFor={`role-${role}`}>Vloga</label>
      <select name="role" defaultValue={role} className={cx(inputClass, "h-8 w-40 text-[13px]")}>{roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
      <Submit variant="ghost" size="sm" pendingLabel="…">Shrani</Submit>
    </ActionForm>
  );
}

export function AddMemberForm({ action, roles }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; roles: { value: string; label: string }[] }) {
  return (
    <ActionForm action={action} resetOnSuccess className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
      <Field name="email" type="email" label="E-pošta sodelavca" placeholder="ime@podjetje.si" />
      <SelectField name="role" label="Vloga" options={roles.filter((r) => r.value !== "owner")} defaultValue="receptionist" />
      <Submit variant="secondary">Dodaj</Submit>
    </ActionForm>
  );
}
