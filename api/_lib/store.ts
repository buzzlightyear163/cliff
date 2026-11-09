import { put, list } from "@vercel/blob";
import { HttpError } from "./solana";

function ensureToken() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new HttpError(503, "Storage is not connected yet.");
}

export async function putFile(path: string, data: Buffer | string, contentType: string) {
  ensureToken();
  const r = await put(path, data, {
    access: "public",
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: 60,
  });
  return r.url;
}

export async function listJson<T>(prefix: string, limit = 500): Promise<T[]> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return [];
  const out: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, limit: 1000 });
    const jsons = await Promise.all(
      page.blobs.map(async (b) => {
        try {
          const r = await fetch(b.url, { cache: "no-store" });
          return (await r.json()) as T;
        } catch {
          return null;
        }
      }),
    );
    for (const j of jsons) if (j) out.push(j);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor && out.length < limit);
  return out;
}
