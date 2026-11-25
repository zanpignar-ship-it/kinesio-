import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm, CheckboxField, Field, Submit } from "@/components/form";
import { signupAction } from "../actions";

export const metadata: Metadata = { title: "Registracija" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Ustvarite račun</h1>
      <p className="mt-1 mb-8 text-sm text-steel">14 dni brezplačnega preizkusa, brez kartice. Že imate račun? <Link className="font-medium text-ink underline underline-offset-4" href="/login">Prijava</Link></p>
      <ActionForm action={signupAction} className="space-y-4">
        <Field name="fullName" label="Ime in priimek" autoComplete="name" required autoFocus />
        <Field name="email" type="email" label="Službena e-pošta" autoComplete="email" required />
        <Field name="password" type="password" label="Geslo" hint="vsaj 10 znakov" autoComplete="new-password" required minLength={10} />
        <CheckboxField name="terms" label="Strinjam se s pogoji uporabe in politiko zasebnosti" description="Pravna besedila so v pripravi in bodo pred zagonom pregledana." />
        <Submit className="w-full" size="lg" pendingLabel="Ustvarjanje računa …">Ustvari račun</Submit>
      </ActionForm>
    </>
  );
}
