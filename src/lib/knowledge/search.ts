import MiniSearch, { type SearchResult } from "minisearch";
import { CATEGORIES, type CategoryId, type KnowledgeEntry } from "./schema";
import type { SearchParams, SortOption } from "./search-params";

// ---------------------------------------------------------------------------------------------
// Text processing shared by indexing and highlighting, so highlighted words are exactly the
// words the index matched.
// ---------------------------------------------------------------------------------------------

const WORD = /[\p{L}\p{N}]+/gu;
const NOT_WORD = /[^\p{L}\p{N}]+/u;

const STOP_WORDS = new Set(
  "a an and are as at be but by can do for from how i if in into is it of on or so that the then this to was what when where why with".split(
    " ",
  ),
);

function processTerm(term: string): string | null {
  const lower = term.toLowerCase();
  return lower && !STOP_WORDS.has(lower) ? lower : null;
}

/** Markdown to plain text, good enough for snippets (not a full Markdown parser). */
export function markdownToText(markdown: string): string {
  return markdown
    .replace(/^```.*$/gm, " ") // code fence markers (the code itself stays searchable)
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // links and images -> their text
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, "") // headings, quotes, list markers
    .replace(/^\s*\|?[\s:|-]+\|?\s*$/gm, " ") // table divider rows
    .replace(/[*~`]/g, "") // emphasis and inline code markers
    .replace(/\|/g, " ") // table cell separators
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------------------------
// Highlighting
// ---------------------------------------------------------------------------------------------

export interface TextSegment {
  text: string;
  match: boolean;
}

/** Splits `text` into segments, marking the words that are in `terms` (lowercase). */
export function highlight(text: string, terms: ReadonlySet<string>): TextSegment[] {
  if (!terms.size) return text ? [{ text, match: false }] : [];
  const segments: TextSegment[] = [];
  let last = 0;
  for (const word of text.matchAll(WORD)) {
    if (!terms.has(word[0].toLowerCase())) continue;
    if (word.index > last) segments.push({ text: text.slice(last, word.index), match: false });
    segments.push({ text: word[0], match: true });
    last = word.index + word[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), match: false });
  return segments;
}

const SNIPPET_LENGTH = 220;

/**
 * A window of about SNIPPET_LENGTH characters around the first matched word, cut at word
 * boundaries. Returns null when no term occurs in the text.
 */
export function makeSnippet(text: string, terms: ReadonlySet<string>): TextSegment[] | null {
  let firstMatch = -1;
  for (const word of text.matchAll(WORD)) {
    if (terms.has(word[0].toLowerCase())) {
      firstMatch = word.index;
      break;
    }
  }
  if (firstMatch === -1) return null;

  let start = Math.max(0, firstMatch - 60);
  let end = Math.min(text.length, start + SNIPPET_LENGTH);
  start = Math.max(0, end - SNIPPET_LENGTH);
  if (start > 0) start = text.indexOf(" ", start) + 1 || start;
  if (end < text.length)
    end = text.lastIndexOf(" ", end) > start ? text.lastIndexOf(" ", end) : end;

  const excerpt = `${start > 0 ? "…" : ""}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`;
  return highlight(excerpt, terms);
}

// ---------------------------------------------------------------------------------------------
// Index and search
// ---------------------------------------------------------------------------------------------

export interface SearchHit {
  entry: KnowledgeEntry;
  /** Relevance score; null when there is no query. */
  score: number | null;
  title: TextSegment[];
  /** Summary, or a content excerpt when only the content matched. */
  snippet: TextSegment[];
  /** Tags containing a matched word, so tag-only matches are visible too. */
  matchedTags: string[];
}

export interface FacetCount<T extends string = string> {
  value: T;
  count: number;
}

export interface SearchOutcome {
  hits: SearchHit[];
  /** "all": every query word matched. "any": nothing matched all words, so results match some. */
  matchMode: "all" | "any" | null;
  sort: SortOption;
  facets: {
    categories: (FacetCount<CategoryId> & { label: string })[];
    tags: FacetCount[];
  };
  totalEntries: number;
}

export const FIELD_BOOSTS = { title: 3, tags: 2.5, summary: 1.5, content: 1 } as const;

/**
 * An in-memory MiniSearch index over all entries. Cheap to build (milliseconds for hundreds of
 * entries), so it's rebuilt whenever the data changes rather than updated incrementally.
 */
export class KnowledgeSearchIndex {
  private readonly miniSearch: MiniSearch<KnowledgeEntry>;
  private readonly entries: Map<string, KnowledgeEntry>;
  /** Content as plain text, for indexing and snippets. */
  private readonly plainContent: Map<string, string>;

  constructor(entries: readonly KnowledgeEntry[]) {
    this.entries = new Map(entries.map((entry) => [entry.id, entry]));
    this.plainContent = new Map(entries.map((e) => [e.id, markdownToText(e.content)]));
    this.miniSearch = new MiniSearch<KnowledgeEntry>({
      idField: "id",
      fields: ["title", "summary", "content", "tags"],
      extractField: (entry, field) => {
        if (field === "tags") return entry.tags.join(" ");
        if (field === "content") return this.plainContent.get(entry.id);
        return entry[field as keyof KnowledgeEntry];
      },
      tokenize: (text) => text.split(NOT_WORD),
      processTerm,
      searchOptions: {
        boost: FIELD_BOOSTS,
        // Prefix matching makes search-as-you-type work ("recyc" finds "recycling").
        prefix: (term) => term.length >= 2,
        // Allow typos on words of 5+ letters only; shorter words would match too much ("lock"/"look").
        fuzzy: (term) => (term.length >= 5 ? 0.2 : false),
      },
    });
    this.miniSearch.addAll([...this.entries.values()]);
  }

  search(params: SearchParams): SearchOutcome {
    const matches = this.match(params.q);
    const sort = params.sort ?? (params.q ? "relevance" : "newest");

    let candidates: { entry: KnowledgeEntry; result: SearchResult | null }[] = matches.results.map(
      (result) => ({ entry: this.entries.get(result.id)!, result }),
    );
    if (!params.q) {
      candidates = [...this.entries.values()].map((entry) => ({ entry, result: null }));
    }

    const hasTags = (entry: KnowledgeEntry) => params.tags.every((t) => entry.tags.includes(t));
    const inCategory = (entry: KnowledgeEntry) =>
      !params.category || entry.category === params.category;

    // Each facet counts over the results of the *other* filters, so the counts show what
    // choosing that value would give.
    const categoryCounts = countBy(
      candidates.filter((c) => hasTags(c.entry)),
      (c) => [c.entry.category],
    );
    const filtered = candidates.filter((c) => hasTags(c.entry) && inCategory(c.entry));
    const tagCounts = countBy(filtered, (c) => c.entry.tags);

    if (sort === "newest" || !params.q) {
      filtered.sort((a, b) => b.entry.createdAt.localeCompare(a.entry.createdAt));
    } // otherwise MiniSearch's relevance order is kept

    return {
      hits: filtered.map(({ entry, result }) =>
        toHit(entry, this.plainContent.get(entry.id) ?? "", result),
      ),
      matchMode: params.q ? matches.mode : null,
      sort,
      facets: {
        categories: CATEGORIES.map(({ id, label }) => ({
          value: id,
          label,
          count: categoryCounts.get(id) ?? 0,
        })),
        tags: [...tagCounts.entries()]
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
      },
      totalEntries: this.entries.size,
    };
  }

  /** All query words must match; if nothing does, fall back to any word matching. */
  private match(q: string): { results: SearchResult[]; mode: "all" | "any" } {
    if (!q) return { results: [], mode: "all" };
    const all = this.miniSearch.search(q, { combineWith: "AND" });
    if (all.length) return { results: all, mode: "all" };
    return { results: this.miniSearch.search(q, { combineWith: "OR" }), mode: "any" };
  }
}

function toHit(
  entry: KnowledgeEntry,
  plainContent: string,
  result: SearchResult | null,
): SearchHit {
  const terms = new Set(result?.terms ?? []);
  const summary = highlight(entry.summary, terms);
  // Show the summary when it contains a match (or there's no query); otherwise show where the
  // content matched, so the reason for the result is visible.
  const snippet =
    summary.some((s) => s.match) || !terms.size
      ? summary
      : (makeSnippet(plainContent, terms) ?? summary);
  return {
    entry,
    score: result?.score ?? null,
    title: highlight(entry.title, terms),
    snippet,
    matchedTags: entry.tags.filter((tag) => tag.split(NOT_WORD).some((word) => terms.has(word))),
  };
}

function countBy<T>(
  items: readonly T[],
  keys: (item: T) => readonly string[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) {
    for (const key of keys(item)) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}
