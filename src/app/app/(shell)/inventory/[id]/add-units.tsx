"use client";

import { useState } from "react";
import { ActionForm, Field, Submit, TextareaField } from "@/components/form";
import { cx } from "@/components/ui";
import type { ActionState } from "@/server/action";

export function AddUnits({ action }: { action: (s: ActionState, fd: FormData) => Promise<ActionState> }) {
  const [mode, setMode] = useState<"seq" | "list">("seq");
  return (
    <ActionForm action={action} resetOnSuccess className="space-y-3">
      <input type="hidden" name="mode" value={mode} />
      <div role="tablist" className="inline-flex rounded-sm bg-sunken p-0.5 text-[13px]">
        {(["seq", "list"] as const).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} onClick={() => setMode(m)}
            className={cx("h-7 rounded-xs px-3", mode === m ? "bg-surface font-medium shadow-raise" : "text-steel")}>
            {m === "seq" ? "Zaporedne številke" : "Seznam številk"}
          </button>
        ))}
      </div>
      {mode === "seq" ? (
        <div className="grid grid-cols-2 gap-3">
          <Field name="prefix" label="Predpona" placeholder="KLD" />
          <Field name="count" label="Število" type="number" min={1} max={200} defaultValue="1" />
        </div>
      ) : (
        <TextareaField name="codes" label="Inventarne številke" hint="ena na vrstico; serijska po vejici" placeholder={"KLD-014, SN 88213\nKLD-015, SN 88219"} rows={4} />
      )}
      <Submit variant="secondary" pendingLabel="Dodajanje …">Dodaj enote</Submit>
    </ActionForm>
  );
}
