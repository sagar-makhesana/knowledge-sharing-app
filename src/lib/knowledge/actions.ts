"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getKnowledgeRepository } from ".";
import { KnowledgeInputSchema, type KnowledgeFormValues } from "./schema";

export type FieldErrors = Partial<Record<keyof KnowledgeFormValues, string>>;

export type ActionResult =
  { ok: true; id: string } | { ok: false; message: string; fieldErrors?: FieldErrors };

// Server Actions are reachable by direct POST, so input is re-validated here even though the
// form already validated it with the same schema.

export async function createEntry(values: unknown): Promise<ActionResult> {
  const parsed = KnowledgeInputSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);

  try {
    const entry = await getKnowledgeRepository().create(parsed.data);
    revalidatePath("/");
    return { ok: true, id: entry.id };
  } catch (error) {
    console.error("createEntry failed", error);
    return { ok: false, message: "The entry couldn't be saved. Please try again." };
  }
}

export async function updateEntry(id: unknown, values: unknown): Promise<ActionResult> {
  const parsedId = z.uuid().safeParse(id);
  if (!parsedId.success) return { ok: false, message: "This entry doesn't exist." };
  const parsed = KnowledgeInputSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error);

  try {
    const entry = await getKnowledgeRepository().update(parsedId.data, parsed.data);
    if (!entry) return { ok: false, message: "This entry doesn't exist anymore." };
    revalidatePath("/");
    revalidatePath(`/entries/${entry.id}`);
    return { ok: true, id: entry.id };
  } catch (error) {
    console.error("updateEntry failed", error);
    return { ok: false, message: "Your changes couldn't be saved. Please try again." };
  }
}

function invalid(error: z.ZodError<KnowledgeFormValues>): ActionResult {
  const { fieldErrors } = z.flattenError(error);
  return {
    ok: false,
    message: "Please fix the highlighted fields.",
    fieldErrors: Object.fromEntries(
      Object.entries(fieldErrors).map(([field, messages]) => [field, messages?.[0]]),
    ) as FieldErrors,
  };
}
