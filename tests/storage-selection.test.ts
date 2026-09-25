import { describe, expect, it } from "vitest";
import { resolveStorageKind } from "@/lib/knowledge";

describe("resolveStorageKind", () => {
  it("honours an explicit KNOWLEDGE_STORAGE", () => {
    expect(resolveStorageKind({ KNOWLEDGE_STORAGE: "json", SUPABASE_URL: "x" })).toBe("json");
    expect(resolveStorageKind({ KNOWLEDGE_STORAGE: "Supabase" })).toBe("supabase");
  });

  it("uses Supabase when it is configured, otherwise the JSON file", () => {
    expect(resolveStorageKind({ SUPABASE_URL: "u", SUPABASE_SECRET_KEY: "k" })).toBe("supabase");
    expect(resolveStorageKind({})).toBe("json");
  });

  it("treats a half-configured Supabase as Supabase, so the missing variable is reported", () => {
    expect(resolveStorageKind({ SUPABASE_URL: "u" })).toBe("supabase");
  });

  it("rejects unknown values", () => {
    expect(() => resolveStorageKind({ KNOWLEDGE_STORAGE: "mysql" })).toThrow(/must be/);
  });
});
