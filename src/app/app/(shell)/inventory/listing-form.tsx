"use client";

import { ActionForm, CheckboxField, Field, SelectField, Submit, TextareaField } from "@/components/form";
import type { ActionState } from "@/server/action";

type Cat = { id: string; name: string };
type Defaults = Partial<{
  title: string; categoryId: string; manufacturer: string; model: string; description: string; specs: string;
  priceDay: string; priceWeek: string; priceMonth: string; deposit: string; bufferHours: string; bookingMode: string;
  deliveryAvailable: boolean; isPublished: boolean;
}>;

export function ListingForm({ action, categories, defaults = {}, isNew }: { action: (s: ActionState, fd: FormData) => Promise<ActionState>; categories: Cat[]; defaults?: Defaults; isNew?: boolean }) {
  return (
    <ActionForm action={action} className="space-y-8">
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-sm font-semibold">Osnovno</legend>
        <Field name="title" label="Naziv artikla" placeholder="Rušilno kladivo Makita HM1812" defaultValue={defaults.title} required className="sm:col-span-2" />
        <SelectField name="categoryId" label="Kategorija" defaultValue={defaults.categoryId} options={categories.map((c) => ({ value: c.id, label: c.name }))} />
        <div className="grid grid-cols-2 gap-4">
          <Field name="manufacturer" label="Proizvajalec" defaultValue={defaults.manufacturer} />
          <Field name="model" label="Model" defaultValue={defaults.model} />
        </div>
        <TextareaField name="description" label="Opis" hint="viden na tržnici" defaultValue={defaults.description} className="sm:col-span-2" rows={4} />
        <TextareaField name="specs" label="Tehnični podatki" hint="ena vrstica: lastnost: vrednost" placeholder={"Moč: 2000 W\nTeža: 31 kg\nUdarna energija: 63 J"} defaultValue={defaults.specs} className="sm:col-span-2" rows={4} />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-4">
        <legend className="mb-1 text-sm font-semibold">Cene in pogoji</legend>
        <p className="mb-2 text-sm text-steel sm:col-span-4">Pri izračunu se samodejno uporabi najugodnejša kombinacija dnevne, tedenske in mesečne cene. Cene vključujejo DDV.</p>
        <Field name="priceDay" label="Na dan (€)" inputMode="decimal" defaultValue={defaults.priceDay} required />
        <Field name="priceWeek" label="Na teden (€)" hint="neobvezno" inputMode="decimal" defaultValue={defaults.priceWeek} />
        <Field name="priceMonth" label="Na mesec (€)" hint="neobvezno" inputMode="decimal" defaultValue={defaults.priceMonth} />
        <Field name="deposit" label="Varščina (€)" inputMode="decimal" defaultValue={defaults.deposit ?? "0"} />
        <Field name="bufferHours" label="Čas med najemi (ure)" hint="pregled, čiščenje" inputMode="decimal" defaultValue={defaults.bufferHours ?? "0"} className="sm:col-span-2" />
        <SelectField name="bookingMode" label="Način rezervacije na tržnici" defaultValue={defaults.bookingMode ?? "request"} className="sm:col-span-2"
          options={[{ value: "request", label: "Na povpraševanje (potrdite ročno)" }, { value: "instant", label: "Takojšnja rezervacija" }]} />
      </fieldset>

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-semibold">Objava</legend>
        <CheckboxField name="deliveryAvailable" label="Možna dostava" defaultChecked={defaults.deliveryAvailable} />
        <CheckboxField name="isPublished" label="Objavi na RENTORA tržnici" defaultChecked={defaults.isPublished}
          description="Prikazani bodo opis, cene in število prostih enot. Inventarne številke, stranke in finančni podatki ostanejo zasebni." />
      </fieldset>

      {isNew && (
        <fieldset className="grid gap-4 rounded-md border border-line bg-paper p-4 sm:grid-cols-2">
          <legend className="px-1 text-sm font-semibold">Fizične enote</legend>
          <p className="text-sm text-steel sm:col-span-2">Koliko kosov tega artikla imate? Vsak kos dobi svojo inventarno številko in QR potni list. Serijske številke dodate kasneje.</p>
          <Field name="unitCount" label="Število enot" type="number" min={0} max={200} defaultValue="1" />
          <Field name="codePrefix" label="Predpona inventarne številke" placeholder="npr. KLD" />
        </fieldset>
      )}
      <Submit size="lg" pendingLabel="Shranjevanje …">{isNew ? "Dodaj artikel" : "Shrani spremembe"}</Submit>
    </ActionForm>
  );
}
