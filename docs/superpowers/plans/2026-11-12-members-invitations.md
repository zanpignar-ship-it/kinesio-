# LesTrace: člani in vabila (brez e-pošte) – načrt izvedbe

**Goal:** Lastnik povabi sodelavca s povezavo (kopira jo in pošlje sam), vidi člane, spremeni vlogo, odstrani člana in prekliče vabilo. Povabljeni se prijavi ali registrira z istim e-naslovom in sprejme vabilo.

## Odločitve
- E-pošte ne pošiljamo (korak 3b). Povezava `/[locale]/invite/<token>` velja 7 dni, shranjen je samo SHA-256 žetona.
- Vabilo velja samo za vpisani e-naslov (primerjava brez velikih/malih črk). Ker potrjevanje e-naslova v razvoju ni vključeno, je to zaenkrat šibka zaščita. TODO: preveri – ob koraku 3b vklopiti »Confirm email«.
- Funkcije v bazi (security definer): `organization_members`, `invitation_info`, `accept_invitation` (migracija `20261112000006_invitations.sql`, uveljavljena).
- Zadnjega lastnika ni mogoče odstraniti ali ponižati (obstoječi sprožilec).
- Registracija in prijava ohranita `next`, zato se uporabnik po registraciji vrne na vabilo.

## Tasks
1. Migracija + DB testi (člani samo za svojo organizacijo, enkratna uporaba, napačen e-naslov, potekla povezava, anonimni).
2. `inviteSchema`, `acceptErrorKey` – enotski testi.
3. Akcije: ustvari/prekliči vabilo, vloga, odstrani člana; stran za sprejem; plošča v nastavitvah; prevodi.
4. E2E: lastnik ustvari povezavo → tujec je ne more uporabiti → sodelavec se registrira in pridruži kot član → povezave ni mogoče ponovno uporabiti.
