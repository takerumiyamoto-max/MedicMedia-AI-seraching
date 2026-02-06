import type { FastifyPluginAsync } from "fastify";
import path from "node:path";
import crypto from "node:crypto";
import type { Env } from "../env";
import { searchMaterial } from "../services/material_search";
import { ensureUploadDir } from "../services/storage";
import { ApiError, isApiError } from "../services/api_error";

const searchRoutes: FastifyPluginAsync = async (app) => {
  const env = (app as any).env as Env;
  const uploadDirAbs = path.resolve(process.cwd(), env.UPLOAD_DIR);
  ensureUploadDir(uploadDirAbs);

  // POST /search/material
  app.post("/search/material", async (req, reply) => {
    const request_id = crypto.randomUUID();

    try {
      const body = req.body as { pdf_id?: string; query?: string; top_k?: number };

      const pdf_id = body.pdf_id?.trim();
      const query = body.query?.trim() ?? "";
      const topK = body.top_k ?? 5;

      // --- validation（最低限）
      if (!pdf_id) {
        throw new ApiError(
          "VALIDATION_ERROR",
          "pdf_id is required",
          400,
          { field: "pdf_id" }
        );
      }
      if (!query) {
        throw new ApiError(
          "VALIDATION_ERROR",
          "query is required",
          400,
          { field: "query" }
        );
      }
      if (!Number.isFinite(topK) || topK < 1 || topK > 20) {
        throw new ApiError(
          "VALIDATION_ERROR",
          "top_k must be a number between 1 and 20",
          400,
          { field: "top_k", value: body.top_k }
        );
      }

      const result = await searchMaterial(uploadDirAbs, pdf_id, query, topK);

      return reply.send({
        ok: true,
        request_id,
        pdf_id,
        query,
        top_k: topK,
        chunk_size: result.chunked.chunk_size,
        overlap: result.chunked.overlap,
        hit_count: result.hits.length,
        hits: result.hits,
      });
    } catch (err) {
      if (isApiError(err)) {
        return reply.code(err.status).send({
          ok: false,
          request_id,
          error: {
            code: err.code,
            message: err.message,
            details: err.details ?? {},
          },
        });
      }

      // 予期せぬエラー
      app.log.error({ err, request_id }, "Unhandled error in /search/material");
      return reply.code(500).send({
        ok: false,
        request_id,
        error: {
          code: "INTERNAL",
          message: "Internal server error",
          details: {},
        },
      });
    }
  });
};

export default searchRoutes;