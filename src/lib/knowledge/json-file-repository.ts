import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { KnowledgeRepository } from "./repository";
import {
  KnowledgeEntrySchema,
  KnowledgeInputSchema,
  type KnowledgeEntry,
  type KnowledgeInput,
} from "./schema";

/** On-disk format. The version lets a later migration recognise what it's reading. */
const KnowledgeFileSchema = z.object({
  version: z.literal(1),
  entries: z.array(KnowledgeEntrySchema),
});

type KnowledgeFile = z.infer<typeof KnowledgeFileSchema>;

export interface JsonFileRepositoryOptions {
  /** The data file, e.g. `data/knowledge.json`. */
  filePath: string;
  /** Copied to `filePath` when the data file doesn't exist yet. Without it, starts empty. */
  seedPath?: string;
}

// Windows can briefly lock a file (antivirus, indexer, an open editor), making rename fail.
const RETRYABLE_RENAME_CODES = new Set(["EPERM", "EACCES", "EBUSY"]);
const RENAME_ATTEMPTS = 5;

export class JsonFileRepository implements KnowledgeRepository {
  private readonly filePath: string;
  private readonly seedPath: string | undefined;
  /** Serialises every write so concurrent requests can't overwrite each other's changes. */
  private queue: Promise<unknown> = Promise.resolve();

  constructor(options: JsonFileRepositoryOptions) {
    this.filePath = path.resolve(options.filePath);
    this.seedPath = options.seedPath && path.resolve(options.seedPath);
  }

  async list(): Promise<KnowledgeEntry[]> {
    const { entries } = await this.read();
    return entries.toSorted((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getById(id: string): Promise<KnowledgeEntry | null> {
    const { entries } = await this.read();
    return entries.find((e) => e.id === id) ?? null;
  }

  async create(input: KnowledgeInput): Promise<KnowledgeEntry> {
    const fields = KnowledgeInputSchema.parse(input);
    return this.mutate((data) => {
      const now = new Date().toISOString();
      const entry: KnowledgeEntry = {
        id: randomUUID(),
        ...fields,
        createdAt: now,
        updatedAt: now,
      };
      data.entries.push(entry);
      return entry;
    });
  }

  async update(id: string, input: KnowledgeInput): Promise<KnowledgeEntry | null> {
    const fields = KnowledgeInputSchema.parse(input);
    return this.mutate((data) => {
      const index = data.entries.findIndex((e) => e.id === id);
      const existing = data.entries[index];
      if (!existing) return null;
      const entry: KnowledgeEntry = {
        ...existing,
        ...fields,
        updatedAt: new Date().toISOString(),
      };
      data.entries[index] = entry;
      return entry;
    });
  }

  /**
   * Reads, changes and writes the file inside the write queue. `change` returns `null` to
   * signal "nothing to write".
   */
  private mutate<T>(change: (data: KnowledgeFile) => T): Promise<T> {
    return this.enqueue(async () => {
      const data = await this.readOrInitialize();
      const result = change(data);
      if (result !== null) await this.writeAtomically(data);
      return result;
    });
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task, task);
    // Keep the queue alive after a failed task; the caller still sees the rejection.
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async read(): Promise<KnowledgeFile> {
    try {
      return await this.readFile();
    } catch (error) {
      if (!isNotFound(error)) throw error;
      // Initialise inside the queue so it can't race with (and overwrite) a concurrent write.
      return this.enqueue(() => this.readOrInitialize());
    }
  }

  /** Only call from inside the write queue. Creates the file from the seed if it's missing. */
  private async readOrInitialize(): Promise<KnowledgeFile> {
    try {
      return await this.readFile();
    } catch (error) {
      if (!isNotFound(error)) throw error;
      const initial = await this.loadSeed();
      await this.writeAtomically(initial);
      return initial;
    }
  }

  private async readFile(): Promise<KnowledgeFile> {
    return parseKnowledgeFile(await readFile(this.filePath, "utf8"), this.filePath);
  }

  private async loadSeed(): Promise<KnowledgeFile> {
    if (!this.seedPath) return { version: 1, entries: [] };
    return parseKnowledgeFile(await readFile(this.seedPath, "utf8"), this.seedPath);
  }

  /** Writes to a temp file in the same directory, then renames it over the real file. */
  private async writeAtomically(data: KnowledgeFile): Promise<void> {
    const dir = path.dirname(this.filePath);
    await mkdir(dir, { recursive: true });
    const tempPath = path.join(dir, `.${path.basename(this.filePath)}.${randomUUID()}.tmp`);
    await writeFile(tempPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
    try {
      await renameWithRetry(tempPath, this.filePath);
    } catch (error) {
      await unlink(tempPath).catch(() => undefined);
      throw error;
    }
  }
}

function parseKnowledgeFile(text: string, filePath: string): KnowledgeFile {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new Error(`Knowledge data file ${filePath} is not valid JSON`, {
      cause: error,
    });
  }
  const result = KnowledgeFileSchema.safeParse(json);
  if (!result.success) {
    throw new Error(
      `Knowledge data file ${filePath} has an unexpected shape:\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}

async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await rename(from, to);
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (attempt >= RENAME_ATTEMPTS || !code || !RETRYABLE_RENAME_CODES.has(code)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** attempt));
    }
  }
}

function isNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === "ENOENT";
}
