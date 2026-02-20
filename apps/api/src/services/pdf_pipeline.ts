import fs from "node:fs/promises";
import path from "node:path";
import { ApiError } from "./api_error";
import { readExtracted } from "./extract";
import { extractPdfToText } from "./extract_text";
import { readChunks, buildChunksForPdf } from "./chunk";

async function exists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function findUploadedFilePath(uploadDirAbs: string, pdf_id: string): Promise<string> {
  const candidates = [
    path.join(uploadDirAbs, `${pdf_id}.pdf`),
    path.join(uploadDirAbs, `${pdf_id}.png`),
    path.join(uploadDirAbs, `${pdf_id}.jpg`),
    path.join(uploadDirAbs, `${pdf_id}.jpeg`),
    path.join(uploadDirAbs, pdf_id),
  ];

  for (const p of candidates) {
    if (await exists(p)) return p;
  }

  throw new ApiError("NOT_FOUND", "uploaded file not found for pdf_id", 404, { pdf_id });
}

export async function ensureExtracted(uploadDirAbs: string, pdf_id: string) {
  const extracted = await readExtracted(uploadDirAbs, pdf_id);
  if (extracted) return extracted;

  const fileAbsPath = await findUploadedFilePath(uploadDirAbs, pdf_id);

  // ✅ extractPdfToText は extract_text.ts 側を使う
  await extractPdfToText(uploadDirAbs, pdf_id, fileAbsPath);

  const extracted2 = await readExtracted(uploadDirAbs, pdf_id);
  if (!extracted2) {
    throw new ApiError("INTERNAL", "failed to extract text", 500, { pdf_id });
  }
  return extracted2;
}

export async function ensureChunked(
  uploadDirAbs: string,
  pdf_id: string,
  opts?: { chunk_size?: number; overlap?: number }
) {
  const chunked = await readChunks(uploadDirAbs, pdf_id);
  if (chunked) return chunked;

  const built = await buildChunksForPdf(uploadDirAbs, pdf_id, opts);
  if (!built) {
    throw new ApiError("NOT_EXTRACTED", "pdf is not extracted yet", 400, { pdf_id });
  }
  return built;
}

export async function getPdfRepresentativeText(uploadDirAbs: string, pdf_id: string) {
  const extracted = await ensureExtracted(uploadDirAbs, pdf_id);

  // chunk.ts が extracted.pages を参照している前提に合わせる
  const pages = (extracted as any).pages as Array<{ text: string }> | undefined;
  const fullText =
    pages && Array.isArray(pages)
      ? pages.map((p) => p.text ?? "").join("\n")
      : ((extracted as any).text ?? "");

  const head = String(fullText).slice(0, 8000);
  if (!head.trim()) {
    throw new ApiError("INTERNAL", "extracted text is empty", 500, { pdf_id });
  }
  return head;
}