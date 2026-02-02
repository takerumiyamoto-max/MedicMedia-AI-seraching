import { loadEnv } from './env.js';
import { buildApp } from './app.js';

const env = loadEnv();
const app = buildApp(env);

try {
  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`API server listening on http://${env.HOST}:${env.PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}