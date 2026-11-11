# LesTrace – specifikacija MVP (faza 1)

- **Datum:** 2026-11-11
- **Status:** osnutek, čaka na potrditev
- **Vir zahtev:** projektni prompt "EUDR orodje za lesno panogo (LesTrace)" + odgovori naročnika z dne 2026-11-11

> Oznaka `TODO: preveri` pomeni, da podatka nismo mogli potrditi v uradnem viru EU
> (omrežje razvojnega okolja trenutno blokira eur-lex.europa.eu, environment.ec.europa.eu,
> green-forum.ec.europa.eu, eudr.webcloud.ec.europa.eu, webgate.ec.europa.eu, circabc.europa.eu).
> Vsi taki podatki so v kodi zbrani na enem mestu (`src/lib/eudr/rules.ts`), da jih lahko popravimo brez iskanja po kodi.

---

## 1. Namen in merilo uspeha

Podjetje **enkrat** vnese parcele in dokumente, jih poveže s pošiljkami in za vsako pošiljko dobi:
pravilen GeoJSON za EUDR Information System, povzetek podatkov za izjavo o skrbnem pregledu (DDS) in paket za kupca.

**Merilo uspeha:** slovenska žaga ali uvoznik v < 30 min: ustvari račun → uvozi/nariše 10 parcel → naloži dovoljenja
→ ustvari pošiljko → prenese GeoJSON, ki ga TRACES sprejme → kupcu pošlje povezavo.

**Prvi uporabniki (potrjeno):** žaga (tip B) in EU uvoznik/trgovec, ki uvaža iz BiH/Srbije (tip B kot uvoznik). Izvoznik izven EU (tip A) je podprt s paketom za kupca.

## 2. Ugotovitve iz zakonodaje in kako vplivajo na produkt

Vir: spletno iskanje, povzetki uradnih in sekundarnih virov (pravne pisarne, ponudniki). **Vse je treba še potrditi na EUR-Lex.**

| # | Ugotovitev | Vpliv na produkt |
|---|---|---|
| Z1 | Uredba 2025/2650: DDS odda **samo operater, ki proizvod prvi da na trg EU** (ali ga izvozi). Nadaljnji (downstream) operaterji in trgovci DDS ne oddajajo; *prvi* nadaljnji operater zbere in hrani referenčne številke DDS / identifikatorje poenostavljenih izjav in jih posreduje naprej. Vsi hranijo podatke o dobaviteljih in kupcih 5 let. | Pošiljka ima **način**: (a) *oddajam DDS* (uvoznik, operater, ki prvi da na trg, izvoznik) ali (b) *posredujem reference dobaviteljev* (žaga, ki kupuje od slovenskih lastnikov gozdov, ki so že operaterji). Za (b) dodamo tabelo `upstream_references`. |
| Z2 | Rok: 30. 12. 2026 (veliki, srednji), 30. 6. 2027 (mikro, mali). Sekundarni vir: mikro/mali operaterji z lesom, ki so bili že pod EUTR in ustanovljeni do 31. 12. 2024, morda začnejo že 30. 12. 2026. `TODO: preveri čl. 38` | Na nadzorni plošči prikažemo rok glede na velikost podjetja + opozorilo. |
| Z3 | **Poenostavljena izjava** (čl. 4a): mikro/mali *primarni* operaterji (lastnik gozda) v državi z nizkim tveganjem oddajo **enkratno** izjavo; namesto geolokacije je dovoljen poštni naslov. Sistem vrne *identifikator izjave*. Prvi nadaljnji kupec jo lahko odda v njihovem imenu. `TODO: preveri vsebino Priloge III in ali je treba izjavo posodabljati` | MVP: dobavitelj ima polje "identifikator poenostavljene izjave"; parcela lahko namesto geometrije ima samo naslov (status ⚠️, ni primerna za DDS, je pa primerna za poenostavljeno izjavo). Oddaja v imenu dobavitelja je faza 2. |
| Z4 | Razvrstitev tveganja (Izv. uredba 2025/1093): **SI, HR, BiH, RS = nizko tveganje**. Nizko tveganje = poenostavljen skrbni pregled (zbiranje podatkov in geolokacije še vedno obvezno, ocena in zmanjšanje tveganja odpadeta). Napovedana posodobitev v 2026, sprejete nismo našli. `TODO: preveri` | Tabela `country_risk` (urejamo jo brez nove verzije aplikacije). Prikaz tveganja pri parceli/pošiljki. |
| Z5 | Priloga I (les): 4401–4421, ex 47, ex 48, ex 9401, 9403 30/40/50/60/91, 9406 10. **Ex 49 (tiskovine) izbrisano** z 2025/2650. Delegirana uredba **2026/2102** (v veljavi od 18. 9. 2026) dodaja izjeme (rabljeni izdelki, bambus, ratan, vzorci) in spreminja ex 9401/9403; novi izdelki veljajo od 30. 12. 2027. `TODO: preveri točen seznam 8-mestnih kod KN` | Seznam HS kod v tabeli `hs_codes` (koda, opis v vseh jezikih, `in_scope`, `applies_from`, opomba). Kontrolni seznam preveri, ali je koda v obsegu. |
| Z6 | Hramba: **5 let** od oddaje DDS. | Revizijska sled in dokumenti se ne smejo izbrisati prej kot 5 let po oddaji; izbris računa to upošteva (glej §8). |
| Z7 | Polja DDS (TRACES): interna referenca, vrsta aktivnosti, HS koda, opis, trgovsko ime, **znanstveno ime vrste (obvezno za les)**, običajno ime, neto masa kg (obvezna pri uvozu/izvozu), prostornina m³ ali dopolnilne enote, država proizvodnje, geolokacija, reference prejšnjih DDS. API je **V3** (SOAP, WS-Security UsernameToken). `TODO: preveri celoten seznam polj V3` | Povzetek DDS v aplikaciji vsebuje ta polja v vrstnem redu, kot jih vpisujemo v TRACES. |

### GeoJSON format (EUDR GeoJSON File Description v1.5, 5. 5. 2025; spletna različica 29. 5. 2026)

Potrjeno iz izvlečkov uradnih strani:
- WGS-84 (EPSG:4326), koordinate `[lon, lat]`.
- Dovoljeni tipi: `Point`, `MultiPoint`, `Polygon` (≥ 4 pari, zaprt), `MultiPolygon`. `LineString` / `MultiLineString` se zavrne.
- `properties` (vse neobvezne): `ProducerName`, `ProducerCountry` (ISO 3166-1 alfa-2), `ProductionPlace` (ime parcele, priporočeno), `Area` (ha, za točke; če manjka, sistem privzame 4 ha). Ostale lastnosti se ignorirajo.
- Skupna velikost geolokacije na DDS: **največ 25 MB**.

Nepotrjeno (`TODO: preveri`): obvezen koren `FeatureCollection` (v izvozu ga vedno uporabimo, ker ga primeri uporabljajo); orientacija obročev in luknje; največje število točk.

**Odločitve za izvoz:**
- Vedno `FeatureCollection`, en `Feature` na parcelo.
- `properties`: `ProductionPlace` (oznaka parcele), `ProducerName` (dobavitelj ali organizacija), `ProducerCountry`, `Area` samo pri točkah (izračunana/vnesena površina, 4 decimalke).
- Koordinate zaokrožene na **6 decimalk** (≈ 11 cm). Zahteva "vsaj 6 decimalk" izhaja iz čl. 2(28) EUDR (`TODO: preveri`).
- Zunanji obroč v nasprotni smeri urinega kazalca (RFC 7946); luknje dovolimo samo, če jih uvozimo, in jih ohranimo.
- Pred prenosom preverimo velikost (< 25 MB); če je presežena, opozorimo in predlagamo poenostavitev geometrije.

## 3. Obseg MVP

V obsegu: 5.1–5.6 iz prompta + dodatki iz §2 (način pošiljke, reference dobaviteljev, poenostavljena izjava kot podatek).

Izven obsega: plačila, samodejna oddaja v TRACES (faza 2), oddaja poenostavljene izjave v imenu dobavitelja (faza 2), satelitsko preverjanje krčenja gozdov (faza 2), portal za uvoznike (faza 3), ocena tveganja in pravni nasveti. V nogi vsake strani in v pogojih: *"LesTrace je orodje za pripravo podatkov. Odgovornost za izjavo o skrbnem pregledu nosi uporabnik."*

## 4. Arhitektura

- **Next.js (App Router, TypeScript strict)** na Vercelu; strežniške akcije (Server Actions) za pisanje, strežniške komponente za branje.
- **Supabase** (nov projekt, regija EU – Frankfurt): Postgres + PostGIS, Auth (magic link + geslo), Storage (zaseben bucket `documents`), RLS na vseh tabelah.
- **Zemljevid:** MapLibre GL + Terra Draw (risanje točke/poligona, deluje na dotik). Podlagi: OSM in **Esri World Imagery** (s pripisom avtorstva). Menjava ponudnika satelitske podlage je ena nastavitev.
- **Geo knjižnice:** `@turf/turf` (površina, samopresečišča, orientacija), `proj4` (D96/TM EPSG:3794, D48/GK EPSG:3912, HTRS96/TM EPSG:3765, MGI Balkans 6/7 EPSG:31276/31277, UTM 33N/34N), `@tmcw/togeojson` + `jszip` (KML/KMZ), `shpjs` (Shapefile zip, bere `.prj`), `papaparse` (CSV).
- **PDF:** `@react-pdf/renderer` na strežniku; karta parcel kot statična slika (SVG iz geometrije na nevtralni podlagi, brez odvisnosti od zunanjih ploščic).
- **i18n:** `next-intl`; jeziki v MVP: `sl`, `hr`, `sr-Latn`, `bs`, `en`. Izvor prevodov je `sl` + `en`; ostale prevede in pregleda umetna inteligenca (označeno v datoteki). Nobenega hardcodiranega teksta (preverja ESLint pravilo).
- **Testi:** Vitest (geo jedro, izvoz, validacija), testi RLS proti lokalni Supabase (`supabase start`) s pgTAP ali Vitest + dva testna uporabnika, Playwright za glavni tok (dim test).

### Struktura projekta

```
src/
  app/[locale]/(auth)/...            prijava, registracija
  app/[locale]/(app)/...             aplikacija (zahteva prijavo)
  app/[locale]/share/[token]/        javni paket za kupca
  lib/geo/                           čista geo logika, brez odvisnosti od baze (100 % testirano)
    parse/{geojson,kml,shapefile,csv}.ts
    reproject.ts  validate.ts  area.ts  export-eudr.ts
  lib/eudr/rules.ts                  vse pravne konstante + TODO oznake
  lib/db/                            dostop do Supabase, tipi (generirani)
  components/{map,ui}/
messages/{sl,hr,sr-Latn,bs,en}.json
supabase/migrations/  supabase/tests/
```

`lib/geo` je samostojna enota: vhod so datoteke/GeoJSON, izhod so normalizirane geometrije + seznam napak (koda + parametri; besedilo prevede vmesnik). Tako jo testiramo brez baze in brskalnika.

## 5. Podatkovni model

Vse tabele imajo `id uuid`, `created_at`, `updated_at`, `created_by`; poslovne tabele imajo `organization_id` in RLS "samo člani organizacije".

| Tabela | Ključna polja |
|---|---|
| `organizations` | name, country (ISO2), tax_id, registration_no, eori?, kind (`operator`/`exporter`/`importer`/`trader`), size (`micro`/`small`/`medium`/`large`), was_under_eutr bool, address |
| `memberships` | user_id, organization_id, role (`owner`/`member`) |
| `invitations` | organization_id, email, role, token_hash, expires_at, accepted_at |
| `suppliers` | organization_id, name, country, kind (`forest_owner`/`company`), tax_id?, address, email, simplified_declaration_id?, linked_organization_id? (za fazo 3) |
| `organization_links` | supplier_org_id, buyer_org_id, status (za fazo 3; tabela obstaja že zdaj) |
| `plots` | organization_id, supplier_id?, label, cadastral_no?, cadastral_municipality?, country, `geom geometry(Geometry,4326)` nullable, postal_address? (samo za poenostavljeno izjavo), area_ha, area_source (`computed`/`declared`), validation_status (`valid`/`warning`/`error`), validation_issues jsonb, source_file_id?, archived_at |
| `plot_imports` | organization_id, file_path (izvirna datoteka v Storage), detected_crs, feature_count, created_by |
| `documents` | organization_id, type (`felling_permit`/`decision`/`delivery_note`/`certificate_fsc`/`certificate_pefc`/`other`), title, file_path, mime, size, valid_from?, valid_to? |
| `plot_documents` | plot_id, document_id |
| `species` | scientific_name, common_name_{sl,hr,sr,bs,en} (referenčna tabela, brez organization_id, samo branje) |
| `hs_codes` | code, description_{…}, in_scope, applies_from, notes (referenčna, samo branje) |
| `country_risk` | country, risk (`low`/`standard`/`high`), source_act, valid_from (referenčna) |
| `products` | organization_id, name, hs_code, species_id, trade_name? |
| `customers` | organization_id, name, country, address, email, eori? |
| `shipments` | organization_id, internal_ref, customer_id, mode (`submit_dds`/`forward_references`), activity (`domestic`/`import`/`export`), shipment_date, country_of_production, status (`draft`/`ready`/`submitted`/`rejected`), dds_reference_no?, dds_verification_no?, submitted_at?, copied_from_id? |
| `shipment_items` | shipment_id, product_id, net_mass_kg?, volume_m3?, supplementary_units?, pieces? |
| `shipment_plots` | shipment_id, plot_id, **geom_snapshot** (geometrija ob oddaji; kasnejša sprememba parcele ne spremeni oddane pošiljke) |
| `shipment_documents` | shipment_id, document_id |
| `upstream_references` | shipment_id, supplier_id?, kind (`dds`/`simplified_declaration`), reference_no, verification_no? |
| `buyer_shares` | organization_id, token_hash (shranimo samo hash), expires_at, revoked_at, shipment_ids[], include_documents bool, last_viewed_at |
| `audit_log` | organization_id, actor_id, table_name, row_id, action, old_data jsonb, new_data jsonb, at. Polni se s **sprožilci (triggers)**, samo dodajanje (`UPDATE`/`DELETE` prepovedana), hramba ≥ 5 let |

Indeksi: GIST na `plots.geom`, `(organization_id, validation_status)`, `(organization_id, label)`.
Seznam 1.000 parcel: brez geometrije v seznamu (samo atributi); karta naloži geometrije poenostavljene (`ST_SimplifyPreserveTopology`) v enem klicu → cilj < 2 s.

## 6. Pravila validacije parcele

Vsaka napaka ima kodo, resnost in prevod.

| Koda | Resnost | Pravilo |
|---|---|---|
| `GEOM_TYPE_NOT_ALLOWED` | ❌ | samo Point/MultiPoint/Polygon/MultiPolygon |
| `COORD_OUT_OF_RANGE` | ❌ | lon ∈ [-180,180], lat ∈ [-90,90]; zazna tudi zamenjan lat/lon in neprojicirane metre |
| `PRECISION_TOO_LOW` | ❌ | izvirne koordinate imajo < 6 decimalk (pri uvozu); pri risanju jih vedno zapišemo s 6 |
| `POLYGON_NOT_CLOSED` | ❌ → samodejni popravek + ⚠️ | prvi ≠ zadnji par; zapremo samodejno in opozorimo |
| `POLYGON_TOO_FEW_POINTS` | ❌ | < 4 pari (vključno z zaključnim) |
| `POLYGON_SELF_INTERSECTION` | ❌ | `turf.kinks` |
| `RING_ORIENTATION` | samodejni popravek | preuredimo na RFC 7946 |
| `POINT_OVER_4HA` | ❌ | točka z deklarirano površino > 4 ha → mora biti poligon |
| `POINT_POLYGON_RECOMMENDED` | ⚠️ | točka ≤ 4 ha |
| `POINT_AREA_MISSING` | ⚠️ | točka brez površine (TRACES bi privzel 4 ha) |
| `OUTSIDE_COUNTRY` | ❌ | parcela ne leži v deklarirani državi (meje Natural Earth 1:10m za SI, HR, BA, RS + sosede, s toleranco 200 m) |
| `DUPLICATE_PLOT` | ⚠️ | ≥ 95 % prekrivanja (IoU) z drugo parcelo iste organizacije ali enaka točka v polmeru 5 m |
| `AREA_ZERO` | ❌ | poligon s površino ≈ 0 |
| `NO_GEOMETRY` | ⚠️ | samo poštni naslov – primerno le za poenostavljeno izjavo, ne za DDS |

Uvoz: samodejno zaznamo koordinatni sistem (`.prj`, `crs` v GeoJSON, ali hevristika: vrednosti v metrih znotraj obsega D96/TM → predlagamo EPSG:3794 in prosimo za potrditev). Uporabnik vidi predogled na karti pred shranjevanjem.

## 7. Strani

1. `/[locale]/login`, `/signup`: magic link ali geslo
2. `/onboarding`: ustvari organizacijo (ime, država, velikost, tip, je bil pod EUTR)
3. `/dashboard`: rok za začetek veljavnosti EUDR, število parcel po statusu, dokumenti, ki potečejo v 30 dneh, zadnje pošiljke
4. `/plots`: seznam + karta (preklop na telefonu), filtri (status, dobavitelj, država), **uvoz**, **nariši novo**
5. `/plots/[id]`: karta, urejanje oglišč, napake, povezani dokumenti
6. `/documents`: nalaganje (tudi s kamero telefona), tip, veljavnost, povezava na parcele
7. `/suppliers`, `/customers`, `/products`: preprosti šifranti
8. `/shipments`: seznam s statusi; `/shipments/new` (čarovnik v 4 korakih: kupec → produkt in količina → parcele (seznam ali karta) → dokumenti/reference)
9. `/shipments/[id]`: kontrolni seznam pripravljenosti, **Prenesi GeoJSON**, **Povzetek za DDS** (kopiraj polje za poljem), vnos referenčne/verifikacijske številke, **Kopiraj pošiljko**, **Deli s kupcem**
10. `/settings`: organizacija, člani in vabila, izvoz arhiva (ZIP), izbris računa
11. `/share/[token]`: javni paket (brez prijave): dobavitelj, produkt, količina, karta, GeoJSON, seznam dokumentov (prenos prek podpisanih URL-jev, 10 min), DDS referenca; PDF prenos
12. `/legal/terms`, `/legal/privacy`

Kontrolni seznam pripravljenosti (pošiljka gre v `ready` šele, ko je vse ✅):
- vse parcele brez ❌; HS koda v obsegu; znanstveno ime vrste; neto masa (obvezna pri uvozu/izvozu) ali prostornina; vsaj en dokument za vsako parcelo (opozorilo, ne blokada); velikost GeoJSON < 25 MB; pri načinu `forward_references` vsaj ena referenca dobavitelja.

## 8. Varnost in GDPR

- RLS na vseh tabelah; pomožna funkcija `is_member(org_id)` (`security definer`, `stable`). Testi: uporabnik A ne vidi/ne spreminja podatkov organizacije B (za vsako tabelo).
- Deljive povezave: 32 bajtov naključnega tokena (base64url), v bazi samo SHA-256 hash, rok veljavnosti (privzeto 30 dni), možnost preklica. Javna stran bere prek strežniške funkcije s service ključem, ki vrne samo podatke tistih pošiljk.
- Dokumenti: zaseben bucket, pot `org_id/document_id/ime`, Storage RLS po `org_id`, podpisani URL-ji (10 min).
- Service ključ samo na strežniku.
- Izbris računa: uporabnik se izbriše takoj; organizacija se izbriše, ko jo zapusti zadnji lastnik, **razen** podatkov oddanih pošiljk in revizijske sledi, ki se hranijo 5 let od oddaje (zakonska obveznost) in nato samodejno izbrišejo. To je jasno napisano v politiki zasebnosti.
- Podatki samo v EU (Supabase Frankfurt; Vercel funkcije v regiji `fra1`).

## 9. Testiranje

- **Unit (Vitest), `lib/geo`:** veljaven poligon; samopresečišče (»metuljček«); premalo decimalk; nezaprt poligon; parcela 5 ha kot točka; točka 3 ha brez površine; D96/TM uvoz (znana točka v Ljubljani → pričakovane WGS-84 koordinate, odstopanje < 1 m); KML, KMZ, Shapefile zip s `.prj`, CSV z vejico in podpičjem; izvoz EUDR (struktura, 6 decimalk, `Area` pri točkah, orientacija, meja 25 MB); podvojena parcela; parcela izven države.
- **RLS:** za vsako tabelo dostop med organizacijama; `audit_log` ni mogoče spreminjati; deljiva povezava po izteku ne deluje.
- **E2E (Playwright):** tok iz merila uspeha na mobilnem in namiznem zaslonu.
- **Hitrost:** seme 1.000 parcel, meritev nalaganja seznama in karte.

## 10. Koraki izvedbe

Vsak korak se konča z navodilom, kako ga preizkusiš.

1. **Geo jedro** (`lib/geo` + testi), brez vmesnika
2. **Ogrodje:** Next.js, Tailwind, shadcn/ui, next-intl, ESLint/strict TS, Vercel projekt, Supabase projekt + migracije + RLS testi
3. **Prijava, organizacija, vabila**
4. **Parcele:** karta, risanje, uvoz s predogledom, seznam
5. **Dokumenti**
6. **Šifranti + pošiljke:** kontrolni seznam, GeoJSON, povzetek DDS, reference, kopiranje
7. **Paket za kupca:** povezava + PDF
8. **Arhiv in revizija:** ZIP izvoz, pravna obvestila, izbris računa, meritve hitrosti, mobilni pregled

## 11. Odprte točke (`TODO: preveri`)

1. Celoten uradni GeoJSON File Description (koren, orientacija, luknje, omejitve števila točk) in pravilo 6 decimalk (čl. 2(28)).
2. Celoten seznam polj DDS v API V3 in format referenčne/verifikacijske številke.
3. Točen seznam kod KN v Prilogi I po Delegirani uredbi 2026/2102.
4. Ali za žago, ki kupuje od domačih lastnikov gozdov in proizvaja žagan les, velja način `forward_references` (ali je predelava v nov izdelek še vedno "nadaljnji operater"). **To odloča, ali bo glavni uporabnik oddajal DDS.**
5. Začetek veljavnosti za mikro/male operaterje, ki so bili pod EUTR (čl. 38).
6. Vsebina poenostavljene izjave (Priloga III) in ali jo je treba posodabljati.
7. Morebitna posodobitev razvrstitve tveganja držav v letu 2026.

Za točke 1–3 potrebujemo dostop do uradnih strani EK iz razvojnega okolja (dodati domene med dovoljene); za točko 4 je priporočljiv tudi posvet s pravnikom ali s pristojnim organom (v Sloveniji: Ministrstvo za kmetijstvo, gozdarstvo in prehrano / Zavod za gozdove Slovenije, `TODO: preveri pristojni organ`).
