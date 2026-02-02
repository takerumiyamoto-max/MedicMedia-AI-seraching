import fs from "node:fs/promises";
import path from "node:path";

export type PdfMeta = {
  pdf_id: string;
  filename: string;
  size: number;
  stored_relpath: string; // "uploads/xxxx.pdf" のように相対で保持
  created_at: string; // ISO
};

function metaFilePath(uploadDirAbs: string) {
  // uploads/metadata.json
  return path.join(uploadDirAbs, "metadata.json");
}

async function readAll(uploadDirAbs: string): Promise<PdfMeta[]> {
  try {
    const p = metaFilePath(uploadDirAbs);
    const raw = await fs.readFile(p, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PdfMeta[]) : [];
  } catch (e: any) {
    if (e?.code === "ENOENT") return [];
    throw e;
  }
}

// 簡易的なatomic write（tmpに書いてrename）
async function writeAll(uploadDirAbs: string, metas: PdfMeta[]) {
  const p = metaFilePath(uploadDirAbs);
  const tmp = `${p}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(metas, null, 2), "utf-8");
  await fs.rename(tmp, p);
}

export async function appendMeta(uploadDirAbs: string, meta: PdfMeta) {
  const metas = await readAll(uploadDirAbs);
  metas.push(meta);
  await writeAll(uploadDirAbs, metas);
  return meta;
}

export async function getMetaById(uploadDirAbs: string, pdf_id: string) {
  const metas = await readAll(uploadDirAbs);
  return metas.find((m) => m.pdf_id === pdf_id) ?? null;
}