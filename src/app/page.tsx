import { connection } from "next/server";
import { EntryCard } from "@/components/entry-card";
import { getKnowledgeRepository } from "@/lib/knowledge";

// Phase 1: lists entries straight from the repository. Phase 3 replaces this with search.
export default async function HomePage() {
  await connection();
  const entries = await getKnowledgeRepository().list();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Knowledge base</h1>
        <p className="mt-1 text-muted-foreground">{entries.length} entries shared by colleagues.</p>
      </div>
      <div className="grid gap-4">
        {entries.map((entry) => (
          <EntryCard key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}
