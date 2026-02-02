import Fastify, { type FastifyInstance } from 'fastify';
import { healthRoute } from './routes/health.js';
import type { Env } from './env.js';

export function buildApp(env: Env): FastifyInstance {
  const app = Fastify({
    logger:
      env.NODE_ENV === 'development'
        ? {
            level: env.LOG_LEVEL,
            transport: {
              target: 'pino-pretty',
              options: { translateTime: 'SYS:standard', singleLine: true }
            }
          }
        : { level: env.LOG_LEVEL }
  });

  // ルート登録
  app.register(healthRoute);

  // 404 をJSONで返す（フロントと合わせやすい）
  app.setNotFoundHandler(async (_req, reply) => {
    reply.code(404).send({ error: 'Not Found' });
  });

  return app;
}