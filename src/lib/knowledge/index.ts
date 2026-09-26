import "server-only";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { JsonFileRepository } from "./json-file-repository";
import type { KnowledgeRepository } from "./repository";
import { SupabaseRepository, type KnowledgeDatabase } from "./supabase-repository";

export type StorageKind = "supabase" | "json";

/**
 * Picks the storage backend from the environment:
 * - `KNOWLEDGE_STORAGE=supabase` or `json` chooses explicitly.
 * - Unset: Supabase when `SUPABASE_URL` and `SUPABASE_SECRET_KEY` are set, otherwise the
 *   local JSON file (handy for offline demos).
 */
export function resolveStorageKind(
  env: Record<string, string | undefined> = process.env,
): StorageKind {
  const explicit = env.KNOWLEDGE_STORAGE?.trim().toLowerCase();
  if (explicit === "supabase" || explicit === "json") return explicit;
  if (explicit)
    throw new Error(`KNOWLEDGE_STORAGE must be "supabase" or "json", got "${explicit}"`);
  return env.SUPABASE_URL || env.SUPABASE_SECRET_KEY ? "supabase" : "json";
}

/**
 * The single place that decides which storage backs the app. Everything else only sees the
 * `KnowledgeRepository` interface.
 */
function createRepository(): KnowledgeRepository {
  if (resolveStorageKind() === "supabase") {
    const url = process.env.SUPABASE_URL;
    const secretKey = process.env.SUPABASE_SECRET_KEY;
    if (!url || !secretKey) {
      throw new Error(
        "Supabase storage needs SUPABASE_URL and SUPABASE_SECRET_KEY. Set both in .env.local " +
          "(see .env.example), or set KNOWLEDGE_STORAGE=json to use the local JSON file.",
      );
    }
    const client = createClient<KnowledgeDatabase>(url, secretKey, {
      // Server-side only: no user sessions to persist or refresh.
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    console.info(`[knowledge] storage: Supabase (${new URL(url).host})`);
    return new SupabaseRepository(client);
  }

  const filePath =
    process.env.KNOWLEDGE_DATA_FILE ?? path.join(process.cwd(), "data", "knowledge.json");
  console.info(`[knowledge] storage: JSON file (${path.relative(process.cwd(), filePath)})`);
  return new JsonFileRepository({
    filePath,
    seedPath: path.join(process.cwd(), "data", "seed.json"),
  });
}

// Kept on globalThis so dev hot-reloads reuse one instance (and its write queue).
const globalForRepository = globalThis as typeof globalThis & {
  knowledgeRepository?: KnowledgeRepository;
};

export function getKnowledgeRepository(): KnowledgeRepository {
  globalForRepository.knowledgeRepository ??= createRepository();
  return globalForRepository.knowledgeRepository;
}

export type { KnowledgeRepository } from "./repository";
