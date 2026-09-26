import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { KnowledgeRepository } from "./repository";
import {
  KnowledgeEntrySchema,
  KnowledgeInputSchema,
  type CategoryId,
  type KnowledgeEntry,
  type KnowledgeInput,
} from "./schema";

export const KNOWLEDGE_TABLE = "knowledge_entries";

/** A row of `public.knowledge_entries`, as defined in supabase/migrations. */
export type KnowledgeRow = {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: CategoryId;
  tags: string[];
  environment: string | null;
  author: string | null;
  created_at: string;
  updated_at: string;
};

type Editable = Omit<KnowledgeRow, "id" | "created_at" | "updated_at">;

/** Hand-written schema type for the one table this app uses; gives typed queries. */
export type KnowledgeDatabase = {
  public: {
    Tables: {
      knowledge_entries: {
        Row: KnowledgeRow;
        Insert: Editable & Partial<Pick<KnowledgeRow, "id" | "created_at" | "updated_at">>;
        Update: Partial<KnowledgeRow>;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
  };
};

export type KnowledgeSupabaseClient = SupabaseClient<KnowledgeDatabase>;

/** Postgres returns `+00:00` offsets and microseconds; the app uses `…Z` ISO strings. */
function toIso(timestamp: string): string {
  return new Date(timestamp).toISOString();
}

export function rowToEntry(row: KnowledgeRow): KnowledgeEntry {
  return KnowledgeEntrySchema.parse({
    id: row.id,
    title: row.title,
    summary: row.summary,
    content: row.content,
    category: row.category,
    tags: row.tags ?? [],
    environment: row.environment,
    author: row.author,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  });
}

export function inputToRow(input: KnowledgeInput): Editable {
  const fields = KnowledgeInputSchema.parse(input);
  return {
    title: fields.title,
    summary: fields.summary,
    content: fields.content,
    category: fields.category,
    tags: fields.tags,
    environment: fields.environment,
    author: fields.author,
  };
}

const isUuid = (id: string) => z.uuid().safeParse(id).success;

/**
 * Stores entries in the Supabase (Postgres) table `knowledge_entries`. Meant for server-side use
 * with the project's secret key; see supabase/migrations for the table definition.
 */
export class SupabaseRepository implements KnowledgeRepository {
  constructor(private readonly client: KnowledgeSupabaseClient) {}

  async list(): Promise<KnowledgeEntry[]> {
    const { data, error } = await this.client
      .from(KNOWLEDGE_TABLE)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw storageError("list entries", error);
    return data.map(rowToEntry);
  }

  async getById(id: string): Promise<KnowledgeEntry | null> {
    // Postgres rejects malformed UUIDs with an error; for the app that's simply "not found".
    if (!isUuid(id)) return null;
    const { data, error } = await this.client
      .from(KNOWLEDGE_TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) throw storageError("load entry", error);
    return data ? rowToEntry(data) : null;
  }

  async create(input: KnowledgeInput): Promise<KnowledgeEntry> {
    const { data, error } = await this.client
      .from(KNOWLEDGE_TABLE)
      .insert(inputToRow(input))
      .select("*")
      .single();
    if (error) throw storageError("create entry", error);
    return rowToEntry(data);
  }

  async update(id: string, input: KnowledgeInput): Promise<KnowledgeEntry | null> {
    if (!isUuid(id)) return null;
    const { data, error } = await this.client
      .from(KNOWLEDGE_TABLE)
      .update({ ...inputToRow(input), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error) throw storageError("update entry", error);
    return data ? rowToEntry(data) : null;
  }
}

function storageError(action: string, error: { message: string; code?: string }): Error {
  return new Error(`Supabase: failed to ${action}: ${error.message}`, { cause: error });
}
