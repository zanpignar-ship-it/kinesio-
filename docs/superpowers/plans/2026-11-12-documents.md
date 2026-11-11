# LesTrace korak 5: dokumenti – načrt izvedbe

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Naročnik je za nočno delo vnaprej odobril izvedbo korakov 5–8 brez sprotnih potrditev.

**Goal:** Uporabnik naloži dovoljenje za posek, odločbo, dobavnico ali certifikat (PDF ali fotografija, tudi s kamero telefona), vnese veljavnost, poveže dokument s parcelami in je opozorjen, ko dokument poteče ali bo kmalu potekel.

**Architecture:** Datoteka gre iz brskalnika neposredno v zaseben bucket `documents` (pot `<org>/<document_id>/<ime>`, RLS), zapis v `documents` + `plot_documents` ustvari strežniška akcija. Ogled prek podpisanega URL-ja (10 min), ki ga ustvari strežnik v imenu prijavljenega uporabnika. Brez novih tabel.

**Spec:** §5 `documents`, §5.3 v promptu, §7 stran 6, §8 (zaseben bucket, podpisani URL-ji).

## Global Constraints
- Tipi: `felling_permit`, `decision`, `delivery_note`, `certificate_fsc`, `certificate_pefc`, `other`; datoteke PDF/JPEG/PNG/HEIC/WEBP, največ 20 MB (omejitev bucketa).
- Stanje veljavnosti: `none` (brez datuma), `valid`, `expiring` (≤ 30 dni), `expired`.
- Povezava parcela–dokument samo znotraj organizacije (sestavljeni FK že v bazi).
- Vsi teksti v 5 jezikih.

## Tasks
1. `documentExpiry(validTo, today)` + zod `documentFormSchema` (naslov, tip, datuma, `validTo ≥ validFrom`, plotIds uuid[]) – enotski testi.
2. Akcije: `createDocument` (po uspešnem nalaganju), `updateDocument` (podatki + povezave s parcelami), `deleteDocument` (objekt v shrambi + vrstica; uporabljen v pošiljki → sporočilo `documents.errors.inUse`), `documentUrl` (podpisan URL 600 s).
3. Strani: `/app/documents` (seznam s filtri tip/veljavnost, števci, opozorila), `/app/documents/new` (nalaganje + izbor parcel z iskanjem), `/app/documents/[id]` (ogled, urejanje, brisanje), dokumenti na podrobnostih parcele, kartica »potečejo v 30 dneh« na nadzorni plošči, povezava v glavi.
4. E2E: nalaganje PDF z veljavnostjo in povezavo s parcelo → v seznamu in na parceli; potekel dokument ima oznako; ogled odpre podpisan URL (200); izbris.
