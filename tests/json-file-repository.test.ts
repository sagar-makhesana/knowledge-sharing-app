import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { JsonFileRepository } from "@/lib/knowledge/json-file-repository";
import { KnowledgeInputSchema, type KnowledgeInput } from "@/lib/knowledge/schema";

const SEED_PATH = path.join(process.cwd(), "data", "seed.json");

function makeInput(overrides: Partial<KnowledgeInput> = {}): KnowledgeInput {
  return {
    title: "App pool recycles during office hours",
    summary: "The default 29 hour recycle interval moves through the day and drops sessions.",
    content: "## Fix\n\nSchedule the recycle at 03:00 and disable the periodic interval.",
    category: "iis-hosting",
    tags: ["iis", "app-pool"],
    environment: "IIS 10",
    author: "Test Author",
    ...overrides,
  };
}

let dir: string;
let filePath: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "knowledge-repo-"));
  filePath = path.join(dir, "knowledge.json");
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("JsonFileRepository", () => {
  it("creates the data file from the seed when it doesn't exist", async () => {
    const repo = new JsonFileRepository({ filePath, seedPath: SEED_PATH });
    const seed = JSON.parse(await readFile(SEED_PATH, "utf8"));

    const entries = await repo.list();

    expect(entries).toHaveLength(seed.entries.length);
    expect(JSON.parse(await readFile(filePath, "utf8"))).toEqual(seed);
  });

  it("starts empty without a seed", async () => {
    const repo = new JsonFileRepository({ filePath });
    expect(await repo.list()).toEqual([]);
  });

  it("creates an entry with a UUID and ISO timestamps, and persists it", async () => {
    const repo = new JsonFileRepository({ filePath });

    const created = await repo.create(makeInput());

    expect(created.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(created.createdAt).toISOString()).toBe(created.createdAt);
    expect(created.updatedAt).toBe(created.createdAt);

    // A fresh instance reads the same data back from disk.
    const reopened = new JsonFileRepository({ filePath });
    expect(await reopened.getById(created.id)).toEqual(created);
  });

  it("normalises input on create", async () => {
    const repo = new JsonFileRepository({ filePath });

    const created = await repo.create({
      ...makeInput(),
      tags: ["App Pool", "app-pool", " IIS "],
      environment: "  ",
      author: "",
    } as KnowledgeInput);

    expect(created.tags).toEqual(["app-pool", "iis"]);
    expect(created.environment).toBeNull();
    expect(created.author).toBeNull();
  });

  it("rejects invalid input", async () => {
    const repo = new JsonFileRepository({ filePath });
    await expect(repo.create(makeInput({ title: "" }))).rejects.toThrow();
    await expect(repo.list()).resolves.toEqual([]);
  });

  it("updates fields and updatedAt but keeps id and createdAt", async () => {
    const repo = new JsonFileRepository({ filePath });
    const created = await repo.create(makeInput());
    await new Promise((resolve) => setTimeout(resolve, 5));

    const updated = await repo.update(created.id, makeInput({ title: "Updated title here" }));

    expect(updated).not.toBeNull();
    expect(updated!.id).toBe(created.id);
    expect(updated!.createdAt).toBe(created.createdAt);
    expect(updated!.title).toBe("Updated title here");
    expect(updated!.updatedAt > created.updatedAt).toBe(true);
    expect(await repo.getById(created.id)).toEqual(updated);
  });

  it("returns null when updating or getting an unknown id", async () => {
    const repo = new JsonFileRepository({ filePath });
    const unknown = "00000000-0000-4000-8000-000000000000";
    expect(await repo.getById(unknown)).toBeNull();
    expect(await repo.update(unknown, makeInput())).toBeNull();
  });

  it("lists entries newest first", async () => {
    const repo = new JsonFileRepository({ filePath });
    const first = await repo.create(makeInput({ title: "First entry" }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await repo.create(makeInput({ title: "Second entry" }));

    expect((await repo.list()).map((e) => e.id)).toEqual([second.id, first.id]);
  });

  it("doesn't lose writes when many creates run concurrently", async () => {
    const repo = new JsonFileRepository({ filePath });

    await Promise.all(
      Array.from({ length: 20 }, (_, i) => repo.create(makeInput({ title: `Concurrent ${i}` }))),
    );

    expect(await repo.list()).toHaveLength(20);
  });

  it("leaves no temp files behind", async () => {
    const repo = new JsonFileRepository({ filePath });
    await repo.create(makeInput());
    expect(await readdir(dir)).toEqual(["knowledge.json"]);
  });

  it("reports a corrupt data file clearly instead of overwriting it", async () => {
    await writeFile(filePath, "{ not json", "utf8");
    const repo = new JsonFileRepository({ filePath, seedPath: SEED_PATH });

    await expect(repo.list()).rejects.toThrow(/not valid JSON/);
    await expect(repo.create(makeInput())).rejects.toThrow(/not valid JSON/);
    expect(await readFile(filePath, "utf8")).toBe("{ not json");
  });
});

describe("seed data", () => {
  it("has 15-20 entries that all pass the input rules", async () => {
    const seed = JSON.parse(await readFile(SEED_PATH, "utf8"));
    expect(seed.entries.length).toBeGreaterThanOrEqual(15);
    expect(seed.entries.length).toBeLessThanOrEqual(20);
    for (const entry of seed.entries) {
      const result = KnowledgeInputSchema.safeParse(entry);
      expect(result.success, `${entry.title}: ${result.error?.message}`).toBe(true);
      // Stored tags are already normalised.
      expect(result.data?.tags).toEqual(entry.tags);
    }
  });
});

describe("escaped line breaks", () => {
  it("restores content whose line breaks were stored as \\n", async () => {
    const markdown = '## Fix\n\n```powershell\n$pool = "IIS:\\AppPools\\X"\n```\n\n- done';
    const escaped = JSON.stringify(markdown).slice(1, -1); // what a paste from the JSON file stores
    expect(escaped.includes("\n")).toBe(false);

    const repo = new JsonFileRepository({ filePath });
    const created = await repo.create(makeInput());
    const data = JSON.parse(await readFile(filePath, "utf8"));
    data.entries[0].content = escaped;
    await writeFile(filePath, JSON.stringify(data), "utf8");

    expect((await repo.getById(created.id))?.content).toBe(markdown);
  });
});
