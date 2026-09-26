"use client";

import { Loader2, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSearchState } from "@/components/search/search-state";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 250;

export function SearchBox({ totalEntries }: { totalEntries: number }) {
  const { params, isPending, navigate } = useSearchState();
  const [text, setText] = useState(params.q);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // The query we last sent, so an older server render can't overwrite what the user is typing.
  const lastSent = useRef(params.q);

  // Follow the URL when it changes from outside (back/forward, clicking a link).
  useEffect(() => {
    if (params.q !== lastSent.current) {
      lastSent.current = params.q;
      setText(params.q);
    }
  }, [params.q]);

  // "/" focuses the search box from anywhere on the page, like many search UIs.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement;
      if (event.key !== "/" || target.closest("input, textarea, select, [contenteditable]")) return;
      event.preventDefault();
      inputRef.current?.focus();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  function submit(value: string) {
    clearTimeout(timer.current);
    const q = value.trim();
    if (q === lastSent.current) return;
    lastSent.current = q;
    navigate({ ...params, q });
  }

  function onChange(value: string) {
    setText(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => submit(value), DEBOUNCE_MS);
  }

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        submit(text);
      }}
      className="relative"
    >
      <label htmlFor="search" className="sr-only">
        Search knowledge
      </label>
      <Search
        className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <input
        ref={inputRef}
        id="search"
        type="search"
        value={text}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && text) {
            event.preventDefault();
            onChange("");
          }
        }}
        placeholder={`Search ${totalEntries} entries: errors, products, fixes…`}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        className={cn(
          "h-14 w-full rounded-xl border bg-card pr-20 pl-12 text-base shadow-sm transition-[color,box-shadow] outline-none sm:text-lg",
          "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/40",
          "[&::-webkit-search-cancel-button]:hidden",
        )}
      />
      <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1">
        {isPending && (
          <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Searching" />
        )}
        {text ? (
          <button
            type="button"
            onClick={() => {
              onChange("");
              inputRef.current?.focus();
            }}
            className="rounded-md p-1.5 text-muted-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            aria-label="Clear search"
          >
            <X className="size-4" aria-hidden />
          </button>
        ) : (
          <kbd
            className="hidden rounded border px-1.5 py-0.5 font-mono text-xs text-muted-foreground sm:inline"
            aria-hidden
          >
            /
          </kbd>
        )}
      </div>
    </form>
  );
}
