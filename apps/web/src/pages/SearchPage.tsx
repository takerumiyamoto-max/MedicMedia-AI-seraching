import { useMemo, useState } from "react";
import { searchMaterial } from "../api/search";
import type { SearchMaterialResponse } from "../api/types";

function humanizeError(code?: string) {
  switch (code) {
    case "NOT_CHUNKED":
      return "このPDFはまだチャンク化されていません。先にチャンク化してください。";
    case "VALIDATION_ERROR":
      return "入力内容を確認してください。";
    case "NOT_FOUND":
      return "指定した pdf_id が見つかりません。";
    case "NOT_EXTRACTED":
      return "このPDFはまだ抽出（extract）されていません。";
    case "INTERNAL":
      return "サーバーエラーが発生しました。";
    default:
      return "エラーが発生しました。";
  }
}

export default function SearchPage() {
  const [pdfId, setPdfId] = useState("");
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState<number>(5);

  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<SearchMaterialResponse | null>(null);
  const requestId = resp?.request_id ?? null;
  const isOk = resp?.ok === true;
  const isErr = resp?.ok === false;

  const errCode = isErr ? resp.error.code : null;
  const errRawMessage = isErr ? resp.error.message : null;
  const errHumanMessage = errCode ? humanizeError(errCode) : null;

  const errorMessage = useMemo(() => {
    if (!resp || resp.ok) return null;
    return humanizeError(resp.error.code);
  }, [resp]);

  const onSearch = async () => {
    setLoading(true);
    setResp(null);
    try {
      const r = await searchMaterial({
        pdf_id: pdfId.trim(),
        query: query.trim(),
        top_k: topK,
      });
      setResp(r);
    } catch (e) {
      // fetchやJSON parse失敗など、API以外のエラー
      setResp({
        ok: false,
        request_id: "client_error",
        error: {
          code: "INTERNAL",
          message: e instanceof Error ? e.message : "Unknown error",
          details: {},
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, marginBottom: 12 }}>Material Search</h1>

      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 120px 120px" }}>
        <div style={{ gridColumn: "1 / 3" }}>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>pdf_id</label>
          <input
            value={pdfId}
            onChange={(e) => setPdfId(e.target.value)}
            placeholder="613d408d-..."
            style={{ width: "100%", padding: 8 }}
          />
        </div>

        <div>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>top_k</label>
          <input
            type="number"
            value={topK}
            min={1}
            max={20}
            onChange={(e) => setTopK(Number(e.target.value))}
            style={{ width: "100%", padding: 8 }}
          />
        </div>

        <div style={{ alignSelf: "end" }}>
          <button
            onClick={onSearch}
            disabled={loading}
            style={{ width: "100%", padding: 10, cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        <div style={{ gridColumn: "1 / 5" }}>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>query</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="例：高IgM症候群 / Hyper IgM / IgM 高値"
            style={{ width: "100%", padding: 8 }}
          />
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        {requestId && (
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
                request_id: <code>{requestId}</code>
            </div>
            )}

        {errorMessage && (
          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Error</div>
            <div>{errorMessage}</div>
            {isErr && (
            <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12 }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Error</div>
                <div>{errHumanMessage ?? "エラーが発生しました。"}</div>
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                code: <code>{errCode}</code>
                {errRawMessage ? (
                    <>
                    {" "} / message: <code>{errRawMessage}</code>
                    </>
                ) : null}
                </div>
            </div>
            )}
          </div>
        )}

        {isOk && (
            <div>
                <div style={{ marginBottom: 10, fontSize: 14 }}>
                hit_count: <b>{resp.hit_count}</b>（chunk_size={resp.chunk_size}, overlap={resp.overlap}）
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                {resp.hits.map((h) => (
                    <div key={h.chunk_id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
                    {/* ここは元のまま */}
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, opacity: 0.9 }}>
                        <span>page: {h.page_start}{h.page_end !== h.page_start ? `-${h.page_end}` : ""}</span>
                        <span>score: {h.score}</span>
                        <span>chunk_id: <code>{h.chunk_id}</code></span>
                    </div>
                    <div style={{ marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
                        {h.snippet}
                    </div>
                    </div>
                ))}
                {resp.hits.length === 0 && (
                    <div style={{ padding: 12, border: "1px solid #eee", borderRadius: 8 }}>
                    ヒットがありません（queryの表記ゆれを変えて試してください）
                    </div>
                )}
                </div>
            </div>
            )}
      </div>
    </div>
  );
}