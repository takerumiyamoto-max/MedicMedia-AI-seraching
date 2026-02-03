import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type ExtractedPdf = {
  pdf_id: string;
  page_count: number;
  pages: { page: number; text: string }[];
  created_at: string;
};

export function getExtractDir(uploadDirAbs: string) {
  return path.join(uploadDirAbs, "extracted");
}

export function getExtractPath(uploadDirAbs: string, pdf_id: string) {
  return path.join(getExtractDir(uploadDirAbs), `${pdf_id}.json`);
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function getPageCount(pdfAbsPath: string): Promise<number> {
  // pdfinfo の出力から "Pages: 12" を拾う
  const { stdout } = await execFileAsync("pdfinfo", [pdfAbsPath], {
    maxBuffer: 10 * 1024 * 1024,
  });
  const m = stdout.match(/^Pages:\s+(\d+)/m);
  if (!m) throw new Error("Could not detect page count via pdfinfo");
  return Number(m[1]);
}

async function pdftotextOnePage(pdfAbsPath: string, page: number): Promise<string> {
  // stdout に吐かせる: 出力先を "-" にする
  const { stdout } = await execFileAsync(
    "pdftotext",
    ["-f", String(page), "-l", String(page), "-enc", "UTF-8", "-layout", pdfAbsPath, "-"],
    {
      // PDFによっては出力が大きいので余裕を持たせる
      maxBuffer: 50 * 1024 * 1024,
    }
  );
  return stdout ?? "";
}

export async function extractPdfToPages(
  uploadDirAbs: string,
  pdf_id: string,
  pdfAbsPath: string
): Promise<ExtractedPdf> {
  try {
    await ensureDir(getExtractDir(uploadDirAbs));

    const pageCount = await getPageCount(pdfAbsPath);

    // MVP: 1ページずつ順番に抽出（重ければ後で並列化/キャッシュ）
    const pages: { page: number; text: string }[] = [];
    for (let p = 1; p <= pageCount; p++) {
      const text = await pdftotextOnePage(pdfAbsPath, p);
      pages.push({ page: p, text });
    }

    const result: ExtractedPdf = {
      pdf_id,
      page_count: pageCount,
      pages,
      created_at: new Date().toISOString(),
    };

    await fs.writeFile(getExtractPath(uploadDirAbs, pdf_id), JSON.stringify(result, null, 2), "utf-8");
    return result;
  } catch (e: any) {
    // poppler未インストールのときに分かりやすくする
    const msg = String(e?.message ?? e);
    if (msg.includes("ENOENT") || msg.includes("not found")) {
      throw new Error("pdftotext/pdfinfo not found. Please install poppler (brew install poppler).");
    }
    throw e;
  }
}

export async function readExtracted(
  uploadDirAbs: string,
  pdf_id: string
): Promise<ExtractedPdf | null> {
  try {
    const raw = await fs.readFile(getExtractPath(uploadDirAbs, pdf_id), "utf-8");
    return JSON.parse(raw) as ExtractedPdf;
  } catch (e: any) {
    if (e?.code === "ENOENT") return null;
    throw e;
  }
}