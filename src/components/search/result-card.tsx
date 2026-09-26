import { CalendarDays, Layers, UserRound } from "lucide-react";
import Link from "next/link";
import { HighlightedText } from "@/components/search/highlighted-text";
import { SearchLink } from "@/components/search/search-state";
import { Badge } from "@/components/ui/badge";
import type { SearchHit } from "@/lib/knowledge/search";
import type { SearchParams } from "@/lib/knowledge/search-params";
import { categoryLabel } from "@/lib/knowledge/schema";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export function ResultCard({ hit, params }: { hit: SearchHit; params: SearchParams }) {
  const { entry } = hit;
  return (
    <article className="group relative rounded-xl border bg-card p-5 shadow-xs transition-colors hover:border-primary/40">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{categoryLabel(entry.category)}</Badge>
        {entry.environment && (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Layers className="size-3.5" aria-hidden />
            {entry.environment}
          </span>
        )}
      </div>
      <h3 className="text-lg leading-snug font-semibold tracking-tight">
        {/* The ::after overlay makes the whole card clickable; tag links sit above it. */}
        <Link
          href={`/entries/${entry.id}`}
          className="rounded-sm outline-none group-hover:text-primary after:absolute after:inset-0 after:rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <HighlightedText segments={hit.title} />
        </Link>
      </h3>
      <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
        <HighlightedText segments={hit.snippet} />
      </p>
      {entry.tags.length > 0 && (
        <ul className="relative z-10 mt-3 flex flex-wrap gap-1.5" aria-label="Tags">
          {entry.tags.map((tag) => {
            const active = params.tags.includes(tag);
            return (
              <li key={tag}>
                <SearchLink
                  to={{
                    ...params,
                    tags: active ? params.tags.filter((t) => t !== tag) : [...params.tags, tag],
                  }}
                  aria-label={`${active ? "Remove" : "Add"} tag filter ${tag}`}
                  className={cn(
                    "inline-flex rounded-full border px-2 py-0.5 text-xs transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : hit.matchedTags.includes(tag)
                        ? "border-transparent bg-highlight text-highlight-foreground"
                        : "hover:bg-accent",
                  )}
                >
                  #{tag}
                </SearchLink>
              </li>
            );
          })}
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
