import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyWebsocket from '@fastify/websocket';
import { registerTelegramRoutes } from './modules/telegram/telegram.controller';
import { registerMediaRoutes } from './modules/media/media.controller';
import { registerWebSocketRoutes } from './modules/websocket/websocket.controller';
import { prisma } from '@bucketspace/db';

/* ------------------------------------------------------------------ */
/*  Server Instance                                                    */
/* ------------------------------------------------------------------ */

const server = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

/* ------------------------------------------------------------------ */
/*  Bootstrap                                                          */
/* ------------------------------------------------------------------ */

async function main(): Promise<void> {
  // --- CORS (restrict in production, permissive in dev) ---
  const allowedOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost:3000'];

  await server.register(cors, {
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // --- Multipart file upload support ---
  await server.register(multipart, {
    limits: {
      fileSize: 25 * 1024 * 1024, // 25 MB per part (with headroom over 20 MB chunks)
      files: 1,                    // one file per request
    },
  });

  // --- Real-time WebSocket plugin ---
  await server.register(fastifyWebsocket);

  // --- Health probe ---
  server.get('/healthz', async () => ({
    status: 'OK',
    service: 'bucketspace-api',
    phase: 'Phase 2 - Advanced Sync & Media Streaming',
    timestamp: new Date().toISOString(),
  }));

  // --- Feature routes ---
  registerTelegramRoutes(server);
  registerMediaRoutes(server);
  registerWebSocketRoutes(server);

  // --- Start listening ---
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

/* ------------------------------------------------------------------ */
/*  Graceful Shutdown                                                  */
/*  Ensures inflight requests complete and DB connections are closed.  */
/* ------------------------------------------------------------------ */

async function shutdown(signal: string): Promise<void> {
  server.log.info(`Received ${signal} — shutting down gracefully...`);

  try {
    await server.close();           // Stop accepting new requests, drain inflight
    await prisma.$disconnect();     // Close database connection pool
    server.log.info('Shutdown complete');
    process.exit(0);
  } catch (err) {
    server.log.error(err, 'Error during shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

main();
