import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { readExtracted, type ExtractedPdf } from "./extract";

export type MaterialChunk = {
  chunk_id: string;
  pdf_id: string;
  page_start: number;
  page_end: number;
  text: string;
};

export type ChunkedPdf = {
  pdf_id: string;
  chunk_size: number;
  overlap: number;
  chunks: MaterialChunk[];
  created_at: string;
};

export function getChunkDir(uploadDirAbs: string) {
  return path.join(uploadDirAbs, "chunks");
}

export function getChunkPath(uploadDirAbs: string, pdf_id: string) {
  return path.join(getChunkDir(uploadDirAbs), `${pdf_id}.json`);
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

function normalizeText(s: string) {
  // \f（改ページ）を消し、空白をある程度整える
  return s.replace(/\f/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function splitWithOverlap(text: string, chunkSize: number, overlap: number) {
  const chunks: string[] = [];
  const t = text;
  let start = 0;

  while (start < t.length) {
    const end = Math.min(start + chunkSize, t.length);
    const piece = t.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= t.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
}

export async function buildChunksForPdf(
  uploadDirAbs: string,
  pdf_id: string,
  opts?: { chunk_size?: number; overlap?: number }
): Promise<ChunkedPdf | null> {
  const extracted: ExtractedPdf | null = await readExtracted(uploadDirAbs, pdf_id);
  if (!extracted) return null;

  const chunkSize = opts?.chunk_size ?? 800;
  const overlap = opts?.overlap ?? 150;

  const out: MaterialChunk[] = [];

  for (const p of extracted.pages) {
    const normalized = normalizeText(p.text);
    if (!normalized) continue;

    const parts = splitWithOverlap(normalized, chunkSize, overlap);
    for (const part of parts) {
      out.push({
        chunk_id: randomUUID(),
        pdf_id,
        page_start: p.page,
        page_end: p.page,
        text: part,
      });
    }
  }

  const result: ChunkedPdf = {
    pdf_id,
    chunk_size: chunkSize,
    overlap,
    chunks: out,
    created_at: new Date().toISOString(),
  };

  await ensureDir(getChunkDir(uploadDirAbs));
  await fs.writeFile(getChunkPath(uploadDirAbs, pdf_id), JSON.stringify(result, null, 2), "utf-8");

  return result;
}

export async function readChunks(uploadDirAbs: string, pdf_id: string): Promise<ChunkedPdf | null> {
  try {
    const raw = await fs.readFile(getChunkPath(uploadDirAbs, pdf_id), "utf-8");
    return JSON.parse(raw) as ChunkedPdf;
  } catch (e: any) {
    if (e?.code === "ENOENT") return null;
    throw e;
  }
}