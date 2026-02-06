import Fastify from "fastify";
import cors from "@fastify/cors";
import routes from "./routes";
import { env } from "./env";

const app = Fastify({ logger: true });
(app as any).env = env;

// ★ await を付けない
app.register(cors, { origin: true });

app.register(routes);

app.listen({ port: env.PORT, host: env.HOST }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`listening at ${address}`);
});