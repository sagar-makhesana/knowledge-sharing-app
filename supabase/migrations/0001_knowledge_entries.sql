-- Altegra Knowledge Sharing: knowledge entries table.
-- Run once in the Supabase SQL Editor (or with `supabase db push`). Safe to re-run.

create table if not exists public.knowledge_entries (
  id          uuid        primary key default gen_random_uuid(),
  title       text        not null check (char_length(title) between 1 and 120),
  summary     text        not null check (char_length(summary) between 1 and 300),
  content     text        not null check (char_length(content) between 1 and 20000),
  -- Stable slugs; the display labels live in the app (src/lib/knowledge/schema.ts).
  category    text        not null check (category in (
                'aras-innovator', 'teamcenter', 'sql-server', 'iis-hosting',
                'integration', 'upgrade-migration', 'process-methodology', 'other'
              )),
  tags        text[]      not null default '{}',
  environment text,
  author      text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists knowledge_entries_created_at_idx
  on public.knowledge_entries (created_at desc);

-- The app talks to this table only from the server, with the secret key (which bypasses RLS).
-- RLS on with no policies means the publishable key and browsers get no access at all.
alter table public.knowledge_entries enable row level security;

grant select, insert, update, delete on table public.knowledge_entries to service_role;
