import fs from "node:fs/promises";
import path from "node:path";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

export type ExtractedTextPayload = {
  pdf_id: string;
  status: "EXTRACTED_TEXT";
  chars: number;
  meta?: unknown;
  text: string;
  created_at: string;
};

// ✅ 追加：readExtracted が読む想定の “pages形式” も書く
export type ExtractedPdfPage = {
  page: number;
  text: string;
};

export type ExtractedPdfPayload = {
  pdf_id: string;
  status: "EXTRACTED";
  pages: ExtractedPdfPage[];
  meta?: { page_count: number };
  created_at: string;
};

function textOutPath(uploadDirAbs: string, pdf_id: string) {
  return path.join(uploadDirAbs, `${pdf_id}.text.json`);
}

// ✅ 追加：extract.ts の readExtracted が読む想定（たぶんこのパス）
function extractedJsonPath(uploadDirAbs: string, pdf_id: string) {
  return path.join(uploadDirAbs, `${pdf_id}.json`);
}

async function extractTextWithPdfjs(pdfAbsPath: string) {
  const buf = await fs.readFile(pdfAbsPath);
  const data = new Uint8Array(buf);

  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;

  const pages: ExtractedPdfPage[] = [];
  let fullText = "";

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((it: any) => (typeof it.str === "string" ? it.str : ""))
      .join(" ")
      .trim();

    pages.push({ page: pageNum, text: pageText });
    fullText += pageText + "\n";
  }

  return { text: fullText.trim(), pageCount: doc.numPages, pages };
}

export async function extractPdfToText(uploadDirAbs: string, pdf_id: string, pdfAbsPath: string) {
  const { text, pageCount, pages } = await extractTextWithPdfjs(pdfAbsPath);

  // 1) 既存：.text.json（全文テキスト）
  const payloadText: ExtractedTextPayload = {
    pdf_id,
    status: "EXTRACTED_TEXT",
    chars: text.length,
    meta: { page_count: pageCount },
    text,
    created_at: new Date().toISOString(),
  };
  await fs.writeFile(textOutPath(uploadDirAbs, pdf_id), JSON.stringify(payloadText, null, 2), "utf-8");

  // 2) ✅追加：${pdf_id}.json（pages形式）… chunk.ts/readExtracted と互換にする
  const payloadPages: ExtractedPdfPayload = {
    pdf_id,
    status: "EXTRACTED",
    pages,
    meta: { page_count: pageCount },
    created_at: payloadText.created_at,
  };
  await fs.writeFile(extractedJsonPath(uploadDirAbs, pdf_id), JSON.stringify(payloadPages, null, 2), "utf-8");

  return {
    pdf_id,
    status: payloadText.status,
    chars: payloadText.chars,
    created_at: payloadText.created_at,
    meta: payloadText.meta,
  };
}

export async function readExtractedText(uploadDirAbs: string, pdf_id: string) {
  try {
    const raw = await fs.readFile(textOutPath(uploadDirAbs, pdf_id), "utf-8");
    return JSON.parse(raw) as ExtractedTextPayload;
  } catch {
    return null;
  }
}