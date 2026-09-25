import { z } from "zod";

/**
 * Categories are stored by stable slug; labels are display-only and can change freely.
 */
export const CATEGORIES = [
  { id: "aras-innovator", label: "Aras Innovator" },
  { id: "teamcenter", label: "Teamcenter" },
  { id: "sql-server", label: "SQL Server" },
  { id: "iis-hosting", label: "IIS / Hosting" },
  { id: "integration", label: "Integration" },
  { id: "upgrade-migration", label: "Upgrade / Migration" },
  { id: "process-methodology", label: "Process / Methodology" },
  { id: "other", label: "Other" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];

export function categoryLabel(id: CategoryId): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

export const LIMITS = {
  title: 120,
  summary: 300,
  content: 20_000,
  tag: 30,
  tags: 10,
  environment: 120,
  author: 80,
} as const;

/** Lowercase, trim, and join inner whitespace with hyphens: "App Pool " -> "app-pool". */
export function normalizeTag(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "-");
}

const TagSchema = z
  .string()
  .transform(normalizeTag)
  .pipe(
    z
      .string()
      .min(1, "Tags can't be empty")
      .max(LIMITS.tag, `Tags must be at most ${LIMITS.tag} characters`)
      .regex(/^[\p{L}\p{N}.#+_-]+$/u, "Tags may only contain letters, numbers and . # + _ -"),
  );

/** Optional free text: trimmed, and empty input is stored as null. */
function optionalText(max: number, label: string) {
  return z
    .string()
    .trim()
    .max(max, `${label} must be at most ${max} characters`)
    .nullish()
    .transform((v) => (v ? v : null));
}

/**
 * The user-editable fields of an entry. Shared by the form (client) and the server actions,
 * so both validate with exactly the same rules.
 */
export const KnowledgeInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, "Title must be at least 5 characters")
    .max(LIMITS.title, `Title must be at most ${LIMITS.title} characters`),
  summary: z
    .string()
    .trim()
    .min(20, "Summary must be at least 20 characters")
    .max(LIMITS.summary, `Summary must be at most ${LIMITS.summary} characters`),
  content: z
    .string()
    .trim()
    .min(30, "Content must be at least 30 characters")
    .max(LIMITS.content, `Content must be at most ${LIMITS.content} characters`),
  category: z.enum(CATEGORY_IDS, { error: "Choose a category" }),
  tags: z
    .array(TagSchema)
    .max(LIMITS.tags, `Use at most ${LIMITS.tags} tags`)
    .transform((tags) => [...new Set(tags)]),
  environment: optionalText(LIMITS.environment, "Environment"),
  author: optionalText(LIMITS.author, "Author"),
});

/** What the form holds before validation. */
export type KnowledgeFormValues = z.input<typeof KnowledgeInputSchema>;
/** Validated, normalized input accepted by the repository. */
export type KnowledgeInput = z.output<typeof KnowledgeInputSchema>;

/**
 * A stored entry. Deliberately lenient about content rules (those are enforced on input) but
 * strict about identity and timestamps, which a future database migration depends on.
 */
export const KnowledgeEntrySchema = z.object({
  id: z.uuid(),
  title: z.string(),
  summary: z.string(),
  content: z.string(),
  category: z.enum(CATEGORY_IDS),
  tags: z.array(z.string()),
  environment: z.string().nullable(),
  author: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type KnowledgeEntry = z.infer<typeof KnowledgeEntrySchema>;
