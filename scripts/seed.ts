/**
 * Development seed. Creates a clearly labelled DEMO organization with sample
 * inventory, customers and reservations around today. Never run against production.
 * Login: demo@rentora.test / demo-geslo-2026
 */
if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed in production");

async function main() {
  const { registerUser, authenticate } = await import("../src/server/services/identity");
  const { createOrganization, updateOrganization } = await import("../src/server/services/organizations");
  const { createListing, addUnits, listCategories, generateCodes, changeUnitStatus } = await import("../src/server/services/inventory");
  const { createCustomer } = await import("../src/server/services/customers");
  const { createReservation, transitionReservation, createBlock } = await import("../src/server/services/reservations");
  const { withPublic, pool } = await import("../src/server/db");

  const email = "demo@rentora.test";
  const password = "demo-geslo-2026";
  const existing = await withPublic((tx) => tx.maybeOne("select id from users where email = $1", [email]));
  if (existing) {
    console.log("Demo data already present. Login:", email, password);
    await pool().end();
    return;
  }
  await registerUser({ fullName: "Demo Uporabnik", email, password });
  const user = await authenticate({ email, password });
  const org = await createOrganization(user.id, { name: "Demo Najem (demonstracija)", city: "Ljubljana", address: "Letališka cesta 1", planCode: "pro", phone: "01 000 00 00" });
  const owner = { orgId: org.id, userId: user.id, role: "owner" as const };
  await updateOrganization(owner, { name: "Demo Najem (demonstracija)", legalName: "Demo d.o.o.", taxId: "SI00000000", vatPayer: true });
  const cats = Object.fromEntries((await listCategories()).map((c) => [c.slug, c.id]));

  const catalog: { title: string; cat: string; m: string; model: string; day: number; week: number; month?: number; dep: number; n: number; prefix: string; buffer?: number; specs: Record<string, string>; pub: boolean }[] = [
    { title: "Rušilno kladivo Makita HM1812", cat: "rusenje-in-vrtanje", m: "Makita", model: "HM1812", day: 3900, week: 19500, dep: 15000, n: 5, prefix: "KLD", specs: { "Moč": "2000 W", "Udarna energija": "72,8 J", "Teža": "31,3 kg" }, pub: true },
    { title: "Mini bager Kubota U17", cat: "gradbena-mehanizacija", m: "Kubota", model: "U17-3", day: 14900, week: 74500, month: 239000, dep: 50000, n: 2, prefix: "BGR", buffer: 120, specs: { "Masa": "1,7 t", "Globina kopanja": "2,3 m", "Širina": "0,99 m" }, pub: true },
    { title: "Vibracijska plošča Wacker DPU 2550", cat: "zbijanje-tal", m: "Wacker Neuson", model: "DPU 2550H", day: 5500, week: 27500, dep: 20000, n: 3, prefix: "VPL", specs: { "Teža": "158 kg", "Sila": "25 kN" }, pub: true },
    { title: "Škarjasta dvižna ploščad Genie GS-1932", cat: "dvizna-tehnika", m: "Genie", model: "GS-1932", day: 9900, week: 49500, dep: 30000, n: 2, prefix: "DVP", buffer: 60, specs: { "Delovna višina": "7,8 m", "Nosilnost": "227 kg" }, pub: true },
    { title: "Agregat Honda EU22i", cat: "energija", m: "Honda", model: "EU22i", day: 3500, week: 17500, dep: 10000, n: 4, prefix: "AGR", specs: { "Moč": "2,2 kW", "Hrup": "89 dB" }, pub: false },
    { title: "Prikolica Humbaur 750 kg", cat: "prikolice", m: "Humbaur", model: "HA 752513", day: 2500, week: 12500, dep: 10000, n: 3, prefix: "PRK", specs: { "Nosilnost": "570 kg", "Notranja mera": "2,51 × 1,31 m" }, pub: true },
  ];
  const listings: Record<string, { id: string; units: { id: string }[] }> = {};
  for (const c of catalog) {
    const l = await createListing(owner, {
      title: c.title, categoryId: cats[c.cat], manufacturer: c.m, model: c.model, specs: c.specs,
      description: `${c.title}. Pred vsakim najemom pregledano in očiščeno. Navodila za uporabo prejmete ob prevzemu.`,
      priceDayCents: c.day, priceWeekCents: c.week, priceMonthCents: c.month ?? null, depositCents: c.dep, bufferMinutes: c.buffer ?? 0,
      bookingMode: "request", deliveryAvailable: c.cat === "gradbena-mehanizacija", isPublished: c.pub,
    });
    const units = await addUnits(owner, l.id, generateCodes(c.prefix, 1, c.n).map((internalCode, i) => ({ internalCode, serialNumber: `SN-${c.prefix}-${4100 + i * 7}`, purchasePriceCents: c.day * 60, purchaseDate: "2024-03-01" })));
    listings[c.prefix] = { id: l.id, units };
  }

  const people = [
    { name: "Marko Horvat", phone: "041 000 101" },
    { name: "Petra Zupan", phone: "031 000 202", kind: "business" as const, companyName: "Zupan gradnje s.p.", taxId: "SI11111111", discountPercent: 10 },
    { name: "Luka Kranjc", phone: "040 000 303" },
    { name: "Nina Potočnik", phone: "051 000 404", kind: "business" as const, companyName: "Potočnik Events d.o.o.", taxId: "SI22222222" },
    { name: "Tomaž Kos", phone: "070 000 505" },
  ];
  const cust: { id: string }[] = [];
  for (const p of people) cust.push(await createCustomer(owner, { ...p, email: `${p.name.split(" ")[0].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()}@primer.test` }));

  const H = 3600_000, D = 24 * H;
  const today8 = new Date(); today8.setUTCHours(6, 0, 0, 0);
  const at = (days: number, hours = 0) => new Date(today8.getTime() + days * D + hours * H);
  const book = async (c: number, items: [string, number][], s: Date, e: Date, source: "phone" | "walk_in" | "direct" | "existing_customer" | "provider_website", status: "confirmed" | "awaiting_confirmation" | "quotation" = "confirmed") =>
    createReservation(owner, { customerId: cust[c].id, source, status, startsAt: s, endsAt: e, items: items.map(([p, q]) => ({ listingId: listings[p].id, quantity: q })) });

  const r1 = await book(0, [["KLD", 2]], at(-2), at(1, 8), "phone"); await transitionReservation(owner, r1.id, "active");
  const r2 = await book(1, [["BGR", 1], ["VPL", 1]], at(-1), at(0, 10), "existing_customer"); await transitionReservation(owner, r2.id, "active");
  const r3 = await book(2, [["DVP", 1]], at(0, 3), at(2, 3), "walk_in");
  await book(3, [["AGR", 3], ["PRK", 1]], at(0, 5), at(1, 5), "direct", "awaiting_confirmation");
  await book(4, [["KLD", 1]], at(3), at(10), "provider_website");
  await book(1, [["BGR", 1]], at(4), at(9), "existing_customer");
  await book(0, [["PRK", 2]], at(6), at(7), "phone", "quotation");
  const r8 = await book(2, [["VPL", 1]], at(-6), at(-4), "phone"); await transitionReservation(owner, r8.id, "active"); await transitionReservation(owner, r8.id, "inspection"); await transitionReservation(owner, r8.id, "completed");
  const r9 = await book(4, [["AGR", 1]], at(-3), at(-1), "walk_in"); await transitionReservation(owner, r9.id, "active"); // overdue
  void r3;
  await createBlock(owner, { unitId: listings.DVP.units[1].id, kind: "maintenance", startsAt: at(1), endsAt: at(3), note: "Letni servis hidravlike" });
  await changeUnitStatus(owner, listings.VPL.units[2].id, "damaged", "Poškodovana ročica");

  console.log("Seeded DEMO organization. Login:", email, password);
  await pool().end();
}

main().catch((e) => { console.error(e); process.exit(1); });
