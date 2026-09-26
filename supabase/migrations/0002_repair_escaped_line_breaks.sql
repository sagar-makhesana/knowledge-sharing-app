-- Repairs entries whose content has its line breaks stored as the two characters \n (typically
-- content pasted from a JSON file into the table editor, or inserted with plain SQL strings).
-- Such content renders as one paragraph of plain text instead of formatted Markdown.
-- Only rows without any real line break are touched, so correct entries are left alone.
-- Run once in the Supabase SQL Editor. Safe to re-run.

-- 1. Preview which entries are affected:
select id, title
from public.knowledge_entries
where position(E'\n' in content) = 0
  and position('\n' in content) > 0;

-- 2. Repair them (\r\n and \n become line breaks, \t a tab, \" a quote, \\ a backslash):
update public.knowledge_entries
set content = replace(
      replace(
        replace(
          replace(
            replace(replace(content, '\\', E'\u0001'), '\r\n', E'\n'),
          '\n', E'\n'),
        '\t', E'\t'),
      '\"', '"'),
    E'\u0001', '\'),
    updated_at = now()
where position(E'\n' in content) = 0
  and position('\n' in content) > 0;
