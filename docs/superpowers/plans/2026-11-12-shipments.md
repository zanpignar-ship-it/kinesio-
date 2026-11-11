# LesTrace korak 6: šifranti in pošiljke – načrt izvedbe

> Naročnik je za nočno delo vnaprej odobril izvedbo korakov 5–8 brez sprotnih potrditev.

**Goal:** Uporabnik vnese kupce, izdelke (HS koda, drevesna vrsta) in dobavitelje, ustvari pošiljko (kupec, izdelki s količinami, parcele, dokumenti, reference dobaviteljev), vidi kontrolni seznam pripravljenosti, prenese GeoJSON za EUDR in povzetek podatkov za izjavo DDS, po oddaji vpiše referenčno in verifikacijsko številko ter pošiljko kopira za nov tovor.

**Architecture:** Šifranti so preprosti obrazci (strežniške akcije, RLS). Pošiljka: `shipments` + `shipment_items` + `shipment_plots` (posnetek geometrije) + `shipment_documents` + `upstream_references`. Posnetek geometrije in zamenjavo povezav naredi funkcija v bazi `set_shipment_links` (security invoker, ena transakcija). Kontrolni seznam je čista funkcija (`src/lib/shipments/readiness.ts`). GeoJSON izvoz uporabi obstoječi `buildEudrGeoJson` na posnetkih (route handler, prenos datoteke).

## Odločitve
- Pošiljka je urejena, dokler ni `submitted`; po oddaji se spreminjata le status in številki (spremembe zabeleži revizijska sled).
- `ProducerName` v GeoJSON = ime dobavitelja parcele, če obstaja; `ProducerCountry` = država parcele.
- Kontrolni seznam (napaka blokira »pripravljeno«, opozorilo ne):
  - vsaj en izdelek; HS koda v obsegu EUDR; znanstveno ime vrste (obvezno za les); neto masa pri uvozu/izvozu, sicer masa ali prostornina ali kosi (napaka);
  - način `submit_dds`: vsaj ena parcela; nobena parcela z napako; parcela brez geometrije (napaka); GeoJSON < 25 MB; država proizvodnje;
  - način `forward_references`: vsaj ena referenca dobavitelja (napaka); parcele neobvezne;
  - vsaj en dokument za vsako parcelo (opozorilo); potekel dokument (opozorilo).
- Kopija pošiljke: isti kupec, izdelki (brez količin? – s količinami), parcele, dokumenti, način; nova interna oznaka `<stara>-2…`; status `draft`; `copied_from_id`.

## Tasks
1. Migracija `set_shipment_links(p_shipment, p_plot_ids, p_document_ids)` + DB test (posnetek geometrije, samo lastna organizacija).
2. `readiness.ts`, `dds-summary.ts` (polja v vrstnem redu TRACES), `next-ref.ts` (oznaka kopije) – enotski testi.
3. Šifranti: kupci, izdelki (HS iz `hs_codes` v obsegu, vrsta iz `species`), dobavitelji – seznam + obrazec + urejanje.
4. Pošiljke: seznam (status), nova/urejanje (čarovnik v enem obrazcu), podrobnosti s kontrolnim seznamom, GeoJSON prenos, povzetek DDS s kopiranjem, oddaja (številki), kopiranje.
5. E2E: celoten tok (šifranti → pošiljka → kontrolni seznam → GeoJSON se prenese in je veljaven → številke → kopija).
