import fs from "node:fs/promises";
import path from "node:path";
import { ApiError } from "./api_error";
import { readExtracted } from "./extract";
import { extractPdfToText, readExtractedText } from "./extract_text";
import { readChunks, buildChunksForPdf } from "./chunk";

async function exists(p: string) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function extractedJsonPath(uploadDirAbs: string, pdf_id: string) {
  return path.join(uploadDirAbs, "extracted", `${pdf_id}.json`);
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

// ✅ .text.json -> pages形式の .json を作って互換にする
async function materializePagesJsonFromText(uploadDirAbs: string, pdf_id: string) {
  const txt = await readExtractedText(uploadDirAbs, pdf_id);
  if (!txt?.text?.trim()) return false;

  // ✅ extracted ディレクトリを作る（readExtracted がここを見る想定）
  await fs.mkdir(path.join(uploadDirAbs, "extracted"), { recursive: true });

  const pages = [{ page: 1, text: txt.text }]; // 最低限：全テキストを1ページ扱い
  const payload = {
    pdf_id,
    status: "EXTRACTED",
    pages,
    meta: txt.meta ?? {},
    created_at: txt.created_at ?? new Date().toISOString(),
  };

  await fs.writeFile(extractedJsonPath(uploadDirAbs, pdf_id), JSON.stringify(payload, null, 2), "utf-8");
  return true;
}

export async function ensureExtracted(uploadDirAbs: string, pdf_id: string) {
  // 1) まず従来形式（pages json）を探す
  const extracted = await readExtracted(uploadDirAbs, pdf_id);
  if (extracted) return extracted;

  // 2) .text.json があるなら、それから pages json を作る（救済）
  const rescued = await materializePagesJsonFromText(uploadDirAbs, pdf_id);
  if (rescued) {
    const extracted2 = await readExtracted(uploadDirAbs, pdf_id);
    if (extracted2) return extracted2;
  }

  // 3) 無いなら、PDFから抽出して（extract_text.ts が .text.json を作る）
  const fileAbsPath = await findUploadedFilePath(uploadDirAbs, pdf_id);
  await extractPdfToText(uploadDirAbs, pdf_id, fileAbsPath);

  // 4) 抽出後も pages json が無ければ .text.json から生成
  const rescued2 = await materializePagesJsonFromText(uploadDirAbs, pdf_id);
  if (!rescued2) {
    throw new ApiError("INTERNAL", "failed to extract text", 500, { pdf_id });
  }

  const extracted3 = await readExtracted(uploadDirAbs, pdf_id);
  if (!extracted3) {
    throw new ApiError("INTERNAL", "failed to materialize extracted pages", 500, { pdf_id });
  }
  return extracted3;
}

export async function ensureChunked(
  uploadDirAbs: string,
  pdf_id: string,
  opts?: { chunk_size?: number; overlap?: number }
) {
  const chunked = await readChunks(uploadDirAbs, pdf_id);
  if (chunked) return chunked;

  // buildChunksForPdf は extracted.pages を前提なので ensureExtracted を先に通す
  await ensureExtracted(uploadDirAbs, pdf_id);

  const built = await buildChunksForPdf(uploadDirAbs, pdf_id, opts);
  if (!built) {
    throw new ApiError("INTERNAL", "failed to build chunks", 500, { pdf_id });
  }
  return built;
}

export async function getPdfRepresentativeText(uploadDirAbs: string, pdf_id: string) {
  const extracted = await ensureExtracted(uploadDirAbs, pdf_id);
  const pages = (extracted as any).pages as Array<{ text: string }> | undefined;
  const fullText =
    pages && Array.isArray(pages) ? pages.map((p) => p.text ?? "").join("\n") : "";

  const head = String(fullText).slice(0, 9000);
  if (!head.trim()) {
    throw new ApiError("INTERNAL", "extracted text is empty", 500, { pdf_id });
  }
  return head;
}