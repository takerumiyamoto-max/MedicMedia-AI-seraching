import type { Env } from "../env";
import { ensureExtracted, ensureChunked, getPdfRepresentativeText } from "./pdf_pipeline.js";
import { generateQueryFromText } from "./gemini_query.js";
import { searchQuestionsAuto } from "./questions_search.js";

export type AutoSearchRequest = {
  pdf_id: string;
  top_k?: number;
};

export type AutoSearchHit = {
  question_id: string;
  title: string;
  snippet: string;
  score: number;
  meta?: Record<string, unknown>;
};

export type AutoSearchResponse = {
  pdf_id: string;
  generated: { query: string; keywords: string[] };
  hits: AutoSearchHit[];
};

export async function autoSearchMaterial(
  uploadDirAbs: string,
  env: Env,
  req: AutoSearchRequest
): Promise<AutoSearchResponse> {
  const topK = clampInt(req.top_k ?? 10, 1, 50);
  const pdf_id = req.pdf_id.trim();

  // 1) 冪等パイプライン（未実施なら実行）
  await ensureExtracted(uploadDirAbs, pdf_id);
  await ensureChunked(uploadDirAbs, pdf_id, { chunk_size: 800, overlap: 150 });

  // 2) PDF代表テキスト
  const repText = await getPdfRepresentativeText(uploadDirAbs, pdf_id);

  // 3) “検索用クエリ” を生成（今は仮実装、後でGeminiに置換）
  const generated = await generateQueryFromText(env, repText);

  // 4) 問題CSVから検索
  const hits = await searchQuestionsAuto(uploadDirAbs, env, {
    query: generated.query,
    keywords: generated.keywords,
    top_k: topK,
  });

  return { pdf_id, generated, hits };
}

function clampInt(x: number, min: number, max: number) {
  const n = Math.floor(Number.isFinite(x) ? x : min);
  return Math.min(max, Math.max(min, n));
}