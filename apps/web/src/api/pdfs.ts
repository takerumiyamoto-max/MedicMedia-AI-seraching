const API_BASE =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") || "http://127.0.0.1:3001";

export type PdfMeta = {
  pdf_id: string;
  filename: string;
  size: number;
  stored_relpath: string;
  created_at: string;
};

export async function uploadPdf(file: File): Promise<PdfMeta> {
  const fd = new FormData();
  // BEは req.file() を使っていて field名は何でもOKだが、一般的に "file" に統一
  fd.append("file", file, file.name);

  const res = await fetch(`${API_BASE}/pdfs`, { method: "POST", body: fd });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) throw new Error(data?.error ?? `Upload failed (${res.status})`);
  return data as PdfMeta;
}

export async function extractPdf(pdf_id: string): Promise<any> {
  const res = await fetch(`${API_BASE}/pdfs/${pdf_id}/extract`, { method: "POST" });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error ?? `Extract failed (${res.status})`);
  return data;
}

export async function chunkPdf(
  pdf_id: string,
  params?: { chunk_size?: number; overlap?: number }
): Promise<{ pdf_id: string; chunk_size: number; overlap: number; chunk_count: number; created_at: string }> {
  const res = await fetch(`${API_BASE}/pdfs/${pdf_id}/chunk`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params ?? {}),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error ?? `Chunk failed (${res.status})`);
  return data;
}