import { CalendarDays, UserRound } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { categoryLabel, type KnowledgeEntry } from "@/lib/knowledge/schema";
import { formatDate } from "@/lib/format";

export function EntryCard({ entry }: { entry: KnowledgeEntry }) {
  return (
    <article className="group relative rounded-xl border bg-card p-5 shadow-xs transition-colors hover:border-primary/40">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{categoryLabel(entry.category)}</Badge>
      </div>
      <h2 className="text-lg leading-snug font-semibold tracking-tight">
        {/* The ::after overlay makes the whole card clickable while keeping one link for screen readers. */}
        <Link
          href={`/entries/${entry.id}`}
          className="rounded-sm outline-none group-hover:text-primary after:absolute after:inset-0 after:rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {entry.title}
        </Link>
      </h2>
      <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{entry.summary}</p>
      {entry.tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Tags">
          {entry.tags.map((tag) => (
            <li key={tag}>
              <Badge variant="outline" className="font-normal">
                #{tag}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <UserRound className="size-3.5" aria-hidden />
          {entry.author ?? "Anonymous"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-3.5" aria-hidden />
          <time dateTime={entry.createdAt}>{formatDate(entry.createdAt)}</time>
        </span>
      </div>
    </article>
  );
}
