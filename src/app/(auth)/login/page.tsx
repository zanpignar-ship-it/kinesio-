import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm, Field, Submit } from "@/components/form";
import { loginAction } from "../actions";

export const metadata: Metadata = { title: "Prijava", robots: { index: false } };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Prijava</h1>
      <p className="mt-1 mb-8 text-sm text-steel">Nimate računa? <Link className="font-medium text-ink underline underline-offset-4" href="/signup">Registrirajte izposojevalnico</Link></p>
      <ActionForm action={loginAction} className="space-y-4">
        <input type="hidden" name="next" value={next ?? "/app"} />
        <Field name="email" type="email" label="E-pošta" autoComplete="email" required autoFocus />
        <Field name="password" type="password" label="Geslo" autoComplete="current-password" required />
        <Submit className="w-full" size="lg" pendingLabel="Prijavljanje …">Prijava</Submit>
      </ActionForm>
    </>
  );
}
