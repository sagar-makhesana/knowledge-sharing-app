import "server-only";
import path from "node:path";
import { JsonFileRepository } from "./json-file-repository";
import type { KnowledgeRepository } from "./repository";

/**
 * The single place that decides which storage backs the app. To move to a database,
 * implement `KnowledgeRepository` and return it here instead.
 */
function createRepository(): KnowledgeRepository {
  return new JsonFileRepository({
    filePath: process.env.KNOWLEDGE_DATA_FILE ?? path.join(process.cwd(), "data", "knowledge.json"),
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
