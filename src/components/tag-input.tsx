"use client";

import { X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { LIMITS, normalizeTag } from "@/lib/knowledge/schema";
import { cn } from "@/lib/utils";

const MAX_SUGGESTIONS = 8;

interface TagInputProps {
  id?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  onBlur?: () => void;
  suggestions: readonly string[];
  ref?: React.Ref<HTMLInputElement>;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
}

/** Keeps only characters a tag may contain and caps the length, mirroring the schema. */
function cleanTag(raw: string): string {
  return normalizeTag(raw)
    .replace(/[^\p{L}\p{N}.#+_-]/gu, "")
    .slice(0, LIMITS.tag);
}

/**
 * Multi-value tag field with autocomplete, following the ARIA combobox pattern: arrow keys move
 * through suggestions, Enter or comma adds, Backspace on an empty field removes the last tag.
 */
export function TagInput({
  id,
  value,
  onChange,
  onBlur,
  suggestions,
  ref,
  ...aria
}: TagInputProps) {
  const listboxId = useId();
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const full = value.length >= LIMITS.tags;

  const matches = useMemo(() => {
    const query = normalizeTag(text);
    const available = suggestions.filter((tag) => !value.includes(tag));
    if (!query) return available.slice(0, MAX_SUGGESTIONS);
    const startsWith = available.filter((tag) => tag.startsWith(query));
    const contains = available.filter((tag) => !tag.startsWith(query) && tag.includes(query));
    return [...startsWith, ...contains].slice(0, MAX_SUGGESTIONS);
  }, [text, suggestions, value]);

  const showList = open && !full && matches.length > 0;

  function addTags(raw: string) {
    const next = [...value];
    for (const tag of raw.split(",").map(cleanTag)) {
      if (tag && !next.includes(tag) && next.length < LIMITS.tags) next.push(tag);
    }
    if (next.length !== value.length) onChange(next);
    setText("");
    setActiveIndex(-1);
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setOpen(true);
        setActiveIndex((i) => (matches.length ? (i + 1) % matches.length : -1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setOpen(true);
        setActiveIndex((i) => (matches.length ? (i <= 0 ? matches.length - 1 : i - 1) : -1));
        break;
      case "Enter":
      case ",": {
        const active = showList ? matches[activeIndex] : undefined;
        if (active || text.trim()) {
          event.preventDefault();
          addTags(active ?? text);
        } else if (event.key === ",") {
          event.preventDefault();
        }
        break;
      }
      case "Tab":
        if (text.trim()) addTags(text);
        setOpen(false);
        break;
      case "Escape":
        if (showList) {
          event.preventDefault();
          setOpen(false);
          setActiveIndex(-1);
        }
        break;
      case "Backspace":
        if (!text && value.length) removeTag(value[value.length - 1]!);
        break;
    }
  }

  return (
    <div className="relative">
      <div
        className={cn(
          "flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 shadow-xs transition-[color,box-shadow] dark:bg-input/30",
          "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
          aria["aria-invalid"] && "border-destructive ring-destructive/20 dark:ring-destructive/40",
        )}
      >
        {value.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-secondary py-0.5 pr-1 pl-2 text-xs font-medium text-secondary-foreground"
          >
            #{tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="rounded-sm p-0.5 outline-none hover:bg-background/60 focus-visible:ring-2 focus-visible:ring-ring/50"
              aria-label={`Remove tag ${tag}`}
            >
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          ref={ref}
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listboxId}
          aria-activedescendant={
            showList && activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
          }
          {...aria}
          value={text}
          disabled={full}
          placeholder={
            full
              ? `Maximum of ${LIMITS.tags} tags`
              : value.length
                ? "Add another…"
                : "e.g. iis, upgrade"
          }
          onChange={(event) => {
            const next = event.target.value;
            if (next.includes(",")) {
              addTags(next);
            } else {
              setText(next);
              setOpen(true);
              setActiveIndex(-1);
            }
          }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            if (text.trim()) addTags(text);
            setOpen(false);
            onBlur?.();
          }}
          className="h-6 min-w-32 flex-1 bg-transparent px-1 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm"
        />
      </div>
      <ul
        id={listboxId}
        role="listbox"
        aria-label="Tag suggestions"
        hidden={!showList}
        className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      >
        {matches.map((tag, index) => (
          <li
            key={tag}
            id={`${listboxId}-${index}`}
            role="option"
            aria-selected={index === activeIndex}
            // Keep focus in the input so the click doesn't trigger blur first.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => addTags(tag)}
            className={cn(
              "cursor-pointer rounded-sm px-2 py-1.5 text-sm",
              index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
            )}
          >
            #{tag}
          </li>
        ))}
      </ul>
    </div>
  );
}
