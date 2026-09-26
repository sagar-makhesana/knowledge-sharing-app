import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// revalidatePath needs a Next.js request context; the actions' logic doesn't.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "knowledge-actions-"));
  process.env.KNOWLEDGE_STORAGE = "json";
  process.env.KNOWLEDGE_DATA_FILE = path.join(dir, "knowledge.json");
});

afterAll(async () => {
  delete process.env.KNOWLEDGE_STORAGE;
  delete process.env.KNOWLEDGE_DATA_FILE;
  await rm(dir, { recursive: true, force: true });
});

const valid = {
  title: "Collation conflict after restore",
  summary: "Temp tables use the server collation, which differed from the restored database.",
  content: "## Fix\n\nUse `COLLATE DATABASE_DEFAULT` on temp table columns.",
  category: "sql-server",
  tags: ["SQL Server", "collation"],
  environment: "",
  author: "  Priya  ",
};

describe("server actions", () => {
  it("rejects invalid input with a message per field", async () => {
    const { createEntry } = await import("@/lib/knowledge/actions");

    const result = await createEntry({ ...valid, title: "", category: "nope", tags: ["bad tag!"] });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(Object.keys(result.fieldErrors ?? {}).sort()).toEqual(["category", "tags", "title"]);
  });

  it("creates and then updates an entry", async () => {
    const { createEntry, updateEntry } = await import("@/lib/knowledge/actions");
    const { getKnowledgeRepository } = await import("@/lib/knowledge");

    const created = await createEntry(valid);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const stored = await getKnowledgeRepository().getById(created.id);
    expect(stored).toMatchObject({
      tags: ["sql-server", "collation"],
      environment: null,
      author: "Priya",
    });

    const updated = await updateEntry(created.id, { ...valid, title: "Collation conflict fixed" });
    expect(updated).toEqual({ ok: true, id: created.id });
    expect((await getKnowledgeRepository().getById(created.id))?.title).toBe(
      "Collation conflict fixed",
    );
  });

  it("reports unknown and malformed ids on update", async () => {
    const { updateEntry } = await import("@/lib/knowledge/actions");
    expect((await updateEntry("not-a-uuid", valid)).ok).toBe(false);
    expect((await updateEntry("00000000-0000-4000-8000-000000000000", valid)).ok).toBe(false);
  });
});
