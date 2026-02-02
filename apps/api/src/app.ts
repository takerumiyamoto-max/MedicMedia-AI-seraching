import Fastify from "fastify";
import { type Env, loadEnv } from "./env";

import healthRoutes from "./routes/health";
import pdfsRoutes from "./routes/pdfs";

export function buildApp(env: Env = loadEnv()) {
  const app = Fastify({
    logger: { level: env.LOG_LEVEL },
  });

  app.decorate("env", env);

  app.register(healthRoutes);
  app.register(pdfsRoutes);

  return app;
}

export default buildApp();