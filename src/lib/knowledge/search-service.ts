import "server-only";
import { getKnowledgeRepository } from ".";
import { KnowledgeSearchIndex, type SearchOutcome } from "./search";
import type { SearchParams } from "./search-params";

// The index is cached per server instance and rebuilt whenever the stored data differs from what
// it was built from. That keeps results current after edits made through any instance (e.g. on
// Vercel, where each serverless instance has its own memory) or directly in the database.
const cache = globalThis as typeof globalThis & {
  knowledgeSearchIndex?: { fingerprint: string; index: KnowledgeSearchIndex };
};

export async function searchKnowledge(params: SearchParams): Promise<SearchOutcome> {
  const entries = await getKnowledgeRepository().list();
  const fingerprint = entries.map((e) => `${e.id}@${e.updatedAt}`).join("|");
  if (cache.knowledgeSearchIndex?.fingerprint !== fingerprint) {
    cache.knowledgeSearchIndex = { fingerprint, index: new KnowledgeSearchIndex(entries) };
  }
  return cache.knowledgeSearchIndex.index.search(params);
}
