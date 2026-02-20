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
      return "このPDFはまだ抽出（extract）されていません。先に抽出してください。";
    case "INTERNAL":
      return "サーバーエラーが発生しました。";
    default:
      return "エラーが発生しました。";
  }
}

function fmtJson(x: unknown) {
  try {
    return JSON.stringify(x, null, 2);
  } catch {
    return String(x);
  }
}

type Stage = "idle" | "upload" | "extract" | "chunk" | "search";

export default function SearchPage() {
  const [file, setFile] = useState<File | null>(null);
  const [pdf, setPdf] = useState<PdfMeta | null>(null);

  const [query, setQuery] = useState<string>("");
  const [topK, setTopK] = useState<number>(5);
  const [chunkSize, setChunkSize] = useState<number>(800);
  const [overlap, setOverlap] = useState<number>(150);

  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<{ code?: string; message: string; raw?: unknown } | null>(null);

  const [extractRes, setExtractRes] = useState<any>(null);
  const [chunkRes, setChunkRes] = useState<any>(null);
  const [searchRes, setSearchRes] = useState<SearchMaterialResponse | null>(null);

  const canExtract = useMemo(() => !!pdf?.pdf_id, [pdf]);
  const canChunk = useMemo(() => !!pdf?.pdf_id, [pdf]);
  const canSearch = useMemo(() => !!pdf?.pdf_id && query.trim().length > 0, [pdf, query]);

  function resetOutputs() {
    setError(null);
    setExtractRes(null);
    setChunkRes(null);
    setSearchRes(null);
  }

  function setErr(e: any, fallback = "エラーが発生しました。") {
    const code = e?.code ?? e?.error?.code ?? e?.response?.data?.code;
    const message =
      e?.message ??
      e?.error?.message ??
      e?.response?.data?.message ??
      (typeof e === "string" ? e : fallback);

    setError({ code, message, raw: e });
  }

  async function onUpload() {
    if (!file) return;
    resetOutputs();
    setStage("upload");
    try {
      const meta = await uploadPdf(file); // PdfMeta を返す想定
      setPdf(meta);
    } catch (e) {
      setErr(e, "アップロードに失敗しました。");
    } finally {
      setStage("idle");
    }
  }

  async function onExtract() {
    if (!pdf?.pdf_id) return;
    setError(null);
    setStage("extract");
    try {
      const res = await extractPdf(pdf.pdf_id);
      setExtractRes(res);
    } catch (e) {
      setErr(e, "テキスト抽出に失敗しました。");
    } finally {
      setStage("idle");
    }
  }

  async function onChunk() {
    if (!pdf?.pdf_id) return;
    setError(null);
    setStage("chunk");
    try {
      const res = await chunkPdf(pdf.pdf_id, { chunk_size: chunkSize, overlap });
      setChunkRes(res);
    } catch (e) {
      setErr(e, "チャンク化に失敗しました。");
    } finally {
      setStage("idle");
    }
  }

  async function onSearch() {
    if (!pdf?.pdf_id) return;
    if (!query.trim()) return;
    setError(null);
    setStage("search");
    try {
      const res = await searchMaterial({
        pdf_id: pdf.pdf_id,
        query: query.trim(),
        top_k: topK,
      });
      setSearchRes(res);
    } catch (e) {
      setErr(e, "検索に失敗しました。");
    } finally {
      setStage("idle");
    }
  }

  function copyPdfId() {
    if (!pdf?.pdf_id) return;
    navigator.clipboard?.writeText(pdf.pdf_id).catch(() => {});
  }

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">教材検索（PR04デモ）</h1>
        <p className="text-sm text-slate-600">
          upload → extract → chunk → search/material をUIで通すためのテスト画面
        </p>
      </header>

      {/* Upload */}
      <section className="rounded-xl border bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">1) Upload</h2>
          <div className="text-xs text-slate-500">対応: pdf / png / jpeg</div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="file"
            accept="application/pdf,image/png,image/jpeg"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button
            className="rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-40"
            disabled={!file || stage !== "idle"}
            onClick={onUpload}
          >
            {stage === "upload" ? "Uploading..." : "Upload"}
          </button>
        </div>

        {pdf?.pdf_id && (
          <div className="rounded-lg bg-slate-50 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">pdf_id</div>
              <button
                className="rounded-md border px-2 py-1 text-xs hover:bg-white"
                onClick={copyPdfId}
              >
                Copy
              </button>
            </div>
            <div className="mt-1 font-mono break-all">{pdf.pdf_id}</div>
            {"filename" in (pdf as any) && (pdf as any).filename ? (
              <div className="mt-1 text-xs text-slate-600">file: {(pdf as any).filename}</div>
            ) : null}
          </div>
        )}
      </section>

      {/* Actions */}
      <section className="rounded-xl border bg-white p-4 space-y-4">
        <h2 className="text-lg font-medium">2) Extract / 3) Chunk / 4) Search</h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Extract */}
          <div className="rounded-xl border p-3 space-y-3">
            <div className="font-medium">2) Extract</div>
            <button
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-40"
              disabled={!canExtract || stage !== "idle"}
              onClick={onExtract}
            >
              {stage === "extract" ? "Extracting..." : "Extract text"}
            </button>
            {extractRes && (
              <details className="text-xs">
                <summary className="cursor-pointer text-slate-700">response</summary>
                <pre className="mt-2 overflow-auto rounded-lg bg-slate-50 p-2">
                  {fmtJson(extractRes)}
                </pre>
              </details>
            )}
          </div>

          {/* Chunk */}
          <div className="rounded-xl border p-3 space-y-3">
            <div className="font-medium">3) Chunk</div>

            <label className="block text-xs text-slate-600">
              chunk_size
              <input
                type="number"
                className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                value={chunkSize}
                min={200}
                max={5000}
                onChange={(e) => setChunkSize(Number(e.target.value))}
              />
            </label>

            <label className="block text-xs text-slate-600">
              overlap
              <input
                type="number"
                className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                value={overlap}
                min={0}
                max={2000}
                onChange={(e) => setOverlap(Number(e.target.value))}
              />
            </label>

            <button
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-40"
              disabled={!canChunk || stage !== "idle"}
              onClick={onChunk}
            >
              {stage === "chunk" ? "Chunking..." : "Chunk"}
            </button>

            {chunkRes && (
              <details className="text-xs">
                <summary className="cursor-pointer text-slate-700">response</summary>
                <pre className="mt-2 overflow-auto rounded-lg bg-slate-50 p-2">
                  {fmtJson(chunkRes)}
                </pre>
              </details>
            )}
          </div>

          {/* Search */}
          <div className="rounded-xl border p-3 space-y-3">
            <div className="font-medium">4) Search</div>

            <label className="block text-xs text-slate-600">
              query
              <input
                type="text"
                className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="例）高IgM / 遺伝子解析 意義 など"
              />
            </label>

            <label className="block text-xs text-slate-600">
              top_k
              <input
                type="number"
                className="mt-1 w-full rounded-md border px-2 py-1 text-sm"
                value={topK}
                min={1}
                max={50}
                onChange={(e) => setTopK(Number(e.target.value))}
              />
            </label>

            <button
              className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white disabled:opacity-40"
              disabled={!canSearch || stage !== "idle"}
              onClick={onSearch}
            >
              {stage === "search" ? "Searching..." : "Search"}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="font-medium text-red-900">Error</div>
            <div className="mt-1 text-sm text-red-900">
              {humanizeError(error.code)}{" "}
              <span className="text-red-700">({error.code ?? "UNKNOWN"})</span>
            </div>
            <details className="mt-2 text-xs text-red-900">
              <summary className="cursor-pointer">raw</summary>
              <pre className="mt-2 overflow-auto rounded-lg bg-white p-2">
                {fmtJson(error.raw ?? error)}
              </pre>
            </details>
          </div>
        )}
      </section>

      {/* Search Results */}
      <section className="rounded-xl border bg-white p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium">検索結果</h2>
          <div className="text-xs text-slate-500">
            {searchRes ? `hits: ${(searchRes as any).hits?.length ?? (searchRes as any).results?.length ?? "?"}` : "—"}
          </div>
        </div>

        {!searchRes ? (
          <p className="text-sm text-slate-600">まだ検索していません。</p>
        ) : (
          <div className="space-y-3">
            {(() => {
              const hits =
                (searchRes as any).hits ??
                (searchRes as any).results ??
                (searchRes as any).items ??
                [];
              if (!Array.isArray(hits) || hits.length === 0) {
                return <p className="text-sm text-slate-600">結果がありません。</p>;
              }
              return hits.map((h: any, idx: number) => (
                <div key={idx} className="rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">
                        {h.title ?? h.heading ?? `Hit ${idx + 1}`}
                      </div>
                      <div className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">
                        {h.snippet ?? h.text ?? h.content ?? h.chunk_text ?? ""}
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-xs text-slate-500">
                      {typeof h.score === "number" ? (
                        <div>score: {h.score.toFixed(3)}</div>
                      ) : null}
                      {h.page != null ? <div>page: {h.page}</div> : null}
                      {h.chunk_index != null ? <div>chunk: {h.chunk_index}</div> : null}
                    </div>
                  </div>

                  <details className="mt-2 text-xs text-slate-600">
                    <summary className="cursor-pointer">raw</summary>
                    <pre className="mt-2 overflow-auto rounded-lg bg-slate-50 p-2">
                      {fmtJson(h)}
                    </pre>
                  </details>
                </div>
              ));
            })()}
          </div>
        )}

        {searchRes && (
          <details className="text-xs">
            <summary className="cursor-pointer text-slate-700">search response (full)</summary>
            <pre className="mt-2 overflow-auto rounded-lg bg-slate-50 p-2">{fmtJson(searchRes)}</pre>
          </details>
        )}
      </section>
    </div>
  );
}