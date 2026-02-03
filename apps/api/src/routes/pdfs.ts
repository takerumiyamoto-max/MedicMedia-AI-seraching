import type { FastifyPluginAsync } from "fastify";
import multipart from "@fastify/multipart";
import path from "node:path";
import fs from "node:fs";
import { pipeline } from "node:stream/promises";
import type { Env } from "../env";
import { ensureUploadDir, generatePdfId, getPdfAbsolutePath } from "../services/storage";
import { appendMeta, getMetaById } from "../services/metadata";
import { extractPdfToPages, readExtracted } from "../services/extract";
import { buildChunksForPdf, readChunks } from "../services/chunk";

const pdfsRoutes: FastifyPluginAsync = async (app) => {
  // app.decorate("env", env) している想定（buildAppで）
  const env = (app as any).env as Env;

  const uploadDirAbs = path.resolve(process.cwd(), env.UPLOAD_DIR);
  ensureUploadDir(uploadDirAbs);

  await app.register(multipart, {
    limits: {
      fileSize: env.MAX_UPLOAD_MB * 1024 * 1024,
    },
  });

  // POST /pdfs
  app.post("/pdfs", async (req, reply) => {
    const part = await req.file(); // field名は何でもOK。curlは file=... なのでfileになる
    if (!part) return reply.code(400).send({ error: "file is required" });

    const isPdfMime = part.mimetype === "application/pdf";
    const isPdfExt = path.extname(part.filename).toLowerCase() === ".pdf";
    if (!isPdfMime && !isPdfExt) {
      return reply.code(400).send({ error: "Only PDF files are allowed" });
    }

    const pdf_id = generatePdfId();
    const absPath = getPdfAbsolutePath(uploadDirAbs, pdf_id);

    // streamを保存
    await pipeline(part.file, fs.createWriteStream(absPath));

    const stored_relpath = path.relative(process.cwd(), absPath);
    const stat = fs.statSync(absPath);

    const meta = await appendMeta(uploadDirAbs, {
      pdf_id,
      filename: part.filename,
      size: stat.size,
      stored_relpath,
      created_at: new Date().toISOString(),
    });

    return reply.code(201).send(meta);
  });

  // GET /pdfs/:pdf_id
  app.get("/pdfs/:pdf_id", async (req, reply) => {
    const { pdf_id } = req.params as { pdf_id: string };
    const meta = await getMetaById(uploadDirAbs, pdf_id);
    if (!meta) return reply.code(404).send({ error: "not found" });
    return reply.send(meta);
  });

  // POST /pdfs/:pdf_id/extract
  app.post("/pdfs/:pdf_id/extract", async (req, reply) => {
    const { pdf_id } = req.params as { pdf_id: string };

    const meta = await getMetaById(uploadDirAbs, pdf_id);
    if (!meta) return reply.code(404).send({ error: "not found" });

    const pdfAbsPath = path.resolve(process.cwd(), meta.stored_relpath);

    try {
        const result = await extractPdfToPages(uploadDirAbs, pdf_id, pdfAbsPath);
        return reply.send(result);
    } catch (e: any) {
        return reply.code(500).send({ error: String(e?.message ?? e) });
    }
    });

  // GET /pdfs/:pdf_id/pages
  app.get("/pdfs/:pdf_id/pages", async (req, reply) => {
    const { pdf_id } = req.params as { pdf_id: string };

    const extracted = await readExtracted(uploadDirAbs, pdf_id);
    if (!extracted) return reply.code(404).send({ error: "not extracted" });

    return reply.send(extracted);
    });

  // POST /pdfs/:pdf_id/chunk
  app.post("/pdfs/:pdf_id/chunk", async (req, reply) => {
    const { pdf_id } = req.params as { pdf_id: string };
    const body = (req.body ?? {}) as { chunk_size?: number; overlap?: number };

    // 抽出済みでないとchunk化できない
    const chunked = await buildChunksForPdf(uploadDirAbs, pdf_id, {
        chunk_size: body.chunk_size,
        overlap: body.overlap,
    });

    if (!chunked) return reply.code(409).send({ error: "not extracted yet" });

    return reply.send({
        pdf_id,
        chunk_size: chunked.chunk_size,
        overlap: chunked.overlap,
        chunk_count: chunked.chunks.length,
        created_at: chunked.created_at,
    });
    });

    // GET /pdfs/:pdf_id/chunks（確認用）
  app.get("/pdfs/:pdf_id/chunks", async (req, reply) => {
    const { pdf_id } = req.params as { pdf_id: string };
    const chunked = await readChunks(uploadDirAbs, pdf_id);
    if (!chunked) return reply.code(404).send({ error: "not chunked" });
    return reply.send(chunked);
});
};


export default pdfsRoutes;