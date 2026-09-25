import type { Metadata } from "next";
import { connection } from "next/server";
import { KnowledgeForm } from "@/components/knowledge-form";
import { getKnowledgeRepository } from "@/lib/knowledge";
import { collectTags } from "@/lib/knowledge/tags";

export const metadata: Metadata = { title: "Submit knowledge" };

export default async function SubmitPage() {
  await connection();
  const tags = collectTags(await getKnowledgeRepository().list());

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Submit knowledge</h1>
        <p className="mt-1 text-muted-foreground">
          Solved something tricky? Write it down so the next colleague finds it in seconds.
        </p>
      </div>
      <KnowledgeForm mode="create" tagSuggestions={tags} />
    </div>
  );
}
