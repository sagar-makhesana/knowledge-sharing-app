import { BookPlus, SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ResultCard } from "@/components/search/result-card";
import { SearchBox } from "@/components/search/search-box";
import {
  CategoryFilter,
  ClearFiltersLink,
  SortSelect,
  TagFilter,
} from "@/components/search/search-filters";
import { SearchResultsRegion, SearchStateProvider } from "@/components/search/search-state";
import { Button } from "@/components/ui/button";
import { parseSearchParams, type SearchParams } from "@/lib/knowledge/search-params";
import { searchKnowledge } from "@/lib/knowledge/search-service";
import { categoryLabel } from "@/lib/knowledge/schema";

export async function generateMetadata({ searchParams }: PageProps<"/">): Promise<Metadata> {
  const { q } = parseSearchParams(await searchParams);
  return q ? { title: `“${q}”` } : {};
}

export default async function SearchPage({ searchParams }: PageProps<"/">) {
  const params = parseSearchParams(await searchParams);
  const outcome = await searchKnowledge(params);
  const { hits, facets, totalEntries } = outcome;
  const filtered = params.category !== null || params.tags.length > 0;

  return (
    <SearchStateProvider params={params}>
      <section className="mx-auto mb-10 max-w-3xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Find what your colleagues already solved
        </h1>
        <p className="mt-2 mb-6 text-balance text-muted-foreground">
          Problems, fixes and lessons learned from Altegra consultants.
        </p>
        <SearchBox totalEntries={totalEntries} />
      </section>

      {totalEntries === 0 ? (
        <EmptyKnowledgeBase />
      ) : (
        <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="min-w-0 space-y-6" aria-label="Filters">
            <CategoryFilter categories={facets.categories} />
            <TagFilter tags={facets.tags} />
          </aside>

          <section aria-labelledby="results-heading" className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="results-heading" className="text-sm font-medium" aria-live="polite">
                  <ResultsSummary count={hits.length} params={params} />
                </h2>
                {filtered && <ClearFiltersLink>Clear filters</ClearFiltersLink>}
              </div>
              <SortSelect sort={outcome.sort} />
            </div>

            {outcome.matchMode === "any" && hits.length > 0 && (
              <p className="mb-4 rounded-lg bg-muted px-4 py-2.5 text-sm text-muted-foreground">
                No entry contains all of your words, so these match at least one of them.
              </p>
            )}

            <SearchResultsRegion>
              {hits.length > 0 ? (
                <ol className="grid gap-4">
                  {hits.map((hit) => (
                    <li key={hit.entry.id}>
                      <ResultCard hit={hit} params={params} />
                    </li>
                  ))}
                </ol>
              ) : (
                <NoResults params={params} filtered={filtered} />
              )}
            </SearchResultsRegion>
          </section>
        </div>
      )}
    </SearchStateProvider>
  );
}

function ResultsSummary({ count, params }: { count: number; params: SearchParams }) {
  const noun = count === 1 ? "entry" : "entries";
  const scope = [
    params.category && `in ${categoryLabel(params.category)}`,
    params.tags.length > 0 && `tagged ${params.tags.map((t) => `#${t}`).join(" + ")}`,
  ]
    .filter(Boolean)
    .join(" ");
  if (params.q) {
    return (
      <>
        {count} {count === 1 ? "result" : "results"} for “{params.q}”{scope && ` ${scope}`}
      </>
    );
  }
  return <>{scope ? `${count} ${noun} ${scope}` : `All ${count} ${noun}`}, newest first</>;
}

function NoResults({ params, filtered }: { params: SearchParams; filtered: boolean }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
      <SearchX className="size-10 text-muted-foreground" aria-hidden />
      <h3 className="mt-4 text-lg font-semibold">
        {params.q ? `Nothing found for “${params.q}”` : "No entries match these filters"}
      </h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {filtered
          ? "Try removing a filter, or use fewer or different words."
          : "Try fewer or different words. If nobody has written this down yet, you could be the first."}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <Button asChild>
          <Link href={params.q ? `/submit?title=${encodeURIComponent(params.q)}` : "/submit"}>
            <BookPlus aria-hidden />
            Submit this knowledge
          </Link>
        </Button>
        {filtered && <ClearFiltersLink>Clear filters</ClearFiltersLink>}
      </div>
    </div>
  );
}

function EmptyKnowledgeBase() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center rounded-xl border border-dashed px-6 py-14 text-center">
      <BookPlus className="size-10 text-muted-foreground" aria-hidden />
      <h2 className="mt-4 text-lg font-semibold">No knowledge shared yet</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Solved something tricky recently? Share it so colleagues can find it here.
      </p>
      <Button asChild className="mt-6">
        <Link href="/submit">Share the first entry</Link>
      </Button>
    </div>
  );
}
