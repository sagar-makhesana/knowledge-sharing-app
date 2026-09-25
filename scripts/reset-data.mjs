// Replaces the working data file with the committed seed data: `pnpm data:reset`.
// Honours KNOWLEDGE_DATA_FILE, like the app does.
import { randomUUID } from "node:crypto";
import { copyFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const seedPath = path.join(root, "data", "seed.json");
const target = path.resolve(
  process.env.KNOWLEDGE_DATA_FILE ?? path.join(root, "data", "knowledge.json"),
);
const tempPath = path.join(path.dirname(target), `.${path.basename(target)}.${randomUUID()}.tmp`);

await mkdir(path.dirname(target), { recursive: true });
await copyFile(seedPath, tempPath);
await rename(tempPath, target);

console.log(`Reset ${path.relative(root, target)} from data/seed.json.`);
console.log("If the dev server is running, restart it so search picks up the change.");
