# LesTrace korak 2: ogrodje aplikacije – načrt izvedbe

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Next.js aplikacija s prevodi v 5 jezikih, celotna shema baze (PostGIS + RLS + revizijska sled) s testi RLS, nov Supabase projekt v EU in predogledna namestitev na Vercelu. Brez prijave in poslovnih strani (to je korak 3+).

**Architecture:** Next.js 16 App Router v korenu repozitorija ob obstoječem `src/lib/geo`. Shema baze kot SQL migracije v `supabase/migrations/`. Testi RLS tečejo proti lokalnemu PostGIS v Dockerju, v katerem posnemamo shemo `auth` in vloge Supabase (`anon`, `authenticated`, `service_role`); iste migracije nato uveljavimo na pravem Supabase projektu.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, shadcn/ui, next-intl 4, @supabase/ssr + @supabase/supabase-js, ESLint 9 (flat) + `eslint-plugin-i18next`, Vitest + `pg`, Docker `postgis/postgis:16-3.4`, Playwright (dim test).

**Spec:** `docs/superpowers/specs/2026-11-11-lestrace-design.md` (§4 arhitektura, §5 podatkovni model, §8 varnost, §9 testi)

## Global Constraints

- TypeScript strict, brez `any`; `npm run typecheck`, `npm run lint`, `npm test` morajo biti čisti po vsaki nalogi.
- Jeziki: `sl` (privzeti), `hr`, `sr-Latn`, `bs`, `en`. Noben uporabniku viden tekst v JSX ni zapisan neposredno (ESLint `i18next/no-literal-string`, način `jsx-text-only`).
- Prevodi `hr`, `sr-Latn`, `bs` so strojni (AI); vsaka datoteka ima ključ `_meta.machineTranslated: true`.
- Vsaka poslovna tabela ima `organization_id` in RLS; brez izjem. Referenčne tabele (`species`, `hs_codes`, `country_risk`) imajo RLS z dovoljenjem samo za branje.
- `audit_log`: samo `INSERT` prek sprožilca; `UPDATE`/`DELETE` prepovedana vsem razen `postgres`.
- Supabase: regija **eu-central-1** (Frankfurt), ime projekta `lestrace-dev`. Vercel funkcije v regiji **fra1**.
- Service ključ nikoli v kodi za brskalnik (`NEXT_PUBLIC_*` samo URL in publishable/anon ključ).
- Noga vsake strani: »LesTrace je orodje za pripravo podatkov. Odgovornost za izjavo o skrbnem pregledu nosi uporabnik.« (v vseh jezikih).

## Review Focus

1. **Uporabnik, ki je član dveh organizacij** – vidi podatke obeh, a ne more vstaviti vrstice v organizacijo, kjer ni član (preverjanje `WITH CHECK`). → test v Task 3.
2. **Zamenjava `organization_id` z `UPDATE`** – član organizacije A ne sme prestaviti svoje vrstice v organizacijo B. → test v Task 3.
3. **Povezovalne tabele** (`plot_documents`, `shipment_plots` …) nimajo lastnega `organization_id` v predlogu – član A ne sme povezati svoje parcele z dokumentom organizacije B. → `organization_id` dodamo tudi tem tabelam + omejitev, da se ujema z obema stranema; test v Task 3.
4. **Neznan jezik v URL-ju** (`/de/...`) – preusmeritev na `/sl`, ne napaka 500. → test v Task 2.
5. **`anon` vloga** (neprijavljen obiskovalec) ne vidi ničesar, tudi ne `buyer_shares` (javni paket bere strežnik s service ključem). → test v Task 3.

---

## Struktura datotek

```
next.config.ts  eslint.config.mjs  postcss.config.mjs  components.json  vercel.json  .env.example
src/app/[locale]/layout.tsx  src/app/[locale]/page.tsx  src/app/globals.css
src/components/site-footer.tsx  src/components/ui/*            (shadcn)
src/i18n/routing.ts  src/i18n/request.ts  src/proxy.ts           (next-intl usmerjanje)
messages/{sl,hr,sr-Latn,bs,en}.json
src/lib/supabase/{server,browser,proxy}.ts  src/lib/db/database.types.ts (generirano)
supabase/migrations/20261111000001_init.sql        shema, RLS, sprožilci
supabase/migrations/20261111000002_storage.sql     bucket documents + politike
supabase/seed/reference.sql                         species, hs_codes, country_risk
supabase/tests/shim.sql                             lokalni posnetek sheme auth/storage in vlog
scripts/db-test.sh                                  zažene PostGIS v Dockerju, uveljavi shim + migracije
tests/db/helpers.ts  tests/db/rls.test.ts  tests/db/audit.test.ts  tests/db/storage.test.ts
tests/i18n/messages.test.ts  tests/e2e/smoke.spec.ts
```

---

### Task 1: Next.js ogrodje, Tailwind, shadcn/ui, ESLint

**Files:** Create `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `components.json`, `src/app/globals.css`, `src/app/layout.tsx` (začasno), `src/app/page.tsx` (začasno); Modify `package.json`, `tsconfig.json`, `.gitignore`

**Interfaces:** Produces: skripte `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:db`, `test:e2e`; alias `@/*` → `./src/*` (že obstaja).

- [ ] **Step 1:** Namesti `next@16 react@19 react-dom@19`, dev: `@types/react @types/react-dom tailwindcss@4 @tailwindcss/postcss eslint@9 eslint-config-next@16 typescript-eslint eslint-plugin-i18next`. `tsconfig`: dodaj `jsx: preserve`, `plugins: [{name: 'next'}]`, `include` + `next-env.d.ts`, `.next/types/**/*.ts`; ohrani `strict`, `noUncheckedIndexedAccess`.
- [ ] **Step 2:** `eslint.config.mjs`: `next/core-web-vitals` + `next/typescript`, pravilo `@typescript-eslint/no-explicit-any: error`, `i18next/no-literal-string: ['error', { mode: 'jsx-text-only' }]` za `src/app/**` in `src/components/**` (izjema `src/components/ui/**`). Ignore: `.next`, `node_modules`, `src/lib/db/database.types.ts`.
- [ ] **Step 3:** `npx shadcn@latest init` (stil `new-york`, osnovna barva `stone`, CSS spremenljivke); dodaj komponente `button card input label`.
- [ ] **Step 4: Failing check:** v `src/app/page.tsx` napiši `<h1>LesTrace</h1>` → `npm run lint` mora javiti `i18next/no-literal-string` (dokaz, da pravilo deluje). Nato besedilo nadomesti z `{'LesTrace'}` začasno, dokler Task 2 ne doda prevodov.
- [ ] **Step 5:** `npm run lint && npm run typecheck && npm test && npm run build` → vse uspešno.
- [ ] **Step 6: Commit** `chore: scaffold Next.js app with Tailwind, shadcn/ui and strict lint`

### Task 2: Prevodi in usmerjanje po jezikih (next-intl)

**Files:** Create `src/i18n/routing.ts`, `src/i18n/request.ts`, `src/proxy.ts`, `src/app/[locale]/layout.tsx`, `src/app/[locale]/page.tsx`, `src/components/site-footer.tsx`, `messages/{hr,sr-Latn,bs,en}.json`, `tests/i18n/messages.test.ts`, `tests/e2e/smoke.spec.ts`, `playwright.config.ts`; Modify `messages/sl.json`; Delete `src/app/page.tsx`

**Interfaces:**
- Produces: `routing = defineRouting({ locales: ['sl','hr','sr-Latn','bs','en'], defaultLocale: 'sl', localePrefix: 'always' })`; `Link`, `redirect`, `usePathname`, `useRouter` iz `createNavigation(routing)` v `src/i18n/navigation.ts`.
- Sporočila: `common.appName`, `common.disclaimer`, `home.title`, `home.subtitle`, `home.deadlineLarge`, `home.deadlineSmall`, `geo.issues.*` (obstoječe, prevedene v vse jezike), `_meta.machineTranslated`.

- [ ] **Step 1: Failing test** `tests/i18n/messages.test.ts`: vsaka jezikovna datoteka ima natanko iste ključe (rekurzivno, brez `_meta`) kot `sl.json`; noben niz ni prazen; parametri v `{…}` se ujemajo s `sl` za vsak ključ; `hr`, `sr-Latn`, `bs` imajo `_meta.machineTranslated === true`.
- [ ] **Step 2:** `npm test` → FAIL (datoteke manjkajo).
- [ ] **Step 3:** Ustvari prevode (AI) in usmerjanje. Domača stran: naslov, podnaslov, roka EUDR (30. 12. 2026 velika/srednja, 30. 6. 2027 mikro/mala), noga z izjavo o odgovornosti. `<html lang>` = trenutni jezik.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5: Failing e2e** `tests/e2e/smoke.spec.ts` (Playwright proti `npm run build && npm start`): `/` → preusmeritev na `/sl`; `/sl` vsebuje `home.title` iz `sl.json`; `/en` vsebuje `home.title` iz `en.json`; `/de` → konča na `/sl/...` ali `/sl` s statusom < 400 (Review Focus 4); noga vsebuje `common.disclaimer` v jeziku strani; zaslon 390×844 (telefon) brez vodoravnega drsenja (`document.documentElement.scrollWidth <= 390`).
- [ ] **Step 6:** `npm run test:e2e` → PASS.
- [ ] **Step 7: Commit** `feat(i18n): locale routing and translations for sl, hr, sr-Latn, bs, en`

### Task 3: Shema baze, RLS in lokalni testi

**Files:** Create `supabase/config.toml` (`supabase init`), `supabase/migrations/20261111000001_init.sql`, `supabase/seed/reference.sql`, `supabase/tests/shim.sql`, `scripts/db-test.sh`, `tests/db/helpers.ts`, `tests/db/rls.test.ts`, `tests/db/audit.test.ts`, `vitest.db.config.ts`

**Interfaces:**
- `scripts/db-test.sh`: zažene (ali ponovno uporabi) kontejner `lestrace-db-test` (`postgis/postgis:16-3.4`, vrata 54329), počaka na pripravljenost, ustvari svežo bazo `lestrace_test`, uveljavi `shim.sql` → vse migracije po vrsti → `seed/reference.sql`, nato zažene `vitest run -c vitest.db.config.ts`. `npm run test:db` kliče to skripto.
- `shim.sql`: vloge `anon`, `authenticated`, `service_role` (`service_role` z `BYPASSRLS`), shema `auth` s tabelo `auth.users(id uuid pk, email text)` in funkcijo `auth.uid()` = `nullif(current_setting('request.jwt.claim.sub', true), '')::uuid`, shema `storage` s tabelama `storage.buckets(id text pk, name text, public bool)` in `storage.objects(id uuid pk default gen_random_uuid(), bucket_id text, name text, owner uuid)` z vključenim RLS ter funkcijo `storage.foldername(name text) returns text[]`. Na pravem Supabase ta datoteka **ni** uveljavljena.
- `tests/db/helpers.ts`: `asUser(userId: string | null, fn: (c: PoolClient) => Promise<T>): Promise<T>` – v transakciji `set local role authenticated` (ali `anon` pri `null`), `set local request.jwt.claim.sub = userId`, na koncu `rollback`; `asService(fn)` z vlogo `service_role`; `seedTwoOrgs(): Promise<{ orgA, orgB, alice, bob, carol }>` (alice ∈ A, bob ∈ B, carol ∈ A in B).
- Shema (vse po spec §5, z izboljšavami):
  - `create extension postgis with schema extensions` (`if not exists`), `pgcrypto`.
  - Enum tipi: `org_kind`, `org_size`, `member_role ('owner','member')`, `supplier_kind`, `document_type`, `shipment_mode ('submit_dds','forward_references')`, `shipment_activity ('domestic','import','export')`, `shipment_status ('draft','ready','submitted','rejected')`, `plot_status ('valid','warning','error')`, `upstream_ref_kind ('dds','simplified_declaration')`, `risk_level ('low','standard','high')`.
  - Tabele iz spec §5; `plots.geom extensions.geometry(Geometry, 4326)` s `check (geom is null or geometrytype(geom) in ('POINT','MULTIPOINT','POLYGON','MULTIPOLYGON'))`; `plots.validation_issues jsonb not null default '[]'`.
  - Povezovalne tabele (`plot_documents`, `shipment_plots`, `shipment_documents`, `shipment_items`, `upstream_references`) dobijo `organization_id` + sestavljene tuje ključe `(organization_id, plot_id) → plots(organization_id, id)` itd., tako da povezava med organizacijama ni mogoča (Review Focus 3). Na glavnih tabelah zato `unique (organization_id, id)`.
  - `buyer_shares.token_hash bytea not null unique`, `shipment_ids uuid[] not null`.
  - `updated_at` sprožilec `public.set_updated_at()` na vseh tabelah z `updated_at`.
  - `public.is_member(org uuid) returns boolean` (`security definer`, `stable`, `set search_path = ''`), `public.is_owner(org uuid)`.
  - RLS politike na vsaki poslovni tabeli: `select/insert/update/delete to authenticated using (public.is_member(organization_id)) with check (public.is_member(organization_id))`. `organizations`: select za člane; insert za vsakega prijavljenega (sprožilec po vstavitvi doda ustvarjalca kot `owner` v `memberships`); update samo `is_owner`. `memberships`: select za člane iste organizacije; insert/update/delete samo `is_owner` (+ sprožilec, ki prepreči odstranitev zadnjega lastnika). `invitations`: samo `is_owner`. Referenčne tabele: `select to anon, authenticated using (true)`, brez pisanja.
  - `audit_log` + sprožilec `public.audit_row()` (`security definer`) na vseh poslovnih tabelah: zapiše `organization_id, actor_id = auth.uid(), table_name, row_id, action, old_data, new_data`. Politike: `select` za člane; brez insert/update/delete politik; `revoke update, delete on audit_log from authenticated, anon, service_role`.
  - Indeksi: GIST `plots(geom)`, `plots(organization_id, validation_status)`, `plots(organization_id, label)`, `shipments(organization_id, status)`, `documents(organization_id, valid_to)`, `audit_log(organization_id, at desc)`.
- `seed/reference.sql`: `country_risk` (SI, HR, BA, RS, AT, IT, HU, ME = `low`, vir `Izvedbena uredba (EU) 2025/1093`, komentar `TODO: preveri posodobitev 2026`); `hs_codes` (4401–4421 na ravni 4 mest, 4701–4707 ex 47, ex 48, ex 9401, 9403 30/40/50/60/91, 9406 10 – vse z `notes = 'TODO: preveri Delegirano uredbo (EU) 2026/2102'`); `species` (vsaj 15 najpogostejših vrst v regiji: *Picea abies, Abies alba, Fagus sylvatica, Pinus sylvestris, Pinus nigra, Larix decidua, Quercus robur, Quercus petraea, Quercus cerris, Acer pseudoplatanus, Fraxinus excelsior, Castanea sativa, Carpinus betulus, Betula pendula, Populus spp.* z imeni v 5 jezikih).

- [ ] **Step 1: Failing tests** `tests/db/rls.test.ts` – za vsako poslovno tabelo (seznam v testu kot konstanta, vsaka vrstica ustvarjena z `asService`):
  - alice vidi vrstico org A, ne vidi vrstice org B (`select` vrne 0 vrstic);
  - alice ne more vstaviti vrstice z `organization_id = B` (napaka `42501` / kršitev RLS);
  - alice ne more posodobiti vrstice org B (0 posodobljenih) in ne more spremeniti `organization_id` svoje vrstice na B (Review Focus 2);
  - alice ne more izbrisati vrstice org B;
  - carol vidi obe; bob ne more vstaviti v A (Review Focus 1);
  - `anon` ne vidi nobene vrstice nobene poslovne tabele, tudi ne `buyer_shares` (Review Focus 5);
  - povezava `plot_documents(plot iz A, dokument iz B)` z `asService` pade na tujem ključu (Review Focus 3);
  - `plots.geom` zavrne `LINESTRING`;
  - ustvarjanje organizacije kot alice samodejno doda `memberships(alice, owner)`; `member` ne more spreminjati `memberships`; zadnjega lastnika ni mogoče odstraniti.
  `tests/db/audit.test.ts`: `insert`/`update`/`delete` na `plots` ustvari 3 vrstice v `audit_log` z `actor_id = alice`, pravilnimi `old_data`/`new_data`; alice ne more `update` ali `delete` na `audit_log` (napaka); bob ne vidi revizije org A.
- [ ] **Step 2:** `npm run test:db` → FAIL (tabele ne obstajajo).
- [ ] **Step 3:** Napiši `shim.sql`, migracijo in seed.
- [ ] **Step 4:** `npm run test:db` → PASS; `npm test` (geo) še vedno PASS.
- [ ] **Step 5: Commit** `feat(db): schema with PostGIS, RLS, audit log and reference data`

### Task 4: Zasebni bucket za dokumente

**Files:** Create `supabase/migrations/20261111000002_storage.sql`, `tests/db/storage.test.ts`

**Interfaces:** Bucket `documents` (`public = false`, omejitev velikosti 20 MB, dovoljeni MIME `application/pdf, image/jpeg, image/png, image/heic, image/webp`); pot `"<organization_id>/<document_id>/<ime datoteke>"`. Politike na `storage.objects` za `authenticated`: `bucket_id = 'documents' and public.is_member(((storage.foldername(name))[1])::uuid)` za select/insert/update/delete. Neveljaven UUID v prvem delu poti → zavrnjeno (funkcija `public.safe_uuid(text)` vrne `null`).

- [ ] **Step 1: Failing tests:** alice lahko vstavi objekt `A/…`, ne more `B/…`; bob ne vidi `A/…`; pot `ni-uuid/x.pdf` zavrnjena; `anon` ne vidi ničesar.
- [ ] **Step 2:** FAIL. **Step 3:** Implementiraj. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(db): private documents bucket with per-organization policies`

### Task 5: Supabase projekt (EU) in povezava aplikacije

**Files:** Create `.env.example`, `src/lib/supabase/server.ts`, `src/lib/supabase/browser.ts`, `src/lib/supabase/proxy.ts`, `src/lib/db/database.types.ts`; Modify `src/proxy.ts`

**Interfaces:**
- `createServerSupabase(): Promise<SupabaseClient<Database>>` (piškotki prek `next/headers`), `createBrowserSupabase(): SupabaseClient<Database>`, `updateSession(request: NextRequest, response: NextResponse): Promise<NextResponse>` – v `src/proxy.ts` se zažene za next-intl.
- Spremenljivke: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (samo strežnik, v korakih 3+).

- [ ] **Step 1:** Ustvari projekt `lestrace-dev` v organizaciji uporabnika, regija `eu-central-1` (brezplačni paket, $0). Počakaj na `ACTIVE_HEALTHY`.
- [ ] **Step 2:** Uveljavi migraciji 1 in 2 ter seed prek Supabase MCP (`apply_migration`, `execute_sql`); **ne** uveljavi `shim.sql`. Zaženi `get_advisors` (security + performance); vsako opozorilo »security« popravi z novo migracijo (najprej lokalni test, ki ga pokaže) ali zapiši odločitev v ledger.
- [ ] **Step 3:** Ponovi ključne preverbe RLS na pravem projektu z `execute_sql` (`set local role anon; select count(*) from plots` → 0; `select count(*) from species` > 0).
- [ ] **Step 4:** `generate_typescript_types` → `src/lib/db/database.types.ts`; `npm run typecheck` PASS.
- [ ] **Step 5:** Napiši Supabase pomožne datoteke, `.env.example`, lokalni `.env.local` (git-ignoriran) z URL in publishable ključem.
- [ ] **Step 6:** `npm run build && npm run test:e2e` → PASS (stran se še vedno naloži s proxyjem Supabase).
- [ ] **Step 7: Commit** `feat(supabase): EU project, generated types and SSR clients`

### Task 6: Vercel predogled

**Files:** Create `vercel.json` (`{ "regions": ["fra1"] }`)

- [ ] **Step 1:** Ustvari ali poveži Vercel projekt `lestrace` (Vercel MCP / API), nastavi okoljski spremenljivki `NEXT_PUBLIC_SUPABASE_URL` in `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` za Preview in Production.
- [ ] **Step 2:** Namesti predogled iz veje `claude/lestrace-eudr-tool-1appsv`; preveri stanje `READY` in brez napak v dnevniku gradnje.
- [ ] **Step 3:** Preveri predogledni URL: `/sl` vrne 200 in vsebuje `home.title`; `/en` vsebuje angleški naslov.
- [ ] **Step 4: Commit** `chore: Vercel config (fra1)` in v README dopiši povezavo do predogleda ter navodila (`npm run dev`, `npm test`, `npm run test:db`).

---

## Kako preizkusiš (za naročnika)

Po koraku 2 dobiš povezavo do predogleda na Vercelu: domača stran LesTrace v izbranem jeziku (menjava jezika v URL-ju: `/sl`, `/hr`, `/sr-Latn`, `/bs`, `/en`) z nogo o odgovornosti. Na telefonu se mora lepo prikazati. V Supabase nadzorni plošči (projekt `lestrace-dev`) vidiš vse tabele z vključenim RLS. Prijava pride v koraku 3.
