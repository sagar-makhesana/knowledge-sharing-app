// Loads data/seed.json into the Supabase table `knowledge_entries`.
//   pnpm db:seed   upsert the seed entries (keeps entries people added)
//   pnpm db:reset  delete every entry first, then insert the seed entries
// Reads SUPABASE_URL and SUPABASE_SECRET_KEY from the environment or .env.local.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const TABLE = "knowledge_entries";
const reset = process.argv.includes("--reset");
const { SUPABASE_URL: url, SUPABASE_SECRET_KEY: secretKey } = process.env;

if (!url || !secretKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local first (see .env.example).");
  process.exit(1);
}

const supabase = createClient(url, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const seed = JSON.parse(await readFile(path.join(process.cwd(), "data", "seed.json"), "utf8"));
const rows = seed.entries.map((entry) => ({
  id: entry.id,
  title: entry.title,
  summary: entry.summary,
  content: entry.content,
  category: entry.category,
  tags: entry.tags,
  environment: entry.environment,
  author: entry.author,
  created_at: entry.createdAt,
  updated_at: entry.updatedAt,
}));

function fail(action, error) {
  console.error(`Failed to ${action}: ${error.message}`);
  if (error.code === "42P01" || /does not exist|schema cache/i.test(error.message)) {
    console.error("Has supabase/migrations/0001_knowledge_entries.sql been run in the SQL Editor?");
  }
  process.exit(1);
}

if (reset) {
  // PostgREST refuses unfiltered deletes; this filter matches every row.
  const { error } = await supabase.from(TABLE).delete().not("id", "is", null);
  if (error) fail("clear the table", error);
  console.log("Deleted all entries.");
}

const { error } = await supabase.from(TABLE).upsert(rows, { onConflict: "id" });
if (error) fail("load the seed data", error);

console.log(`${reset ? "Inserted" : "Upserted"} ${rows.length} seed entries into ${TABLE}.`);
