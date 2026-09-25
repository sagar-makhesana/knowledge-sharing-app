import type { KnowledgeEntry, KnowledgeInput } from "./schema";

/**
 * Storage boundary for knowledge entries. The UI, server actions and search talk only to this
 * interface, so replacing JSON storage with a database means writing one new implementation
 * and changing the wiring in `./index.ts`.
 *
 * Implementations own `id`, `createdAt` and `updatedAt`: ids are UUIDs and timestamps are
 * ISO 8601 strings in UTC.
 */
export interface KnowledgeRepository {
  /** All entries, newest first. */
  list(): Promise<KnowledgeEntry[]>;

  /** The entry with this id, or `null` if there is none. */
  getById(id: string): Promise<KnowledgeEntry | null>;

  /** Stores a new entry and returns it with its generated id and timestamps. */
  create(input: KnowledgeInput): Promise<KnowledgeEntry>;

  /** Replaces the editable fields of an entry. Returns `null` if the id doesn't exist. */
  update(id: string, input: KnowledgeInput): Promise<KnowledgeEntry | null>;
}
