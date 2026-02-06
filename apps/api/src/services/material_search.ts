import { readChunks, type ChunkedPdf, type MaterialChunk } from "./chunk";
import { ApiError } from "./api_error";

export type MaterialHit = {
  chunk_id: string;
  pdf_id: string;
  page_start: number;
  page_end: number;
  score: number;
  snippet: string;
};

function tokenize(q: string) {
  return q
    .toLowerCase()
    .split(/[\s　]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function countOccurrences(text: string, token: string) {
  if (!token) return 0;
  const t = text.toLowerCase();
  let count = 0;
  let idx = 0;
  while (true) {
    const found = t.indexOf(token, idx);
    if (found === -1) break;
    count++;
    idx = found + token.length;
  }
  return count;
}

function makeSnippet(text: string, queryTokens: string[], maxLen = 180) {
  const lower = text.toLowerCase();
  let pos = -1;
  for (const tok of queryTokens) {
    const p = lower.indexOf(tok);
    if (p !== -1) {
      pos = p;
      break;
    }
  }
  if (pos === -1) return text.slice(0, maxLen);

  const start = Math.max(0, pos - Math.floor(maxLen / 3));
  const end = Math.min(text.length, start + maxLen);
  const prefix = start > 0 ? "…" : "";
  const suffix = end < text.length ? "…" : "";
  return prefix + text.slice(start, end) + suffix;
}

function scoreChunk(chunk: MaterialChunk, tokens: string[]) {
  let score = 0;
  for (const tok of tokens) score += countOccurrences(chunk.text, tok);
  return score;
}

export async function searchMaterial(
  uploadDirAbs: string,
  pdf_id: string,
  query: string,
  topK = 5
): Promise<{ chunked: ChunkedPdf; hits: MaterialHit[] }> {
  const chunked = await readChunks(uploadDirAbs, pdf_id);

  // ここが今回の要：nullで返さず、エラーコードで投げる
  if (!chunked) {
    throw new ApiError(
      "NOT_CHUNKED",
      "This pdf is not chunked yet.",
      409,
      { pdf_id }
    );
  }

  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return { chunked, hits: [] };
  }

  const scored = chunked.chunks
    .map((c) => {
      const score = scoreChunk(c, tokens);
      return { c, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  const hits: MaterialHit[] = scored.map(({ c, score }) => ({
    chunk_id: c.chunk_id,
    pdf_id: c.pdf_id,
    page_start: c.page_start,
    page_end: c.page_end,
    score,
    snippet: makeSnippet(c.text, tokens),
  }));

  return { chunked, hits };
}