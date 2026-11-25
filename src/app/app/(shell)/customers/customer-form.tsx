"use client";

import { useState } from "react";
import { ActionForm, CheckboxField, Field, Submit, TextareaField } from "@/components/form";
import { cx } from "@/components/ui";
import type { ActionState } from "@/server/action";

type D = Partial<{ kind: string; name: string; companyName: string; taxId: string; email: string; phone: string; address: string; notes: string; discountPercent: string; marketingConsent: boolean }>;

export function CustomerForm({ action, defaults = {}, submitLabel, next }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; defaults?: D; submitLabel: string; next?: string }) {
  const [kind, setKind] = useState(defaults.kind ?? "individual");
  return (
    <ActionForm action={action} className="space-y-6">
      <input type="hidden" name="kind" value={kind} />
      {next && <input type="hidden" name="next" value={next} />}
      <div role="radiogroup" aria-label="Vrsta stranke" className="inline-flex rounded-sm bg-sunken p-0.5 text-sm">
        {[["individual", "Fizična oseba"], ["business", "Podjetje"]].map(([k, l]) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)}
            className={cx("h-8 rounded-xs px-4", kind === k ? "bg-surface font-medium shadow-raise" : "text-steel")}>{l}</button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="name" label={kind === "business" ? "Kontaktna oseba" : "Ime in priimek"} defaultValue={defaults.name} required className="sm:col-span-2" />
        {kind === "business" && <>
          <Field name="companyName" label="Podjetje" defaultValue={defaults.companyName} />
          <Field name="taxId" label="Davčna številka" defaultValue={defaults.taxId} placeholder="SI12345678" />
        </>}
        <Field name="phone" label="Telefon" type="tel" defaultValue={defaults.phone} />
        <Field name="email" label="E-pošta" type="email" defaultValue={defaults.email} />
        <Field name="address" label="Naslov" hint="neobvezno" defaultValue={defaults.address} className="sm:col-span-2" />
        <Field name="discountPercent" label="Stalni popust (%)" inputMode="decimal" defaultValue={defaults.discountPercent ?? "0"} />
        <TextareaField name="notes" label="Interne opombe" hint="stranka jih ne vidi" defaultValue={defaults.notes} className="sm:col-span-2" rows={3} />
      </div>
      <CheckboxField name="marketingConsent" label="Stranka soglaša s prejemanjem obvestil o ponudbah" defaultChecked={defaults.marketingConsent}
        description="Označite le, če je stranka soglasje izrecno dala. Datum soglasja se zabeleži." />
      <Submit pendingLabel="Shranjevanje …">{submitLabel}</Submit>
    </ActionForm>
  );
}
