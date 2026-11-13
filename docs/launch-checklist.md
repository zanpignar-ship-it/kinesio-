# IZVOR – kontrolni seznam pred zagonom v produkcijo

Stanje: 13. 11. 2026. Vse funkcije MVP so narejene in pokrite s testi (enotski, baza, brskalnik). Spodaj je, kar je še treba narediti, preden aplikacijo uporabljajo stranke.

## 1. Baza (Supabase)
- [ ] V SQL Editorju zaženi še neuveljavljeni migraciji (iz mape `supabase/migrations/`):
  - `20261112000008_integrity.sql` – shranjevanje pošiljke v eni transakciji, zaklep oddane pošiljke, preklic povezav, potrjen e-naslov za vabila.
  - `20261112000005_delete_account.sql` – izbris računa.
  Po uveljavitvi aplikacija sama začne uporabljati `save_shipment_children` in `set_document_plots` (shranjevanje v eni transakciji).
- [ ] Produkcijski projekt: plačljivi paket (Pro) v regiji EU (Frankfurt), dnevne varnostne kopije in PITR.
- [ ] Vse migracije po vrsti na produkcijski projekt + `supabase/seed/reference.sql`.
- [ ] Redno čiščenje: stara dovoljenja za prenos (`private.buyer_file_grants`), datoteke portala brez zapisa – pg_cron (TODO).

## 2. Prijava in e-pošta
- [ ] Lastna domena (npr. izvor.si) v Vercelu.
- [ ] Pošiljatelj e-pošte (SMTP), npr. Brevo, Postmark ali Resend, z domeno (SPF, DKIM). Vgrajena e-pošta Supabase pošilja samo članom ekipe projekta.
- [ ] Supabase → Authentication → URL Configuration: Site URL = produkcijska domena; Redirect URLs: `https://<domena>/*/auth/callback`.
- [ ] Vklopi **Confirm email** in **Leaked password protection**.
- [ ] Predloge e-pošte (ponastavitev gesla, potrditev) v slovenščini/hrvaščini/srbščini/bosanščini/angleščini.

## 3. Vercel
- [ ] Spremenljivke v okolju Production: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (produkcijski projekt), `LESTRACE_ENCRYPTION_KEY` (nov ključ za produkcijo: `openssl rand -base64 32`; nikoli ga ne menjaj brez ponovnega vnosa ključev TRACES).
- [ ] Produkcijska objava (`vercel deploy --prod`) in povezava domene.
- [ ] Spremljanje napak (npr. Vercel Observability ali Sentry).

## 4. TRACES (EUDR Information System)
- [ ] EU Login + registracija podjetja (Operator, EORI) v testnem okolju; Web Services Access → ključ.
- [ ] V IZVORU: Nastavitve → Oddaja v TRACES → Testno → Preizkusi povezavo → oddaj testno pošiljko.
- [ ] Preveri: sprejem geolokacije (FeatureCollection na proizvajalca), kodi enot MTQ/NAR, dodelitev referenčne številke.
- [ ] Ponovi v produkciji.

## 5. Pravno
- [ ] Pravnik pregleda Pogoje uporabe in Zasebnost (osnutka v aplikaciji), določi upravljavca podatkov.
- [ ] Pogodba o obdelavi podatkov (DPA) za stranke; seznam obdelovalcev (Supabase, Vercel, ponudnik e-pošte).
- [ ] Odprte točke `TODO: preveri` (seznam držav s tveganjem 2026, KN kode po Delegirani uredbi 2026/2102, hramba 5 let ob izbrisu računa, obveznost polja obdobja proizvodnje v DDS).

## 6. Pred prvimi strankami
- [ ] Počisti testne uporabnike (`scripts/cleanup-e2e.sql`) na razvojnem projektu.
- [ ] Pilot z 2–3 podjetji (žaga, uvoznik); zbiraj povratne informacije.
- [ ] Cenik in plačila (če bodo potrebna).
