import { useMemo, useState } from "react";
import { searchMaterial } from "../api/search";
import type { SearchMaterialResponse } from "../api/types";
import { uploadPdf, extractPdf, chunkPdf, type PdfMeta } from "../api/pdfs";

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
  // --- Search inputs
  const [query, setQuery] = useState("");
  const [topK, setTopK] = useState<number>(5);

  // --- PDF state
  const [pdfMeta, setPdfMeta] = useState<PdfMeta | null>(null);
  const [chunkInfo, setChunkInfo] = useState<{
    chunk_size: number;
    overlap: number;
    chunk_count: number;
  } | null>(null);

  // --- UI state
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false); // search loading
  const [stageError, setStageError] = useState<string | null>(null); // upload/extract/chunk errors
  const [resp, setResp] = useState<SearchMaterialResponse | null>(null);

  // --- Derived values (for TS narrowing)
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

  const canSearch = !!pdfMeta?.pdf_id && !uploading;

  async function handleFile(file: File) {
    setStageError(null);
    setResp(null);
    setChunkInfo(null);

    // PDFのみ
    const isPdfMime = file.type === "application/pdf";
    const isPdfExt = file.name.toLowerCase().endsWith(".pdf");
    if (!isPdfMime && !isPdfExt) {
      setStageError("PDFファイルのみアップロードできます。");
      return;
    }

    setUploading(true);
    try {
      // 1) upload
      const meta = await uploadPdf(file);
      setPdfMeta(meta);

      // 2) extract
      await extractPdf(meta.pdf_id);

      // 3) chunk (default params)
      const chunked = await chunkPdf(meta.pdf_id, { chunk_size: 800, overlap: 150 });
      setChunkInfo({
        chunk_size: chunked.chunk_size,
        overlap: chunked.overlap,
        chunk_count: chunked.chunk_count,
      });
    } catch (e) {
      setStageError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  }

  const onSearch = async () => {
    setStageError(null);
    setLoading(true);
    setResp(null);

    try {
      const pdf_id = pdfMeta?.pdf_id?.trim();
      if (!pdf_id) {
        setStageError("先にPDFをアップロードしてください。");
        return;
      }

      const r = await searchMaterial({
        pdf_id,
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

      {/* Upload area */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        style={{
          border: "2px dashed #bbb",
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>PDFをドラッグ&ドロップ</div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>
              またはファイル選択（upload → extract → chunk を自動実行）
            </div>
          </div>

          <div>
            <input
              type="file"
              accept="application/pdf"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
        </div>

        {uploading && <div style={{ marginTop: 10, fontSize: 12 }}>処理中…（upload → extract → chunk）</div>}

        {pdfMeta && (
          <div style={{ marginTop: 10, fontSize: 12 }}>
            pdf_id: <code>{pdfMeta.pdf_id}</code> / {pdfMeta.filename}（{Math.round(pdfMeta.size / 1024)} KB）
          </div>
        )}

        {chunkInfo && (
          <div style={{ marginTop: 6, fontSize: 12 }}>
            chunked: {chunkInfo.chunk_count}（size={chunkInfo.chunk_size}, overlap={chunkInfo.overlap}）
          </div>
        )}

        {stageError && (
          <div style={{ marginTop: 10, padding: 10, border: "1px solid #f2c6c6", borderRadius: 10 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Upload/Process Error</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{stageError}</div>
          </div>
        )}
      </div>

      {/* Search inputs */}
      <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr 120px 120px" }}>
        <div style={{ gridColumn: "1 / 3" }}>
          <label style={{ display: "block", fontSize: 12, marginBottom: 4 }}>pdf_id（自動）</label>
          <input
            value={pdfMeta?.pdf_id ?? ""}
            readOnly
            placeholder="PDFをアップロードすると自動で入ります"
            style={{ width: "100%", padding: 8, background: "#f7f7f7" }}
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
            disabled={loading || !canSearch}
            style={{
              width: "100%",
              padding: 10,
              cursor: loading || !canSearch ? "not-allowed" : "pointer",
            }}
            title={!pdfMeta?.pdf_id ? "先にPDFをアップロードしてください" : uploading ? "処理が終わるまでお待ちください" : ""}
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

      {/* Response area */}
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
          </div>
        )}

        {isErr && (
          <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Details</div>
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

        {isOk && (
          <div>
            <div style={{ marginBottom: 10, fontSize: 14 }}>
              hit_count: <b>{resp.hit_count}</b>（chunk_size={resp.chunk_size}, overlap={resp.overlap}）
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              {resp.hits.map((h) => (
                <div key={h.chunk_id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 12 }}>
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 12, opacity: 0.9 }}>
                    <span>
                      page: {h.page_start}
                      {h.page_end !== h.page_start ? `-${h.page_end}` : ""}
                    </span>
                    <span>score: {h.score}</span>
                    <span>
                      chunk_id: <code>{h.chunk_id}</code>
                    </span>
                  </div>
                  <div style={{ marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.45 }}>{h.snippet}</div>
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