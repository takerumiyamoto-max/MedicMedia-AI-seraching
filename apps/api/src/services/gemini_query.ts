import type { Env } from "../env";
import { GoogleGenAI } from "@google/genai";
import { ApiError } from "./api_error";

export type GeneratedQuery = {
  query: string;
  keywords: string[];
};

// ちょい強めのノイズ除外（必要なら増やせます）
const STOP_WORDS = new Set(
  [
    "the",
    "and",
    "or",
    "for",
    "with",
    "from",
    "this",
    "that",
    "2023",
    "2024",
    "2025",
    "2026",
    "tokyo",
    "university",
    "東京大学",
    "医学部",
    "医学系研究科",
    "講義",
    "資料",
    "スライド",
    "レジュメ",
    "chapter",
    "section",
    "figure",
    "table",
  ].map((s) => s.toLowerCase())
);

function normalizeKeywords(keywords: unknown): string[] {
  const arr = Array.isArray(keywords) ? keywords : [];
  const cleaned = arr
    .map((x) => String(x ?? "").trim())
    .filter((s) => s.length >= 2 && s.length <= 40)
    .map((s) => s.replace(/\s+/g, " "))
    .filter((s) => !STOP_WORDS.has(s.toLowerCase()));

  // 重複除去して最大12個
  return Array.from(new Set(cleaned)).slice(0, 12);
}

function safeJsonParse(text: string): any | null {
  try {
    return JSON.parse(text);
  } catch {
    // Geminiがたまに前後に文字を付けることがあるので救出
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}

export async function generateQueryFromText(env: Env, text: string): Promise<GeneratedQuery> {
  const apiKey = env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new ApiError("VALIDATION_ERROR", "GEMINI_API_KEY is required", 400, {});
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = buildPrompt(text);

  let outText = "";
  try {
    const resp = await ai.models.generateContent({
      // 軽くて速い。精度もっと欲しければ flash→pro 系に変更
      model: "gemini-2.0-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    outText = resp.text ?? "";
  } catch (e: any) {
    throw new ApiError("INTERNAL", "Gemini API call failed", 500, {
      message: e?.message ?? String(e),
    });
  }

  const parsed = safeJsonParse(outText);
  if (!parsed) {
    throw new ApiError("INTERNAL", "Gemini returned non-JSON", 500, { outText });
  }

  const keywords = normalizeKeywords(parsed.keywords);
  const queryRaw = String(parsed.query ?? "").trim();

  // query が空/ノイズなら keywords から組み立て
  const query = queryRaw && queryRaw.length >= 5 ? queryRaw : keywords.join(" ");

  return { keywords, query };
}

function buildPrompt(text: string) {
  // 重要：教材の冒頭にある「大学名」「年度」「THE」等のノイズを拾わないように指示
  return `
あなたは医療系教材（PDF抽出テキスト）から、国家試験の「関連問題」を検索するための検索クエリを作るアシスタントです。

# やること
- 教材テキストを読み、重要な医学キーワードを抽出してください。
- 「大学名・年度・スライド番号・章番号・一般語（THEなど）」は除外してください。
- キーワードは疾患名、病態、免疫細胞/分子、抗体、感染症、検査、治療、略語を優先してください。

# 出力ルール
- 必ず JSON のみを返す（前後に文章を付けない）
- 形式: {"keywords":[...], "query":"..."}
- keywords: 5〜12個
- query: keywordsをスペース区切りで並べた “検索語” （20〜80文字くらい）

# 教材テキスト（先頭部分）
${truncate(text, 9000)}
`.trim();
}

function truncate(s: string, max: number) {
  if (s.length <= max) return s;
  return s.slice(0, max);
}