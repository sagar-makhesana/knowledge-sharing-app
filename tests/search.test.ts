import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { KnowledgeEntry } from "@/lib/knowledge/schema";
import {
  KnowledgeSearchIndex,
  highlight,
  makeSnippet,
  markdownToText,
} from "@/lib/knowledge/search";
import { parseSearchParams, toQueryString, type SearchParams } from "@/lib/knowledge/search-params";

const seed: KnowledgeEntry[] = JSON.parse(
  readFileSync(path.join(process.cwd(), "data", "seed.json"), "utf8"),
).entries;

const params = (overrides: Partial<SearchParams> = {}): SearchParams => ({
  q: "",
  category: null,
  tags: [],
  sort: null,
  ...overrides,
});

function entry(overrides: Partial<KnowledgeEntry>): KnowledgeEntry {
  return {
    id: crypto.randomUUID(),
    title: "Untitled entry",
    summary: "A summary that mentions nothing in particular.",
    content: "Some content.",
    category: "other",
    tags: [],
    environment: null,
    author: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const titles = (index: KnowledgeSearchIndex, p: Partial<SearchParams>) =>
  index.search(params(p)).hits.map((h) => h.entry.title);

describe("ranking", () => {
  it("ranks a title match above a content-only match", () => {
    const inContent = entry({ title: "Unrelated", content: "We saw a deadlock in production." });
    const inTitle = entry({ title: "Deadlock during nightly import" });
    const index = new KnowledgeSearchIndex([inContent, inTitle]);

    expect(titles(index, { q: "deadlock" })).toEqual([inTitle.title, inContent.title]);
  });

  it("ranks a tag match above a content-only match", () => {
    const inContent = entry({ title: "One", content: "Mentions kerberos once." });
    const inTags = entry({ title: "Two", tags: ["kerberos"] });
    const index = new KnowledgeSearchIndex([inContent, inTags]);

    expect(titles(index, { q: "kerberos" })[0]).toBe("Two");
  });

  it("finds the obvious seed entry first for realistic queries", () => {
    const index = new KnowledgeSearchIndex(seed);
    expect(titles(index, { q: "collation" })[0]).toMatch(/collation conflict/i);
    expect(titles(index, { q: "app pool recycle" })[0]).toMatch(/app pool recycling/i);
    expect(titles(index, { q: "fsc teamcenter" })[0]).toMatch(/FSC/);
    expect(titles(index, { q: "oauth token" })[0]).toMatch(/OAuth token/);
  });
});

describe("matching", () => {
  const index = new KnowledgeSearchIndex(seed);

  it("matches prefixes while typing", () => {
    expect(titles(index, { q: "recycl" })[0]).toMatch(/recycling/i);
  });

  it("tolerates typos in longer words", () => {
    expect(titles(index, { q: "colation" })[0]).toMatch(/collation/i);
    expect(titles(index, { q: "statistcs" })[0]).toMatch(/statistics/i);
  });

  it("requires all words, and falls back to any word when nothing matches all", () => {
    const all = index.search(params({ q: "vault robocopy" }));
    expect(all.matchMode).toBe("all");
    expect(all.hits).toHaveLength(1);

    const any = index.search(params({ q: "robocopy kerberos" }));
    expect(any.matchMode).toBe("any");
    expect(any.hits.map((h) => h.entry.title)).toContainEqual(expect.stringMatching(/vault/i));
  });

  it("ignores stop words", () => {
    expect(titles(index, { q: "how to fix the collation" })[0]).toMatch(/collation/i);
  });

  it("returns nothing for gibberish", () => {
    expect(index.search(params({ q: "zzqxv" })).hits).toEqual([]);
  });
});

describe("filters and sorting", () => {
  const index = new KnowledgeSearchIndex(seed);

  it("lists everything newest first without a query", () => {
    const outcome = index.search(params());
    expect(outcome.hits).toHaveLength(seed.length);
    expect(outcome.sort).toBe("newest");
    const dates = outcome.hits.map((h) => h.entry.createdAt);
    expect(dates).toEqual(dates.toSorted().reverse());
  });

  it("filters by category and by all selected tags", () => {
    const sql = index.search(params({ category: "sql-server" })).hits;
    expect(sql.length).toBeGreaterThan(0);
    expect(sql.every((h) => h.entry.category === "sql-server")).toBe(true);

    const tagged = index.search(params({ tags: ["iis", "migration"] })).hits;
    expect(tagged.length).toBeGreaterThan(0);
    expect(
      tagged.every((h) => h.entry.tags.includes("iis") && h.entry.tags.includes("migration")),
    ).toBe(true);
  });

  it("sorts query results by newest when asked", () => {
    const hits = index.search(params({ q: "sql", sort: "newest" })).hits;
    const dates = hits.map((h) => h.entry.createdAt);
    expect(dates).toEqual(dates.toSorted().reverse());
  });

  it("counts each facet without its own filter", () => {
    const outcome = index.search(params({ category: "sql-server" }));
    const counts = Object.fromEntries(outcome.facets.categories.map((c) => [c.value, c.count]));
    // Other categories still show their counts, so switching category is informed.
    expect(counts["iis-hosting"]).toBeGreaterThan(0);
    // Tag counts reflect the current category.
    const tagTotal = outcome.facets.tags.find((t) => t.value === "sql-server")?.count;
    expect(tagTotal).toBe(outcome.hits.filter((h) => h.entry.tags.includes("sql-server")).length);
  });
});

describe("highlighting", () => {
  it("marks whole matched words, case-insensitively", () => {
    expect(highlight("IIS app pool recycling", new Set(["recycling", "iis"]))).toEqual([
      { text: "IIS", match: true },
      { text: " app pool ", match: false },
      { text: "recycling", match: true },
    ]);
  });

  it("highlights fuzzy and prefix matches in results", () => {
    const index = new KnowledgeSearchIndex(seed);
    const [hit] = index.search(params({ q: "recycl" })).hits;
    const marked = [...hit!.title, ...hit!.snippet].filter((s) => s.match).map((s) => s.text);
    expect(marked.map((t) => t.toLowerCase())).toContain("recycling");
  });

  it("shows a content excerpt when only the content matched", () => {
    const index = new KnowledgeSearchIndex([
      entry({ content: "## Fix\n\nIncrease `maxAllowedContentLength` in web.config." }),
    ]);
    const [hit] = index.search(params({ q: "maxallowedcontentlength" })).hits;
    expect(hit!.snippet.find((s) => s.match)?.text).toBe("maxAllowedContentLength");
  });

  it("builds a snippet around the first match", () => {
    const text = `${"lorem ipsum ".repeat(40)}needle ${"dolor sit ".repeat(40)}`;
    const snippet = makeSnippet(text, new Set(["needle"]))!;
    const joined = snippet.map((s) => s.text).join("");
    expect(joined.startsWith("…")).toBe(true);
    expect(joined.endsWith("…")).toBe(true);
    expect(joined.length).toBeLessThanOrEqual(230);
    expect(snippet.some((s) => s.match && s.text === "needle")).toBe(true);
  });

  it("strips Markdown syntax for snippets", () => {
    expect(markdownToText("## Fix\n\n- Use **`COLLATE`** [docs](https://x.y)\n")).toBe(
      "Fix Use COLLATE docs",
    );
  });
});

describe("URL parameters", () => {
  it("parses valid values and drops invalid ones", () => {
    expect(
      parseSearchParams({ q: " iis ", category: "nope", tags: "IIS, App Pool,,iis", sort: "old" }),
    ).toEqual({ q: "iis", category: null, tags: ["iis", "app-pool"], sort: null });
  });

  it("round-trips through a query string", () => {
    const p = params({ q: "app pool", category: "iis-hosting", tags: ["iis"], sort: "newest" });
    const qs = toQueryString(p);
    expect(qs).toBe("?q=app+pool&category=iis-hosting&tags=iis&sort=newest");
    expect(parseSearchParams(Object.fromEntries(new URLSearchParams(qs)))).toEqual(p);
  });
});

describe("result details", () => {
  const index = new KnowledgeSearchIndex(seed);

  it("reports tags that matched", () => {
    const [hit] = index.search(params({ q: "powershell" })).hits;
    expect(hit!.matchedTags).toEqual(["powershell"]);
  });

  it("doesn't fuzzy-match short words", () => {
    const words = index
      .search(params({ q: "lock" }))
      .hits.flatMap((h) => [...h.title, ...h.snippet])
      .filter((s) => s.match)
      .map((s) => s.text.toLowerCase());
    expect(words.length).toBeGreaterThan(0);
    expect(words.every((w) => w.startsWith("lock"))).toBe(true);
  });
});
