# LesTrace

Orodje za pripravo podatkov za EUDR (Uredba (EU) 2023/1115) za lesno panogo.

- Specifikacija: [docs/superpowers/specs/2026-11-11-lestrace-design.md](docs/superpowers/specs/2026-11-11-lestrace-design.md)
- Načrti: [docs/superpowers/plans/](docs/superpowers/plans/)
- Predogled (Vercel, ekipa ZAPI, projekt `lestrace`): https://lestrace-75x4g3ofl-zapi1.vercel.app/sl
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
