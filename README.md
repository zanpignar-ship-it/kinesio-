# LesTrace

Orodje za pripravo podatkov za EUDR (Uredba (EU) 2023/1115) za lesno panogo.

- Specifikacija: [docs/superpowers/specs/2026-11-11-lestrace-design.md](docs/superpowers/specs/2026-11-11-lestrace-design.md)
- Načrti: [docs/superpowers/plans/](docs/superpowers/plans/)
- Predogled (Vercel, ekipa ZAPI, projekt `lestrace`): https://lestrace-3ev99k1aa-zapi1.vercel.app/sl
- Baza: Supabase projekt `lestrace-dev` (eu-central-1)

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
- `supabase/migrations/20261112000008_integrity.sql` – popravki iz pregleda kode (shranjevanje pošiljke v eni transakciji, zaklep oddane pošiljke v bazi, preklic povezave za kupca je dokončen, potrjen e-naslov za vabila). Po uveljavitvi preklopiti akcije pošiljk in dokumentov na `save_shipment_children` / `set_document_plots`.
- Čiščenje testnih uporabnikov e2e: `scripts/cleanup-e2e.sql`.
- Skrivni ključ `SUPABASE_SERVICE_ROLE_KEY` v Vercelu (portal za dobavitelje, prenos dokumentov s strani za kupca).
