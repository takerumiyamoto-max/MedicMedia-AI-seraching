import type { Env } from "../env";

export type GeneratedQuery = {
  query: string;
  keywords: string[];
};

/**
 * PR05: まずは仮実装（Geminiに置き換える前提）
 * - text先頭から “それっぽい単語” を拾って query を作る
 */
export async function generateQueryFromText(_env: Env, text: string): Promise<GeneratedQuery> {
  const head = text.slice(0, 2500);

  // 超簡易：英数字/単語ベース（日本語は弱い → 後でGeminiに置換）
  const words = head
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3);

  const keywords = Array.from(new Set(words)).slice(0, 10);
  const query = keywords.join(" ");

  return { query, keywords };
}