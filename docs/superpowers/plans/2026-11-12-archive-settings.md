# LesTrace korak 8: arhiv, nastavitve, pravne strani – načrt izvedbe

> Naročnik je za nočno delo vnaprej odobril izvedbo korakov 5–8 brez sprotnih potrditev.

**Goal:** Uporabnik prenese celoten arhiv (ZIP) za inšpekcijo, uredi podatke organizacije, prebere pogoje uporabe in zasebnost ter lahko izbriše svoj račun.

## Odločitve
- Arhiv se sestavi v aplikaciji s sejo uporabnika (RLS velja): `plots.geojson`, `plots.csv`, CSV za vse tabele organizacije (vključno z revizijsko sledjo), datoteke dokumentov in uvozov, `README.txt`. CSV: podpičje, UTF-8 z BOM (Excel).
- Podatke organizacije ureja samo lastnik (politika `organizations_update`); član vidi obrazec samo za branje.
- Izbris računa: funkcija `delete_my_account(p_dry_run)` (security definer). Blokira, če je uporabnik zadnji lastnik organizacije z drugimi člani. Organizacije, kjer je edini član, se izbrišejo z vsemi podatki; datoteke v shrambi pobriše aplikacija pred klicem. Potrditev z vpisom e-naslova.
  - TODO: preveri – hramba 5 let po EUDR proti pravici do izbrisa; uporabnik je opozorjen, naj prej prenese arhiv.
- Pravne strani so osnutek z jasno oznako; upravljavec podatkov še ni določen (TODO: preveri).

## Tasks
1. `toCsv`, `buildArchive` – enotski testi.
2. `collectArchive` + `/app/archive` (prenos ZIP).
3. Nastavitve: urejanje organizacije, prenos arhiva, izbris računa.
4. Migracija `20261112000005_delete_account.sql` + DB testi (lokalno; na Supabase po potrditvi).
5. `/terms`, `/privacy`, povezave v nogi; prevodi v 5 jezikih.
6. E2E: pravne strani, urejanje organizacije, arhiv vsebuje parcelo, napačen e-naslov pri izbrisu.
