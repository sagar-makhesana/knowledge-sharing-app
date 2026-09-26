// Search state lives in the URL (?q=&category=&tags=&sort=) so searches are shareable. Values are
// parsed leniently: anything invalid is dropped rather than causing an error.
import { z } from "zod";
import { CATEGORY_IDS, normalizeTag, type CategoryId } from "./schema";

export const SORT_OPTIONS = ["relevance", "newest"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export interface SearchParams {
  q: string;
  category: CategoryId | null;
  tags: string[];
  /** `null` means the default: relevance with a query, newest without. */
  sort: SortOption | null;
}

const first = (value: unknown) => (Array.isArray(value) ? value[0] : value);

const SearchParamsSchema = z.object({
  q: z.preprocess(first, z.string().trim().max(200).catch("")).default(""),
  category: z.preprocess(first, z.enum(CATEGORY_IDS).nullable().catch(null)).default(null),
  tags: z
    .preprocess(
      (value) => (Array.isArray(value) ? value.join(",") : value),
      z
        .string()
        .transform((raw) => [...new Set(raw.split(",").map(normalizeTag).filter(Boolean))])
        .catch([]),
    )
    .default([]),
  sort: z.preprocess(first, z.enum(SORT_OPTIONS).nullable().catch(null)).default(null),
});

/** Reads search state from URL search params (as Next.js passes them to a page). */
export function parseSearchParams(
  raw: Record<string, string | string[] | undefined>,
): SearchParams {
  return SearchParamsSchema.parse(raw);
}

/** The URL query string for a search state; empty values are left out to keep links short. */
export function toQueryString(params: Partial<SearchParams>): string {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.category) query.set("category", params.category);
  if (params.tags?.length) query.set("tags", params.tags.join(","));
  if (params.sort) query.set("sort", params.sort);
  const string = query.toString();
  return string ? `?${string}` : "";
}
