// apps/web/src/api/search.ts
import type { SearchMaterialResponse, SearchMaterialAutoResponse } from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3001";

// 既存：/search/material
export async function searchMaterial(params: { pdf_id: string; query: string; top_k?: number }) {
  const res = await fetch(`${API_BASE}/search/material`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });

  const json = (await res.json()) as SearchMaterialResponse;

  if (!res.ok || (json as any).ok === false) {
    throw json;
  }
  return json;
}

// ✅ 追加：/search/material/auto
export async function searchMaterialAuto(params: { pdf_id: string; top_k?: number }) {
  const res = await fetch(`${API_BASE}/search/material/auto`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
  });

  const json = (await res.json()) as SearchMaterialAutoResponse;

  if (!res.ok || (json as any).ok === false) {
    throw json;
  }
  return json;
}