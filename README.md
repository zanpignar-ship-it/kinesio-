# IZVOR (prej delovno ime LesTrace)

Orodje za pripravo podatkov za EUDR (Uredba (EU) 2023/1115) za lesno panogo.

- Specifikacija: [docs/superpowers/specs/2026-11-11-lestrace-design.md](docs/superpowers/specs/2026-11-11-lestrace-design.md)
- Načrti: [docs/superpowers/plans/](docs/superpowers/plans/)
- Predogled (Vercel, ekipa ZAPI, projekt `lestrace`): https://lestrace-2akjjfgh3-zapi1.vercel.app/sl
- Baza: Supabase projekt `lestrace-dev` (eu-central-1)

Pred zagonom v produkcijo: glej [docs/launch-checklist.md](docs/launch-checklist.md).

## Razvoj

```bash
npm install
cp .env.example .env.local    # vpiši URL in publishable ključ Supabase
npm run dev                   # http://localhost:3000/sl
```

## Preverjanja

```bash
npm run lint && npm run typecheck
npm test                      # geo jedro, prevodi
npm run test:db               # sheme, RLS, revizija, shramba (PostGIS v Dockerju)
npm run test:e2e              # Playwright, zgradi in zažene aplikacijo
npx tsx scripts/try-file.ts <datoteka> --country SI   # preizkus uvoza parcel
```

## Baza

Migracije so v `supabase/migrations/`, šifranti v `supabase/seed/reference.sql`.
`supabase/tests/shim.sql` posnema Supabase (auth, storage, vloge) samo za lokalne teste – nikoli ga ne uveljavi na pravem projektu.
Po vsaki migraciji ponovno ustvari `src/lib/db/database.types.ts`.

## Čaka na potrditev (Supabase)
Uveljavljene so migracije do `20261112000007` in `20261112000009_risk.sql`. Te so pripravljene in preizkušene lokalno (`npm run test:db`), na `lestrace-dev` pa še niso (zahtevajo potrditev – zaženite jih v Supabase SQL Editorju):
- ~~`20261112000004_buyer_package.sql`~~ – uveljavljeno 12. 11. 2026.
- `supabase/migrations/20261112000005_delete_account.sql` – izbris računa v nastavitvah. TODO: preveri, ali lahko vloga `postgres` na Supabase briše iz `auth.users`.
- `supabase/migrations/20261112000008_integrity.sql` – popravki iz pregleda kode (shranjevanje pošiljke v eni transakciji, zaklep oddane pošiljke v bazi, preklic povezave za kupca je dokončen, potrjen e-naslov za vabila). Po uveljavitvi ju aplikacija uporabi samodejno.
- Čiščenje testnih uporabnikov e2e: `scripts/cleanup-e2e.sql`.
- ~~Skrivni ključ `SUPABASE_SERVICE_ROLE_KEY`~~ – ni več potreben (portal za dobavitelje in prenos dokumentov za kupca delujeta prek funkcij v bazi).

## TRACES (neposredna oddaja izjave)
Kaj mora narediti uporabnik (enkrat):
1. Račun EU Login in registracija podjetja kot »Operator« v EUDR Information System (TRACES), z EORI številko pri uvozu/izvozu.
2. V testnem okolju (https://acceptance.eudr.webcloud.ec.europa.eu) v profilu: Edit profile → Web Services Access → Active; prepiše uporabniško ime in Authentication Key.
3. V IZVORU: Nastavitve → Oddaja v TRACES → okolje »Testno«, uporabniško ime, ključ → Shrani → Preizkusi povezavo.
4. Ko testna oddaja deluje, isto ponovi za produkcijo (https://eudr.webcloud.ec.europa.eu).

Šifrirni ključ `LESTRACE_ENCRYPTION_KEY` je nastavljen v Vercelu (vsa okolja) in v `.env.local`. Živi test: `LIVE_TRACES=1 NODE_USE_ENV_PROXY=1 npx vitest run tests/traces/live.test.ts` (z `TRACES_USERNAME`, `TRACES_AUTH_KEY` preveri prave podatke).
