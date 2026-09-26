# Altegra Knowledge Sharing

A small web app where Altegra consultants share technical knowledge (problems, fixes, how-tos,
lessons learned) and search what colleagues have already written.

> Work in progress. This README grows with each build phase; the full version (demo script,
> project structure, database migration guide) lands in Phase 4.

## Requirements

- Node.js 22.12 or newer
- pnpm 10 (`corepack enable` installs the version pinned in `package.json`)

## Getting started

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000. On first start, `data/knowledge.json` is created from the committed
`data/seed.json`.

## Scripts

| Script               | What it does                                                       |
| -------------------- | ------------------------------------------------------------------ |
| `pnpm dev`           | Start the dev server                                               |
| `pnpm build`         | Production build                                                   |
| `pnpm start`         | Run the production build                                           |
| `pnpm lint`          | ESLint                                                             |
| `pnpm typecheck`     | TypeScript, with Next.js route types                               |
| `pnpm format`        | Format everything with Prettier (`format:check` verifies)          |
| `pnpm test`          | Vitest unit tests (no network needed)                              |
| `pnpm test:supabase` | Tests against your real Supabase project (creates + deletes a row) |
| `pnpm db:seed`       | Upsert the seed entries into Supabase (keeps other entries)        |
| `pnpm db:reset`      | Delete all Supabase entries, then insert the seed entries          |
| `pnpm data:reset`    | JSON storage: replace `data/knowledge.json` with the seed data     |

## Search

Search runs on the server with [MiniSearch](https://lucaong.github.io/minisearch/), an in-memory
full-text index (`src/lib/knowledge/search.ts`):

- Fields and boosts: title ×3, tags ×2.5, summary ×1.5, content ×1 (Markdown stripped).
- Prefix matching for search-as-you-type (`recyc` finds "recycling") and typo tolerance on words
  of 5+ letters (`colation` finds "collation"). Common stop words are ignored.
- All query words must match; if nothing matches all of them, results matching any word are
  shown with a notice.
- Filters: category and tags (all selected tags must match), sort by relevance or newest. Filter
  counts show how many results each choice would give.
- State lives in the URL (`/?q=collation&category=sql-server&tags=tempdb&sort=newest`), so any
  search can be shared as a link. Press `/` to jump to the search box.

The index is built from the repository and cached per server instance. It is rebuilt whenever
the stored entries change (checked on every search), so results are always current, including
on Vercel, where each serverless instance has its own memory.

## Storage

All code goes through the `KnowledgeRepository` interface (`src/lib/knowledge/repository.ts`).
There are two implementations, chosen in `src/lib/knowledge/index.ts`:

| Backend  | Class                | When it's used                                                     |
| -------- | -------------------- | ------------------------------------------------------------------ |
| Supabase | `SupabaseRepository` | `KNOWLEDGE_STORAGE=supabase`, or Supabase variables are set        |
| JSON     | `JsonFileRepository` | `KNOWLEDGE_STORAGE=json`, or nothing is configured (offline demos) |

### Setting up Supabase

1. **Create the table.** In the Supabase dashboard, open **SQL Editor**, paste the contents of
   `supabase/migrations/0001_knowledge_entries.sql` and run it. It is safe to run again.
2. **Configure the app.** Copy `.env.example` to `.env.local` and fill in:
   - `SUPABASE_URL`: the Project URL from the project home page.
   - `SUPABASE_SECRET_KEY`: **Settings → API Keys → Secret keys** (`sb_secret_…`).

   Use the secret key, not the publishable key. The app only talks to Supabase from the
   server, and the secret key must never reach a browser or be committed. `.env.local` is
   gitignored.

3. **Load the seed data:** `pnpm db:seed`.
4. **Check the connection (optional):** `pnpm test:supabase`.
5. `pnpm dev`. The server log shows `[knowledge] storage: Supabase (…)`.

Row Level Security is enabled on the table with no policies, so the publishable key and
browsers have no access; the secret key used on the server bypasses RLS.

### JSON file (offline)

Without Supabase configuration, entries are stored in `data/knowledge.json` (gitignored), created
from `data/seed.json` on first start. Set `KNOWLEDGE_DATA_FILE` to use a different file.
