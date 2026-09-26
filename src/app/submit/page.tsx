import type { Metadata } from "next";
import { connection } from "next/server";
import { KnowledgeForm } from "@/components/knowledge-form";
import { getKnowledgeRepository } from "@/lib/knowledge";
import { LIMITS } from "@/lib/knowledge/schema";
import { collectTags } from "@/lib/knowledge/tags";

export const metadata: Metadata = { title: "Submit knowledge" };

export default async function SubmitPage({ searchParams }: PageProps<"/submit">) {
  await connection();
  // "Submit this knowledge" on an empty search links here with the query as the title.
  const title = (await searchParams).title;
  const initialTitle = typeof title === "string" ? title.trim().slice(0, LIMITS.title) : undefined;
  const tags = collectTags(await getKnowledgeRepository().list());

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Submit knowledge</h1>
        <p className="mt-1 text-muted-foreground">
          Solved something tricky? Write it down so the next colleague finds it in seconds.
        </p>
      </div>
      <KnowledgeForm mode="create" initialTitle={initialTitle} tagSuggestions={tags} />
    </div>
  );
}
