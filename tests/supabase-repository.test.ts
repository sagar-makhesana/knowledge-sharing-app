import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { KnowledgeInput } from "@/lib/knowledge/schema";
import {
  KNOWLEDGE_TABLE,
  SupabaseRepository,
  inputToRow,
  rowToEntry,
  type KnowledgeDatabase,
  type KnowledgeRow,
} from "@/lib/knowledge/supabase-repository";
import { createFakePostgrest } from "./fake-postgrest";

const SECRET_KEY = "sb_secret_test_key";

const input: KnowledgeInput = {
  title: "FSC advertises an unreachable host name",
  summary: "Clients resolve the FSC address themselves, so it must be a name they can reach.",
  content: "## Fix\n\nUse the fully qualified host name in fmsmaster.",
  category: "teamcenter",
  tags: ["fms", "fsc"],
  environment: "Teamcenter 2312",
  author: null,
};

function row(overrides: Partial<KnowledgeRow> = {}): KnowledgeRow {
  return {
    id: crypto.randomUUID(),
    ...inputToRow(input),
    created_at: "2026-05-22T10:00:00.123456+00:00",
    updated_at: "2026-05-22T10:00:00.123456+00:00",
    ...overrides,
  };
}

function setup(initial: KnowledgeRow[] = []) {
  const fake = createFakePostgrest(KNOWLEDGE_TABLE, initial);
  const client = createClient<KnowledgeDatabase>("https://example.supabase.co", SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fake.fetch },
  });
  return { fake, repo: new SupabaseRepository(client) };
}

describe("row mapping", () => {
  it("converts Postgres timestamps to ISO strings in UTC", () => {
    const entry = rowToEntry(row());
    expect(entry.createdAt).toBe("2026-05-22T10:00:00.123Z");
    expect(entry.updatedAt).toBe("2026-05-22T10:00:00.123Z");
  });

  it("normalises input the same way as the JSON repository", () => {
    expect(
      inputToRow({ ...input, tags: ["App Pool", "app-pool"], environment: " " } as KnowledgeInput),
    ).toMatchObject({ tags: ["app-pool"], environment: null });
  });
});

describe("SupabaseRepository", () => {
  it("lists newest first, authenticating with the secret key", async () => {
    const older = row({ created_at: "2026-01-01T00:00:00+00:00" });
    const newer = row({ created_at: "2026-02-01T00:00:00+00:00" });
    const { fake, repo } = setup([older, newer]);

    const entries = await repo.list();

    expect(entries.map((e) => e.id)).toEqual([newer.id, older.id]);
    const [request] = fake.requests;
    expect(request?.method).toBe("GET");
    expect(request?.path).toBe("/rest/v1/knowledge_entries");
    expect(request?.params.get("order")).toBe("created_at.desc");
    expect(request?.headers.get("apikey")).toBe(SECRET_KEY);
  });

  it("gets an entry by id, and returns null for unknown or malformed ids", async () => {
    const existing = row();
    const { fake, repo } = setup([existing]);

    expect((await repo.getById(existing.id))?.title).toBe(input.title);
    expect(await repo.getById(crypto.randomUUID())).toBeNull();

    const requestsBefore = fake.requests.length;
    expect(await repo.getById("not-a-uuid")).toBeNull();
    expect(fake.requests).toHaveLength(requestsBefore); // never reaches the database
  });

  it("creates an entry and returns the stored row", async () => {
    const { fake, repo } = setup();

    const created = await repo.create({ ...input, tags: ["FMS", "fsc"] });

    expect(created).toMatchObject({ title: input.title, tags: ["fms", "fsc"], author: null });
    expect(created.createdAt).toMatch(/Z$/);
    expect(fake.rows.get(created.id)?.tags).toEqual(["fms", "fsc"]);
    expect(fake.requests.at(-1)?.method).toBe("POST");
  });

  it("updates fields and updated_at, keeping created_at", async () => {
    const existing = row();
    const { fake, repo } = setup([existing]);

    const updated = await repo.update(existing.id, { ...input, title: "Updated FSC title" });

    expect(updated?.title).toBe("Updated FSC title");
    expect(updated?.createdAt).toBe("2026-05-22T10:00:00.123Z");
    expect(updated!.updatedAt > updated!.createdAt).toBe(true);
    expect(fake.requests.at(-1)?.params.get("id")).toBe(`eq.${existing.id}`);
  });

  it("returns null when updating an unknown id", async () => {
    const { repo } = setup();
    expect(await repo.update(crypto.randomUUID(), input)).toBeNull();
    expect(await repo.update("not-a-uuid", input)).toBeNull();
  });

  it("rejects invalid input before calling the database", async () => {
    const { fake, repo } = setup();
    await expect(repo.create({ ...input, title: "" })).rejects.toThrow();
    expect(fake.requests).toHaveLength(0);
  });

  it("surfaces database errors with context", async () => {
    const { fake, repo } = setup();
    fake.failNextRequest(500, "connection refused");
    await expect(repo.list()).rejects.toThrow(
      "Supabase: failed to list entries: connection refused",
    );
  });
});

describe("content with escaped line breaks", () => {
  it("is repaired when read, while real content is left untouched", async () => {
    const markdown = "## Symptom\n\nApp pool recycles.\n\n## Fix\n\nSchedule it at 03:00.";
    const broken = row({ content: markdown.replaceAll("\n", "\\n") });
    const fine = row({ content: 'Keep `"\\n"` as written.\nSecond line.' });
    const { repo } = setup([broken, fine]);

    expect((await repo.getById(broken.id))?.content).toBe(markdown);
    expect((await repo.getById(fine.id))?.content).toBe(fine.content);
  });

  it("falls back to fixing only line breaks when the text isn't valid JSON", async () => {
    const broken = row({ content: 'Say "hi"\\n\\nthen\\tleave' });
    const { repo } = setup([broken]);
    expect((await repo.getById(broken.id))?.content).toBe('Say "hi"\n\nthen\tleave');
  });
});
