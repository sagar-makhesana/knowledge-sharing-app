import { createClient } from "@supabase/supabase-js";
import { afterAll, describe, expect, it } from "vitest";
import {
  KNOWLEDGE_TABLE,
  SupabaseRepository,
  type KnowledgeDatabase,
} from "@/lib/knowledge/supabase-repository";

// Talks to the real database. Creates one entry and deletes it again at the end.
const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: secretKey } = process.env;
if (!url || !secretKey) {
  throw new Error("pnpm test:supabase needs SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local");
}

const client = createClient<KnowledgeDatabase>(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const repo = new SupabaseRepository(client);
const createdIds: string[] = [];

afterAll(async () => {
  if (createdIds.length) await client.from(KNOWLEDGE_TABLE).delete().in("id", createdIds);
});

describe("SupabaseRepository against the live database", () => {
  it("creates, reads, lists and updates an entry", async () => {
    const created = await repo.create({
      title: "[live test] temporary entry",
      summary: "Created by pnpm test:supabase and deleted again when the test finishes.",
      content: "## Test\n\nIf you can read this, the live test did not clean up.",
      category: "other",
      tags: ["live-test"],
      environment: null,
      author: "Test runner",
    });
    createdIds.push(created.id);

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(created.createdAt).toMatch(/Z$/);
    expect(await repo.getById(created.id)).toEqual(created);
    expect((await repo.list()).some((e) => e.id === created.id)).toBe(true);

    const updated = await repo.update(created.id, {
      ...created,
      title: "[live test] updated entry",
    });
    expect(updated?.title).toBe("[live test] updated entry");
    expect(updated?.createdAt).toBe(created.createdAt);
    expect(await repo.getById(crypto.randomUUID())).toBeNull();
  });
});
