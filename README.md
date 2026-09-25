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

| Script            | What it does                                              |
| ----------------- | --------------------------------------------------------- |
| `pnpm dev`        | Start the dev server                                      |
| `pnpm build`      | Production build                                          |
| `pnpm start`      | Run the production build                                  |
| `pnpm lint`       | ESLint                                                    |
| `pnpm typecheck`  | TypeScript, with Next.js route types                      |
| `pnpm format`     | Format everything with Prettier (`format:check` verifies) |
| `pnpm test`       | Vitest unit tests                                         |
| `pnpm data:reset` | Replace `data/knowledge.json` with the seed data          |

## Data storage

Entries are stored in `data/knowledge.json` (gitignored). Set `KNOWLEDGE_DATA_FILE` to use a
different file. All code goes through the `KnowledgeRepository` interface in
`src/lib/knowledge/repository.ts`; the JSON file implementation is one swappable class.
