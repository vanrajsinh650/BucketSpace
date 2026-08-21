import fs from 'node:fs';
import path from 'node:path';

// Load .env from root if present
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../../../.env'),
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    const lines = fs.readFileSync(p, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
    break;
  }
}

import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import fastifyWebsocket from '@fastify/websocket';
import { registerTelegramRoutes } from './modules/telegram/telegram.controller';
import { registerMediaRoutes } from './modules/media/media.controller';
import { registerWebSocketRoutes } from './modules/websocket/websocket.controller';
import { registerSyncRoutes } from './modules/sync/sync.controller';
import { registerEnterpriseRoutes } from './modules/enterprise/enterprise.controller';
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
  // In dev, allow any localhost port (Next.js may shift from 3000 to 3001/3002).
  // In production, restrict strictly via CORS_ORIGINS env var.
  const isDev = (process.env.NODE_ENV || 'development') === 'development';
  const corsOrigin = isDev
    ? (origin: string | undefined, cb: (err: Error | null, allow: boolean) => void) => {
        // Allow all localhost origins in dev — never blocks shifted dev ports
        if (!origin || /^http:\/\/localhost(:\d+)?$/.test(origin)) {
          cb(null, true);
        } else {
          cb(new Error('Not allowed by CORS'), false);
        }
      }
    : (process.env.CORS_ORIGINS
        ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
        : ['http://localhost:3000']);

  await server.register(cors, {
    origin: corsOrigin,
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
    phase: 'Phase 4 - Enterprise Automation & Governance',
    timestamp: new Date().toISOString(),
  }));

  // --- Feature routes ---
  registerTelegramRoutes(server);
  registerMediaRoutes(server);
  registerWebSocketRoutes(server);
  registerSyncRoutes(server);
  registerEnterpriseRoutes(server);

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
