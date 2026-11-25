import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { publicAvailability } from "@/server/services/marketplace";
import { rateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

const MAX_SPAN_MS = 2 * 366 * 24 * 3_600_000;

const instant = z
  .string()
  .max(40)
  .transform((s) => new Date(s))
  .refine((d) => !Number.isNaN(d.getTime()), "Neveljaven datum.");

const schema = z
  .object({ listing: z.guid({ error: "Neveljaven oglas." }), start: instant, end: instant })
  .refine((v) => v.end > v.start, { message: "Konec mora biti po začetku.", path: ["end"] })
  .refine((v) => v.end.getTime() - v.start.getTime() <= MAX_SPAN_MS, { message: "Najem je lahko dolg največ 2 leti.", path: ["end"] })
  .refine((v) => v.start.getTime() >= Date.now() - 24 * 3_600_000, { message: "Začetek ne sme biti v preteklosti.", path: ["start"] });

const noStore = { "Cache-Control": "no-store" };

function clientIp(req: NextRequest) {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function GET(req: NextRequest) {
  const rl = rateLimit(`public-availability:${clientIp(req)}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Preveč poizvedb. Počakajte minuto in poskusite znova." },
      { status: 429, headers: { ...noStore, "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) } },
    );
  }

  const sp = req.nextUrl.searchParams;
  const parsed = schema.safeParse({ listing: sp.get("listing") ?? "", start: sp.get("start") ?? "", end: sp.get("end") ?? "" });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Neveljavna poizvedba." }, { status: 400, headers: noStore });
  }

  const { listing, start, end } = parsed.data;
  const result = await publicAvailability(listing, start, end);
  if (!result) return NextResponse.json({ error: "Oglas ne obstaja." }, { status: 404, headers: noStore });

  return NextResponse.json(
    { free: result.free, totalCents: result.quote.totalCents, days: result.quote.days, breakdown: result.quote.breakdown },
    { headers: noStore },
  );
}
