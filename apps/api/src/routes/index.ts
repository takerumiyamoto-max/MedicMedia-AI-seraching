// apps/api/src/routes/index.ts
import type { FastifyInstance } from "fastify";

import healthRoutes from "./health";
import pdfRoutes from "./pdfs";
import searchRoutes from "./search";

export default async function routes(app: FastifyInstance) {
  await app.register(healthRoutes);
  await app.register(pdfRoutes);
  await app.register(searchRoutes);
}