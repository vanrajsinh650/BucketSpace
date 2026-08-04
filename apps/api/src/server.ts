import Fastify from 'fastify';
import cors from '@fastify/cors';
import { registerTelegramRoutes } from './modules/telegram/telegram.controller';

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

async function main(): Promise<void> {
  // Register CORS
  await server.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Health probe
  server.get('/healthz', async () => ({
    status: 'OK',
    service: 'bucketspace-api',
    timestamp: new Date().toISOString(),
  }));

  // Register Modules
  registerTelegramRoutes(server);

  const port = Number(process.env.PORT) || 4000;
  const host = process.env.HOST || '0.0.0.0';

  try {
    await server.listen({ port, host });
    server.log.info(`BucketSpace API Gateway running on http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();
