import type { MetadataRoute } from "next";
import { searchListings } from "@/server/services/marketplace";
import { SITE_URL } from "@/components/public/format";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/equipment`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/business`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/pricing`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
  ];
  let listings: Awaited<ReturnType<typeof searchListings>> = [];
  try {
    listings = await searchListings({});
  } catch {
    // Database unavailable: still serve the static part of the sitemap.
  }
  return [
    ...pages,
    ...listings.map((l) => ({
      url: `${SITE_URL}/equipment/${l.provider_slug}/${l.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
