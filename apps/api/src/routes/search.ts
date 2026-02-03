import type { FastifyPluginAsync } from "fastify";
import path from "node:path";
import type { Env } from "../env";
import { searchMaterial } from "../services/material_search";
import { ensureUploadDir } from "../services/storage";

const searchRoutes: FastifyPluginAsync = async (app) => {
  const env = (app as any).env as Env;
  const uploadDirAbs = path.resolve(process.cwd(), env.UPLOAD_DIR);
  ensureUploadDir(uploadDirAbs);

  // POST /search/material
  app.post("/search/material", async (req, reply) => {
    const body = req.body as { pdf_id?: string; query?: string; top_k?: number };

    const pdf_id = body.pdf_id?.trim();
    const query = body.query?.trim() ?? "";
    const topK = body.top_k ?? 5;

    if (!pdf_id) return reply.code(400).send({ error: "pdf_id is required" });

    const result = await searchMaterial(uploadDirAbs, pdf_id, query, topK);
    if (!result) return reply.code(409).send({ error: "not chunked yet" });

    return reply.send({
      pdf_id,
      query,
      top_k: topK,
      chunk_size: result.chunked.chunk_size,
      overlap: result.chunked.overlap,
      hit_count: result.hits.length,
      hits: result.hits,
    });
  });
};

export default searchRoutes;