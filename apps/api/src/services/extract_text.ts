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

function textOutPath(uploadDirAbs: string, pdf_id: string) {
  return path.join(uploadDirAbs, `${pdf_id}.text.json`);
}

async function extractTextWithPdfjs(pdfAbsPath: string) {
  const buf = await fs.readFile(pdfAbsPath);
  const data = new Uint8Array(buf);

  const loadingTask = pdfjs.getDocument({ data });
  const doc = await loadingTask.promise;

  let fullText = "";
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((it: any) => (typeof it.str === "string" ? it.str : ""))
      .join(" ");
    fullText += pageText + "\n";
  }

  return { text: fullText.trim(), pageCount: doc.numPages };
}

export async function extractPdfToText(uploadDirAbs: string, pdf_id: string, pdfAbsPath: string) {
  const { text, pageCount } = await extractTextWithPdfjs(pdfAbsPath);

  const payload: ExtractedTextPayload = {
    pdf_id,
    status: "EXTRACTED_TEXT",
    chars: text.length,
    meta: { page_count: pageCount },
    text,
    created_at: new Date().toISOString(),
  };

  await fs.writeFile(textOutPath(uploadDirAbs, pdf_id), JSON.stringify(payload, null, 2), "utf-8");

  return {
    pdf_id,
    status: payload.status,
    chars: payload.chars,
    created_at: payload.created_at,
    meta: payload.meta,
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