import { describe, expect, it } from "vitest";
import type { KnowledgeEntry } from "@/lib/knowledge/schema";
import { collectTags } from "@/lib/knowledge/tags";

const entry = (tags: string[]) => ({ tags }) as KnowledgeEntry;

describe("collectTags", () => {
  it("orders tags by usage, then alphabetically", () => {
    expect(
      collectTags([entry(["iis", "sql"]), entry(["sql", "aml"]), entry(["sql", "iis"])]),
    ).toEqual(["sql", "iis", "aml"]);
  });
});
