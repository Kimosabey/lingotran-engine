import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { french } from "@/lib/data";
import { EXPLORER_LANGS, EXPLORER_TYPES } from "@/lib/csv-explorer-shared";

// Enumerated from the same sources that generate the routes (french.books,
// EXPLORER_LANGS x EXPLORER_TYPES) rather than a hand-kept list, so a new
// book or dataset appears here without anyone remembering to add it.
export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => `${SITE_URL}${path}`;

  const top: MetadataRoute.Sitemap = [
    { url: url("/"), changeFrequency: "weekly", priority: 1 },
    { url: url("/engine"), changeFrequency: "monthly", priority: 0.8 },
    { url: url("/french"), changeFrequency: "weekly", priority: 0.8 },
    { url: url("/german"), changeFrequency: "weekly", priority: 0.8 },
    { url: url("/reference"), changeFrequency: "monthly", priority: 0.5 },
  ];

  const books: MetadataRoute.Sitemap = Object.keys(french.books).map((slug) => ({
    url: url(`/french/${slug}`),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  const explorer: MetadataRoute.Sitemap = EXPLORER_LANGS.flatMap((lang) =>
    EXPLORER_TYPES.map((type) => ({
      url: url(`/explorer/${lang}/${type}`),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }))
  );

  return [...top, ...books, ...explorer];
}
