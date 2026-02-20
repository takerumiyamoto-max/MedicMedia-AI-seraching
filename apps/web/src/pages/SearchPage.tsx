// apps/web/src/pages/SearchPage.tsx
import { useMemo, useState } from "react";
import { uploadPdf, type PdfMeta } from "../api/pdfs";
import { searchMaterialAuto } from "../api/search";
import type { SearchMaterialAutoResponse, AutoSearchHit } from "../api/types";

function humanizeError(code?: string) {
  switch (code) {
    case "NOT_FOUND":
      return "ファイルが見つかりません（pdf_id が間違っている可能性があります）。";
    case "NOT_EXTRACTED":
      return "このPDFはまだ抽出（extract）されていません。";
    case "NOT_CHUNKED":
      return "このPDFはまだチャンク化されていません。";
    case "VALIDATION_ERROR":
      return "入力内容を確認してください。";
    case "INTERNAL":
      return "サーバーエラーが発生しました。";
    default:
      return "エラーが発生しました。";
  }
}

type UiPhase = "idle" | "uploading" | "searching" | "done" | "error";

export default function SearchPage() {
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<UiPhase>("idle");
  const [pdfMeta, setPdfMeta] = useState<PdfMeta | null>(null);

  const [topK, setTopK] = useState<number>(5);

  const [generated, setGenerated] = useState<{ query: string; keywords: string[] } | null>(null);
  const [hits, setHits] = useState<AutoSearchHit[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const canRun = useMemo(() => !!file && phase !== "uploading" && phase !== "searching", [file, phase]);

  async function runAutoFlow() {
    if (!file) return;

    setErrorMsg("");
    setGenerated(null);
    setHits([]);
    setPdfMeta(null);

    try {
      setPhase("uploading");
      const meta = await uploadPdf(file);
      setPdfMeta(meta);

      setPhase("searching");
      const res = await searchMaterialAuto({ pdf_id: meta.pdf_id, top_k: topK });

      if (res.ok === false) {
        setPhase("error");
        setErrorMsg(`${humanizeError(res.error.code)} (${res.error.code}) ${res.error.message}`);
        return;
      }

      setGenerated(res.generated);
      setHits(res.hits);
      setPhase("done");
    } catch (e: any) {
      // fetch失敗など
      setPhase("error");
      const code = e?.error?.code ?? e?.code;
      const msg =
        e?.error?.message ??
        e?.message ??
        "unknown error";
      setErrorMsg(`${humanizeError(code)} ${msg}`);
    }
  }

  return (
    <div style={{ padding: 16, maxWidth: 980, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>Search (Auto)</h1>

      <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            top_k
            <input
              type="number"
              min={1}
              max={50}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              style={{ width: 80 }}
            />
          </label>

          <button
            onClick={runAutoFlow}
            disabled={!canRun}
            style={{
              padding: "8px 12px",
              borderRadius: 10,
              border: "1px solid #ccc",
              background: canRun ? "#fff" : "#f3f3f3",
              cursor: canRun ? "pointer" : "not-allowed",
              fontWeight: 600,
            }}
          >
            アップロードして自動検索
          </button>

          <span style={{ fontSize: 13, color: "#666" }}>
            {phase === "uploading" && "アップロード中…"}
            {phase === "searching" && "検索中…"}
            {phase === "done" && "完了"}
            {phase === "error" && "エラー"}
          </span>
        </div>

        {pdfMeta && (
          <div style={{ marginTop: 10, fontSize: 13, color: "#333" }}>
            <div>
              <b>pdf_id:</b> {pdfMeta.pdf_id}
            </div>
          </div>
        )}

        {errorMsg && (
          <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: "#fff2f2", color: "#a40000" }}>
            {errorMsg}
          </div>
        )}
      </div>

      {generated && (
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Generated query</div>
          <div style={{ fontSize: 13, color: "#333", whiteSpace: "pre-wrap" }}>{generated.query}</div>
          <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
            keywords: {generated.keywords.join(", ")}
          </div>
        </div>
      )}

      <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 10 }}>
          Hits {hits.length > 0 ? `(${hits.length})` : ""}
        </div>

        {hits.length === 0 && phase === "done" && (
          <div style={{ color: "#666", fontSize: 13 }}>該当する問題が見つかりませんでした。</div>
        )}

        <div style={{ display: "grid", gap: 10 }}>
          {hits.map((h) => (
            <div key={h.question_id} style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" }}>
                <div style={{ fontWeight: 700 }}>
                  {h.question_id} — {h.title}
                </div>
                <div style={{ fontSize: 12, color: "#666" }}>score: {h.score}</div>
              </div>

              <pre
                style={{
                  marginTop: 8,
                  fontSize: 12,
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.5,
                  color: "#333",
                }}
              >
                {h.snippet}
              </pre>

              {h.meta && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#666" }}>
                  {Object.entries(h.meta)
                    .slice(0, 6)
                    .map(([k, v]) => `${k}=${String(v)}`)
                    .join(" / ")}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}