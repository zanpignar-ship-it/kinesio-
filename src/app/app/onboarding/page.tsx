import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSession } from "@/server/session";
import { ActionForm, Field, Submit } from "@/components/form";
import { Logo } from "@/components/logo";
import { withPublic } from "@/server/db";
import { formatMoney } from "@/domain/money";
import { createOrgAction } from "./actions";

export const metadata: Metadata = { title: "Nastavitev izposojevalnice", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const s = await getSession();
  if (!s) redirect("/login");
  const plans = await withPublic((tx) =>
    tx.query<{ code: string; name: string; price_month_cents: number; limits: { units: number; locations: number } }>(
      "select code, name, price_month_cents, limits from subscription_plans where is_active order by sort"));
  return (
    <div className="min-h-dvh px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-2xl">
        <Logo />
        <h1 className="display mt-10 text-4xl sm:text-5xl">Postavimo vašo izposojevalnico.</h1>
        <p className="mt-4 max-w-lg text-[15px] text-steel">
          Pozdravljeni, {s.user.fullName.split(" ")[0]}. Vnesite osnovne podatke podjetja. Opremo, stranke in sodelavce dodate v naslednjih korakih; vse lahko kasneje spremenite.
        </p>
        <ActionForm action={createOrgAction} className="mt-10 space-y-8">
          <fieldset className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-3 text-sm font-semibold">Podjetje</legend>
            <Field name="name" label="Ime izposojevalnice" placeholder="npr. Najem Kovač" required className="sm:col-span-2" />
            <Field name="legalName" label="Uradni naziv" hint="neobvezno" placeholder="Kovač d.o.o." />
            <Field name="taxId" label="Davčna številka" hint="neobvezno" placeholder="SI12345678" />
            <Field name="address" label="Naslov poslovalnice" hint="neobvezno" />
            <Field name="city" label="Kraj" hint="neobvezno" placeholder="Ljubljana" />
            <Field name="phone" label="Telefon" hint="neobvezno" type="tel" />
          </fieldset>
          <fieldset>
            <legend className="mb-1 text-sm font-semibold">Paket</legend>
            <p className="mb-3 text-sm text-steel">14 dni preizkusa brez obveznosti. Spletno plačevanje naročnine še ni vklopljeno; paket lahko zamenjate kadar koli.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {plans.map((p) => (
                <label key={p.code} className="relative cursor-pointer rounded-md border border-line-strong bg-surface p-4 transition-colors has-[:checked]:border-ink has-[:checked]:ring-1 has-[:checked]:ring-ink">
                  <input type="radio" name="plan" value={p.code} defaultChecked={p.code === "pro"} className="sr-only" />
                  <span className="block text-sm font-semibold">{p.name}</span>
                  <span className="mt-2 block text-xl font-semibold tabular">{formatMoney(p.price_month_cents)}<span className="text-sm font-normal text-steel"> / mesec</span></span>
                  <span className="mt-1 block text-xs text-steel">{p.code === "basic" ? `do ${p.limits.units} enot` : p.code === "pro" ? "neomejeno enot, QR potni listi" : "več lokacij, API"}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <Submit size="lg" pendingLabel="Ustvarjanje …">Ustvari izposojevalnico</Submit>
        </ActionForm>
      </div>
    </div>
  );
}
