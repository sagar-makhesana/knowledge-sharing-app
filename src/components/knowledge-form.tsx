"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { Controller, useForm, useWatch, type FieldPath } from "react-hook-form";
import { toast } from "sonner";
import { Markdown } from "@/components/markdown";
import { TagInput } from "@/components/tag-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { createEntry, updateEntry } from "@/lib/knowledge/actions";
import {
  CATEGORIES,
  KnowledgeInputSchema,
  LIMITS,
  type KnowledgeEntry,
  type KnowledgeFormValues,
  type KnowledgeInput,
} from "@/lib/knowledge/schema";
import { cn } from "@/lib/utils";

const AUTHOR_STORAGE_KEY = "altegra-knowledge:author";

const CONTENT_TEMPLATE = `## Problem

What happened, including the exact error message.

## Root cause

Why it happened.

## Fix

1. Step one
2. Step two

\`\`\`sql
-- commands or code that fixed it
\`\`\`

## Notes

Anything a colleague should watch out for.
`;

type KnowledgeFormProps = {
  /** Existing tags offered as autocomplete suggestions. */
  tagSuggestions: readonly string[];
} & ({ mode: "create"; entry?: never } | { mode: "edit"; entry: KnowledgeEntry });

export function KnowledgeForm({ mode, entry, tagSuggestions }: KnowledgeFormProps) {
  const router = useRouter();
  const [isNavigating, startNavigation] = useTransition();

  const form = useForm<KnowledgeFormValues, unknown, KnowledgeInput>({
    resolver: zodResolver(KnowledgeInputSchema),
    mode: "onTouched",
    defaultValues: entry
      ? {
          title: entry.title,
          summary: entry.summary,
          content: entry.content,
          category: entry.category,
          tags: entry.tags,
          environment: entry.environment ?? "",
          author: entry.author ?? "",
        }
      : { title: "", summary: "", content: "", tags: [], environment: "", author: "" },
  });
  const { register, control, formState, setError, setValue, getValues } = form;
  const { errors, isSubmitting } = formState;
  const busy = isSubmitting || isNavigating;

  const [title, summary, content] = useWatch({ control, name: ["title", "summary", "content"] });

  // Remember the author name between submissions on this browser (a convenience, not identity).
  useEffect(() => {
    if (mode !== "create" || getValues("author")) return;
    try {
      const saved = localStorage.getItem(AUTHOR_STORAGE_KEY);
      if (saved) setValue("author", saved);
    } catch {
      // Storage can be unavailable (private mode, blocked site data); the field just stays empty.
    }
  }, [mode, getValues, setValue]);

  const onSubmit = form.handleSubmit(async (values) => {
    const result =
      mode === "edit" ? await updateEntry(entry.id, values) : await createEntry(values);

    if (!result.ok) {
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        if (message) setError(field as FieldPath<KnowledgeFormValues>, { message });
      }
      toast.error(result.message);
      return;
    }

    try {
      if (values.author) localStorage.setItem(AUTHOR_STORAGE_KEY, values.author);
    } catch {
      // Ignore: remembering the author is optional.
    }
    toast.success(mode === "edit" ? "Changes saved" : "Knowledge shared. Thank you!", {
      description: values.title,
    });
    startNavigation(() => router.push(`/entries/${result.id}`));
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-6">
        <Field
          id="title"
          label="Title"
          required
          error={errors.title?.message}
          counter={{ value: title?.length ?? 0, max: LIMITS.title }}
        >
          {(describedBy) => (
            <Input
              id="title"
              placeholder="e.g. IIS app pool recycling kills long-running Aras jobs"
              autoComplete="off"
              aria-invalid={!!errors.title}
              aria-describedby={describedBy}
              aria-required
              {...register("title")}
            />
          )}
        </Field>

        <Field
          id="summary"
          label="Summary"
          required
          hint="One or two sentences on the problem or topic. This appears in search results."
          error={errors.summary?.message}
          counter={{ value: summary?.length ?? 0, max: LIMITS.summary }}
        >
          {(describedBy) => (
            <Textarea
              id="summary"
              rows={3}
              aria-invalid={!!errors.summary}
              aria-describedby={describedBy}
              aria-required
              {...register("summary")}
            />
          )}
        </Field>

        <Field
          id="content"
          label="Content"
          required
          hint="Markdown: steps, code snippets, root cause and fix."
          error={errors.content?.message}
        >
          {(describedBy) => (
            <Tabs defaultValue="write" className="gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <TabsList>
                  <TabsTrigger value="write">Write</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>
                {!content && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setValue("content", CONTENT_TEMPLATE, {
                        shouldDirty: true,
                        shouldValidate: true,
                      })
                    }
                  >
                    <FileText aria-hidden />
                    Insert template
                  </Button>
                )}
              </div>
              {/* Force-mounted so the textarea stays registered (and focusable on errors) in Preview. */}
              <TabsContent value="write" forceMount className="data-[state=inactive]:hidden">
                <Textarea
                  id="content"
                  rows={18}
                  spellCheck
                  className="min-h-80 font-mono text-sm leading-relaxed"
                  placeholder="## Problem&#10;&#10;## Root cause&#10;&#10;## Fix"
                  aria-invalid={!!errors.content}
                  aria-describedby={describedBy}
                  aria-required
                  {...register("content")}
                />
              </TabsContent>
              <TabsContent
                value="preview"
                className="min-h-80 rounded-md border bg-card px-5 py-4"
                aria-label="Content preview"
              >
                {content?.trim() ? (
                  <Markdown>{content}</Markdown>
                ) : (
                  <p className="text-sm text-muted-foreground">Nothing to preview yet.</p>
                )}
              </TabsContent>
            </Tabs>
          )}
        </Field>
      </div>

      <div className="space-y-6">
        <div className="space-y-6 rounded-xl border bg-card p-5">
          <Field id="category" label="Category" required error={errors.category?.message}>
            {(describedBy) => (
              <Controller
                control={control}
                name="category"
                render={({ field }) => (
                  <Select
                    name={field.name}
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    onOpenChange={(open) => !open && field.onBlur()}
                  >
                    <SelectTrigger
                      id="category"
                      ref={field.ref}
                      className="w-full"
                      aria-invalid={!!errors.category}
                      aria-describedby={describedBy}
                      aria-required
                    >
                      <SelectValue placeholder="Choose a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            )}
          </Field>

          <Field
            id="tags"
            label="Tags"
            hint={`Press Enter or comma to add. Up to ${LIMITS.tags}.`}
            error={errors.tags?.message ?? errors.tags?.find?.((e) => e)?.message}
          >
            {(describedBy) => (
              <Controller
                control={control}
                name="tags"
                render={({ field }) => (
                  <TagInput
                    id="tags"
                    ref={field.ref}
                    value={field.value ?? []}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    suggestions={tagSuggestions}
                    aria-invalid={!!errors.tags}
                    aria-describedby={describedBy}
                  />
                )}
              />
            )}
          </Field>

          <Field
            id="environment"
            label="Environment / version"
            hint="e.g. Aras 39, SQL Server 2022"
            error={errors.environment?.message}
          >
            {(describedBy) => (
              <Input
                id="environment"
                autoComplete="off"
                aria-invalid={!!errors.environment}
                aria-describedby={describedBy}
                {...register("environment")}
              />
            )}
          </Field>

          <Field id="author" label="Your name" error={errors.author?.message}>
            {(describedBy) => (
              <Input
                id="author"
                autoComplete="name"
                placeholder="Optional"
                aria-invalid={!!errors.author}
                aria-describedby={describedBy}
                {...register("author")}
              />
            )}
          </Field>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
          <Button type="submit" size="lg" disabled={busy} className="sm:flex-1 lg:flex-none">
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {mode === "edit" ? "Save changes" : "Share knowledge"}
          </Button>
          <Button asChild type="button" variant="ghost" size="lg">
            <Link href={mode === "edit" ? `/entries/${entry.id}` : "/"}>Cancel</Link>
          </Button>
        </div>
      </div>
    </form>
  );
}

interface FieldProps {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  counter?: { value: number; max: number };
  /** Receives the `aria-describedby` value that links the control to its hint and error. */
  children: (describedBy: string | undefined) => React.ReactNode;
}

function Field({ id, label, required, hint, error, counter, children }: FieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>
          {label}
          {required ? (
            <span className="text-destructive" aria-hidden>
              *
            </span>
          ) : (
            <span className="text-xs font-normal text-muted-foreground">(optional)</span>
          )}
        </Label>
        {counter && (
          <span
            className={cn(
              "text-xs tabular-nums",
              counter.value > counter.max ? "text-destructive" : "text-muted-foreground",
            )}
            aria-hidden
          >
            {counter.value}/{counter.max}
          </span>
        )}
      </div>
      {children(describedBy)}
      {hint && (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
