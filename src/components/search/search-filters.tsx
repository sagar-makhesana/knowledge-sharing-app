"use client";

import { Check, X } from "lucide-react";
import { SearchLink, useSearchState } from "@/components/search/search-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FacetCount } from "@/lib/knowledge/search";
import type { SortOption } from "@/lib/knowledge/search-params";
import type { CategoryId } from "@/lib/knowledge/schema";
import { cn } from "@/lib/utils";

const MAX_TAGS = 12;
const MOBILE_TAGS = 6;

const chip =
  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function CategoryFilter({
  categories,
}: {
  categories: (FacetCount<CategoryId> & { label: string })[];
}) {
  const { params } = useSearchState();
  const total = categories.reduce((sum, c) => sum + c.count, 0);
  const options = [{ value: null, label: "All categories", count: total }, ...categories];

  return (
    <nav aria-labelledby="category-filter-heading">
      <h2
        id="category-filter-heading"
        className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase"
      >
        Category
      </h2>
      {/* A scrolling row on phones, a list on larger screens. */}
      <ul className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0">
        {options.map((option) => {
          const active = params.category === option.value;
          const empty = option.count === 0 && !active;
          return (
            <li key={option.value ?? "all"} className="shrink-0">
              <SearchLink
                to={{ ...params, category: option.value }}
                aria-current={active ? "true" : undefined}
                className={cn(
                  chip,
                  "w-full justify-between whitespace-nowrap lg:border-transparent",
                  active
                    ? "border-primary/30 bg-accent font-medium text-accent-foreground"
                    : "hover:bg-accent/60",
                  empty && "text-muted-foreground/70",
                )}
              >
                {option.label}
                <span className="text-xs text-muted-foreground tabular-nums">{option.count}</span>
              </SearchLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function TagFilter({ tags }: { tags: FacetCount[] }) {
  const { params } = useSearchState();
  const popular = tags.filter((t) => !params.tags.includes(t.value)).slice(0, MAX_TAGS);
  if (!params.tags.length && !popular.length) return null;

  return (
    <section aria-labelledby="tag-filter-heading">
      <h2
        id="tag-filter-heading"
        className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase"
      >
        Tags
      </h2>
      <ul className="flex flex-wrap gap-1.5">
        {params.tags.map((tag) => (
          <li key={tag}>
            <SearchLink
              to={{ ...params, tags: params.tags.filter((t) => t !== tag) }}
              aria-label={`Remove tag filter ${tag}`}
              className={cn(chip, "border-primary bg-primary text-primary-foreground")}
            >
              <Check className="size-3.5" aria-hidden />#{tag}
              <X className="size-3.5 opacity-80" aria-hidden />
            </SearchLink>
          </li>
        ))}
        {popular.map((tag, index) => (
          // Fewer suggestions on small screens, so results stay close to the search box.
          <li key={tag.value} className={index >= MOBILE_TAGS ? "hidden lg:list-item" : undefined}>
            <SearchLink
              to={{ ...params, tags: [...params.tags, tag.value] }}
              aria-label={`Filter by tag ${tag.value} (${tag.count})`}
              className={cn(chip, "text-xs hover:bg-accent/60")}
            >
              #{tag.value}
              <span className="text-muted-foreground tabular-nums">{tag.count}</span>
            </SearchLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function SortSelect({ sort }: { sort: SortOption }) {
  const { params, navigate } = useSearchState();
  return (
    <div className="flex items-center gap-2">
      <label htmlFor="sort" className="text-sm text-muted-foreground">
        Sort by
      </label>
      <Select
        value={sort}
        onValueChange={(value) => navigate({ ...params, sort: value as SortOption })}
      >
        <SelectTrigger id="sort" size="sm" className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          <SelectItem value="relevance" disabled={!params.q}>
            Relevance
          </SelectItem>
          <SelectItem value="newest">Newest</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

export function ClearFiltersLink({ children }: { children: React.ReactNode }) {
  const { params } = useSearchState();
  return (
    <SearchLink
      to={{ q: params.q, category: null, tags: [], sort: params.sort }}
      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
    >
      {children}
    </SearchLink>
  );
}
