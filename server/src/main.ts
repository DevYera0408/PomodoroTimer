import Fastify from 'fastify';
import { healthRoutes } from './routes/health.js';

const app = Fastify({ logger: true });

// PORT from env; invalid values fall back to 3000 so a typo cannot crash the shell script.
const port = Number.parseInt(process.env.PORT ?? '', 10) || 3000;

await app.register(healthRoutes, { prefix: '/api/v1' });

try {
  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`listening on http://localhost:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
