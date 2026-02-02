import type { FastifyPluginAsync } from "fastify";
import multipart from "@fastify/multipart";
import path from "node:path";
import fs from "node:fs";
import { pipeline } from "node:stream/promises";

import type { Env } from "../env";
import { ensureUploadDir, generatePdfId, getPdfAbsolutePath } from "../services/storage";
import { appendMeta, getMetaById } from "../services/metadata";

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
};

export default pdfsRoutes;