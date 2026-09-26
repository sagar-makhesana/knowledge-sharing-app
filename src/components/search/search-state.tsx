"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, use, useCallback, useMemo, useTransition } from "react";
import { toQueryString, type SearchParams } from "@/lib/knowledge/search-params";
import { cn } from "@/lib/utils";

interface SearchState {
  params: SearchParams;
  isPending: boolean;
  /** Updates the URL (and so the server-rendered results) with a new search state. */
  navigate: (next: SearchParams) => void;
}

const SearchStateContext = createContext<SearchState | null>(null);

export function useSearchState(): SearchState {
  const state = use(SearchStateContext);
  if (!state) throw new Error("useSearchState must be used inside <SearchStateProvider>");
  return state;
}

/**
 * Holds the current search (as rendered by the server) and navigates to new searches inside a
 * transition, so the current results stay on screen, dimmed, until the new ones arrive.
 */
export function SearchStateProvider({
  params,
  children,
}: {
  params: SearchParams;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const navigate = useCallback(
    (next: SearchParams) => {
      startTransition(() => {
        // replace, not push: typing shouldn't add a history entry per keystroke.
        router.replace(`${pathname}${toQueryString(next)}`, { scroll: false });
      });
    },
    [pathname, router],
  );

  const value = useMemo(() => ({ params, isPending, navigate }), [params, isPending, navigate]);
  return <SearchStateContext value={value}>{children}</SearchStateContext>;
}

/**
 * A real link to a search state (works for middle-click, copy link, no JS), which navigates in
 * place through the search state on a plain click.
 */
export function SearchLink({
  to,
  className,
  children,
  ...props
}: { to: SearchParams } & Omit<React.ComponentProps<typeof Link>, "href">) {
  const { navigate } = useSearchState();
  return (
    <Link
      href={`/${toQueryString(to)}`}
      scroll={false}
      className={cn(className)}
      onClick={(event) => {
        if (
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          event.button !== 0
        ) {
          return;
        }
        event.preventDefault();
        navigate(to);
      }}
      {...props}
    >
      {children}
    </Link>
  );
}

/** Dims its content while a new search is loading. */
export function SearchResultsRegion({ children }: { children: React.ReactNode }) {
  const { isPending } = useSearchState();
  return (
    <div
      aria-busy={isPending}
      className={cn("transition-opacity duration-150", isPending && "opacity-60")}
    >
      {children}
    </div>
  );
}
