# LesTrace korak 3: prijava, organizacija, vabila – načrt izvedbe

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uporabnik se registrira ali prijavi (geslo ali povezava po e-pošti), ustvari organizacijo, vidi nadzorno ploščo z rokom EUDR in povabi sodelavca, ki vabilo sprejme.

**Architecture:** Supabase Auth (PKCE, piškotki prek `@supabase/ssr`) s strežniškimi akcijami Next.js. Brez service ključa: sprejem vabila je funkcija v bazi `public.accept_invitation(token)` (security definer), ki preveri žeton, rok in e-pošto prijavljenega uporabnika. E-pošto pošilja vgrajeni Supabase (omejeno število sporočil na uro); povezavo vabila lastnik vedno vidi in jo lahko kopira tudi sam.

**Tech Stack:** obstoječe (Next.js 16, next-intl, @supabase/ssr, shadcn/ui) + `zod` za preverjanje obrazcev.

**Spec:** `docs/superpowers/specs/2026-11-11-lestrace-design.md` (§5.1 v promptu, §7 strani 1–3 in 10, §8 varnost)

## Razdelitev (dogovor z naročnikom 2026-11-12)

- **Korak 3a (zdaj):** Task 1 (brez žetonov vabil), iz Task 3 samo prijava in registracija z geslom ter odjava (brez e-pošte; v Supabase je *Confirm email* izklopljen), Task 4 v celoti.
- **Korak 3b (na koncu, pred prvimi strankami):** povezava po e-pošti, pozabljeno geslo, Task 2, Task 5, Task 6, ponoven vklop *Confirm email*, lastna domena za e-pošto.

## Global Constraints

- Vsa besedila v `messages/*.json` (5 jezikov, enaki ključi; preverja obstoječi test); brez neposrednega teksta v JSX.
- Brez service ključa v aplikaciji v tem koraku.
- Parameter `next` (kam po prijavi) sprejme samo relativne poti, ki se začnejo z `/` in ne z `//` (zaščita pred odprto preusmeritvijo).
- Žeton vabila: 32 naključnih bajtov, base64url; v bazi samo SHA-256; veljavnost 7 dni; enkratna uporaba.
- Izbrana organizacija se hrani v piškotku `lt_org` (httpOnly, sameSite lax); če ni veljavna, se vzame prva organizacija uporabnika.
- Rok EUDR: `large`/`medium` → 30. 12. 2026; `micro`/`small` → 30. 6. 2027, razen če `was_under_eutr` → 30. 12. 2026 (`TODO: preveri čl. 38`).
- Gesla: najmanj 8 znakov (Supabase privzeto 6; nastavimo 8 v obrazcu).

## Review Focus

1. **Odprta preusmeritev** prek `?next=https://zlobna.stran` ali `//zlobna.stran` → vedno na nadzorno ploščo. → test v Task 1.
2. **Vabilo za drug e-poštni naslov:** uporabnik B odpre povezavo, poslano A → zavrnjeno, brez članstva. → test v Task 2.
3. **Ponovna uporaba ali potekel žeton** → zavrnjeno. → test v Task 2.
4. **Prijavljen uporabnik brez organizacije** odpre `/sl/app` → preusmeritev na ustvarjanje organizacije, ne napaka. → test v Task 4 (e2e z lažno sejo ni mogoč; preverjeno z enotskim testom funkcije za izbiro poti).
5. **Neprijavljen obiskovalec** odpre katero koli stran pod `/app` → prijava z `next` nazaj na isto stran. → e2e v Task 3.

---

### Task 1: Pomožne funkcije (čiste, testirane)

**Files:** Create `src/lib/auth/redirect.ts`, `src/lib/auth/tokens.ts`, `src/lib/eudr/deadline.ts`, `src/lib/auth/schemas.ts`; Test `tests/auth/*.test.ts`

**Interfaces (Produces):**
- `safeNext(next: string | null | undefined, fallback = '/app'): string`
- `createInviteToken(): { token: string; hashHex: string }`, `hashToken(token: string): string` (SHA-256 hex, Node `crypto`)
- `eudrStartDate(size: OrgSize, wasUnderEutr: boolean): '2026-12-30' | '2027-06-30'` (`OrgSize` iz `database.types`)
- zod sheme: `signInSchema`, `signUpSchema`, `magicLinkSchema`, `resetSchema`, `organizationSchema` (ime, država ISO-2 iz seznama SI/HR/BA/RS/AT/IT/HU/ME/DE/… , davčna, matična, EORI neobvezno, `kind`, `size`, `wasUnderEutr`), `inviteSchema` (email, role). Napake vračajo ključe prevodov (`auth.errors.*`, `org.errors.*`).
- `homeFor(state: { signedIn: boolean; orgCount: number }): '/login' | '/onboarding' | '/app'`

- [ ] Testi najprej: `safeNext('https://x.com')`, `safeNext('//x.com')`, `safeNext('/\\x.com')`, `safeNext(null)` → `/app`; `safeNext('/app/settings')` → ista pot. Žeton: dolžina 43, dva klica različna, `hashToken` deterministična. Rok: 4 kombinacije + `small` z EUTR. Sheme: veljavni in neveljavni primeri (prazno ime, napačna država, kratko geslo). `homeFor` za 3 stanja.
- [ ] RED → implementacija → GREEN → commit `feat(auth): redirect, token, deadline and form helpers`

### Task 2: Sprejem vabila v bazi

**Files:** Create `supabase/migrations/20261112000001_accept_invitation.sql`; Modify `supabase/tests/shim.sql` (dodaj `auth.jwt()` iz `request.jwt.claims`), `tests/db/helpers.ts` (`asUser(id, fn, { email })` nastavi `request.jwt.claims`); Test `tests/db/invitations.test.ts`

**Interfaces:** `public.accept_invitation(p_token text) returns uuid` (id organizacije) – `security definer`, `set search_path = ''`, grant samo `authenticated`. Napake: `P0002 invitation_not_found` (napačen, uporabljen ali potekel žeton), `P0003 invitation_email_mismatch`. Ob uspehu: `memberships` (vloga iz vabila; če je uporabnik že član, se vloga ne zniža), `accepted_at = now()`. Primerjava e-pošte neobčutljiva na velike črke.

- [ ] Testi: uspešen sprejem (članstvo + `accepted_at`); drugi sprejem istega žetona → `P0002`; potekel → `P0002`; drug e-poštni naslov → `P0003` in brez članstva (Review Focus 2, 3); neprijavljen (`anon`) nima pravice izvajanja.
- [ ] RED → migracija → GREEN (`npm run test:db`) → uveljavi na `lestrace-dev` → varnostni pregled → commit `feat(db): accept_invitation function`

### Task 3: Prijava, registracija, pozabljeno geslo

**Files:** Create `src/app/[locale]/(auth)/{login,signup,forgot-password,reset-password}/page.tsx`, `src/app/[locale]/(auth)/actions.ts`, `src/app/[locale]/auth/callback/route.ts`, `src/app/[locale]/auth/confirm/route.ts`, `src/components/auth/*.tsx`; Modify `messages/*.json`

- Strežniške akcije: `signIn`, `signUp` (z `emailRedirectTo` na `/{locale}/auth/callback?next=…`), `sendMagicLink`, `sendPasswordReset`, `updatePassword`, `signOut`. Vse preverijo vhod z zod in vrnejo ključe napak; napake Supabase prevedemo v naše ključe (`invalid_credentials`, `email_not_confirmed`, `rate_limited`, `user_exists`, `weak_password`, `unknown`).
- `auth/callback`: `exchangeCodeForSession(code)` → `safeNext(next)`; `auth/confirm`: `verifyOtp({ token_hash, type })` za povezave iz e-pošte.
- Obrazci so prijazni za telefon (polna širina, velika polja, `autoComplete`, `inputMode="email"`).
- [ ] E2E najprej (`tests/e2e/auth.spec.ts`): `/sl/app` neprijavljen → `/sl/login?next=%2Fsl%2Fapp` (Review Focus 5); prazen obrazec prijave pokaže napako v slovenščini; `/en/login` v angleščini; povezave med prijavo, registracijo in pozabljenim geslom delujejo; stran za prijavo na 390 px brez vodoravnega drsenja.
- [ ] RED → implementacija → GREEN → commit `feat(auth): sign-in, sign-up, magic link and password reset`

### Task 4: Ustvarjanje organizacije, nadzorna plošča, zaščita strani

**Files:** Create `src/lib/auth/session.ts` (`getSessionUser()`, `requireUser(locale, path)`, `getCurrentOrganization()`), `src/app/[locale]/onboarding/{page.tsx,actions.ts}`, `src/app/[locale]/app/{layout.tsx,page.tsx}`, `src/components/app/{app-header,org-switcher}.tsx`, `src/app/[locale]/app/actions.ts` (`switchOrganization`); Modify `messages/*.json`

- `app/layout.tsx`: brez uporabnika → `/login?next=…`; brez organizacije → `/onboarding` (`homeFor`). Glava: ime organizacije, preklop med organizacijami, odjava; mobilni meni.
- `onboarding`: obrazec (`organizationSchema`) → `insert into organizations … returning id` → piškotek `lt_org` → `/app`.
- Nadzorna plošča: pozdrav, kartica z rokom EUDR (`eudrStartDate`) in številom dni do roka, prazne kartice »Parcele / Dokumenti / Pošiljke – kmalu«.
- [ ] Enotski testi za `homeFor` (že v Task 1) in za `getCurrentOrganization` izbiro iz piškotka (neveljaven piškotek → prva organizacija; prazno → null) z vbrizganim seznamom.
- [ ] E2E: `/sl/onboarding` neprijavljen → prijava.
- [ ] RED → implementacija → GREEN → commit `feat(app): onboarding, dashboard and route protection`

### Task 5: Člani in vabila

**Files:** Create `src/app/[locale]/app/settings/members/{page.tsx,actions.ts}`, `src/app/[locale]/invite/accept/page.tsx`, `src/components/app/{members-table,invite-form,copy-link}.tsx`; Modify `messages/*.json`

- Seznam članov (e-pošta prijavljenega iz `auth`, za druge le vloga in datum – e-pošte drugih članov v tem koraku ne prikazujemo, ker niso v tabelah s RLS; `TODO` za korak 8: profil s prikaznim imenom).
- Lastnik: povabi (e-pošta + vloga) → `createInviteToken` → `insert into invitations` (hash) → `signInWithOtp({ email, options: { emailRedirectTo: /{locale}/invite/accept?token=… } })` → prikaže povezavo za kopiranje; seznam čakajočih vabil s preklicem; sprememba vloge in odstranitev člana (zadnjega lastnika baza ne dovoli – prikaz prevedene napake).
- `invite/accept`: neprijavljen → prijava z `next` nazaj; prijavljen → `rpc('accept_invitation')` → piškotek `lt_org` → `/app`; napake `P0002`/`P0003` prevedene.
- [ ] E2E: `/sl/invite/accept?token=x` neprijavljen → prijava z `next`, ki vsebuje žeton.
- [ ] RED → implementacija → GREEN → commit `feat(app): members and invitations`

### Task 6: Nastavitev Supabase Auth, namestitev in ročni preizkus

- [ ] **Naročnik** v nadzorni plošči Supabase (`lestrace-dev` → Authentication → URL Configuration) nastavi *Site URL* `https://lestrace.vercel.app` in *Redirect URLs* `https://lestrace.vercel.app/**`, `https://*-zapi1.vercel.app/**`, `http://localhost:3000/**`. (Tega ne morem nastaviti sam – za to ni orodja.)
- [ ] Namestitev predogleda na Vercel; preveri `/sl/login` (200).
- [ ] Ročni preizkus po kontrolnem seznamu v README (registracija → potrditev e-pošte → organizacija → vabilo drugemu naslovu → sprejem → preklop organizacije → odjava → pozabljeno geslo).
- [ ] Commit `docs: auth setup and manual test checklist`

## Omejitve

- Vgrajena e-pošta Supabase pošlje le nekaj sporočil na uro in ima angleške predloge. Prevedene predloge in lastna domena pridejo z lastnim ponudnikom.
- Celotnega toka prijave ne morem preizkusiti samodejno (lokalna Supabase Auth se v tem okolju ne zažene, prave e-pošte pa ne morem prebrati) – zato ročni preizkus v Task 6.
