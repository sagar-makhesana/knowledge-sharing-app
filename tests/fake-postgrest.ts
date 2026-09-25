import type { KnowledgeRow } from "@/lib/knowledge/supabase-repository";

export interface RecordedRequest {
  method: string;
  path: string;
  params: URLSearchParams;
  headers: Headers;
}

/**
 * A tiny in-memory stand-in for Supabase's PostgREST API, covering only the requests
 * SupabaseRepository makes. Passed to supabase-js as its `fetch`, so the real client builds
 * the real HTTP requests and we can assert on them.
 */
export function createFakePostgrest(table: string, initial: KnowledgeRow[] = []) {
  const rows = new Map(initial.map((row) => [row.id, { ...row }]));
  const requests: RecordedRequest[] = [];
  let nextError: { status: number; body: unknown } | null = null;

  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });

  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const recorded = {
      method: request.method,
      path: url.pathname,
      params: url.searchParams,
      headers: request.headers,
    };
    requests.push(recorded);

    if (nextError) {
      const { status, body } = nextError;
      nextError = null;
      return json(status, body);
    }
    if (url.pathname !== `/rest/v1/${table}`) {
      return json(404, { code: "42P01", message: `relation "${url.pathname}" does not exist` });
    }

    const idFilter = url.searchParams.get("id")?.replace(/^eq\./, "");
    let result: KnowledgeRow[];

    switch (request.method) {
      case "GET": {
        result = [...rows.values()].filter((row) => !idFilter || row.id === idFilter);
        const order = url.searchParams.get("order");
        if (order === "created_at.desc") {
          result.sort((a, b) => b.created_at.localeCompare(a.created_at));
        }
        break;
      }
      case "POST": {
        const body = (await request.json()) as Partial<KnowledgeRow>;
        const now = new Date().toISOString().replace("Z", "+00:00");
        const row = {
          id: crypto.randomUUID(),
          created_at: now,
          updated_at: now,
          ...body,
        } as KnowledgeRow;
        rows.set(row.id, row);
        result = [row];
        break;
      }
      case "PATCH": {
        const body = (await request.json()) as Partial<KnowledgeRow>;
        const existing = idFilter ? rows.get(idFilter) : undefined;
        result = existing ? [Object.assign(existing, body)] : [];
        break;
      }
      default:
        return json(405, { message: `unsupported method ${request.method}` });
    }

    // `.single()` asks for one object; PostgREST answers 406 when there isn't exactly one row.
    if (request.headers.get("accept")?.includes("vnd.pgrst.object")) {
      return result.length === 1
        ? json(200, result[0])
        : json(406, {
            code: "PGRST116",
            message: "JSON object requested, multiple (or no) rows returned",
          });
    }
    return json(request.method === "POST" ? 201 : 200, result);
  };

  return {
    fetch,
    rows,
    requests,
    failNextRequest(status: number, message: string) {
      nextError = { status, body: { code: "XX000", message } };
    },
  };
}
