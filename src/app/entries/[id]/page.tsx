import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { Markdown } from "@/components/markdown";
import { Badge } from "@/components/ui/badge";
import { getKnowledgeRepository } from "@/lib/knowledge";
import { categoryLabel } from "@/lib/knowledge/schema";
import { formatDate } from "@/lib/format";

// Shared by generateMetadata and the page so the entry is read once per request.
const getEntry = cache((id: string) => getKnowledgeRepository().getById(id));

export async function generateMetadata({ params }: PageProps<"/entries/[id]">): Promise<Metadata> {
  const entry = await getEntry((await params).id);
  return entry ? { title: entry.title, description: entry.summary } : {};
}

// Phase 2: a basic detail view so the submit flow has somewhere to land. Phase 4 adds the
// metadata sidebar, copy link and edit.
export default async function EntryPage({ params }: PageProps<"/entries/[id]">) {
  const entry = await getEntry((await params).id);
  if (!entry) notFound();

  return (
    <article className="mx-auto max-w-3xl">
      <header className="mb-8 space-y-3">
        <Badge variant="secondary">{categoryLabel(entry.category)}</Badge>
        <h1 className="text-3xl font-semibold tracking-tight">{entry.title}</h1>
        <p className="text-lg text-muted-foreground">{entry.summary}</p>
        <p className="text-sm text-muted-foreground">
          {entry.author ?? "Anonymous"} · {formatDate(entry.createdAt)}
        </p>
      </header>
      <Markdown>{entry.content}</Markdown>
    </article>
  );
}
