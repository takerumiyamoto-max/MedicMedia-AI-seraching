import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

export type StoredPdf = {
  pdf_id: string;
  stored_path: string; // absolute path
};

export function ensureUploadDir(uploadDir: string) {
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
}

export function getUploadDirFromEnv() {
  // 好きに固定でもOK: path.resolve(process.cwd(), "uploads")
  return process.env.UPLOAD_DIR
    ? path.resolve(process.env.UPLOAD_DIR)
    : path.resolve(process.cwd(), "uploads");
}

export function generatePdfId() {
  return randomUUID(); // uuid v4相当
}

export function getPdfAbsolutePath(uploadDir: string, pdf_id: string) {
  return path.join(uploadDir, `${pdf_id}.pdf`);
}