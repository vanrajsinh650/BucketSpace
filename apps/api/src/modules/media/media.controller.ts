import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '@bucketspace/db';
import { TelegramStorageAdapter, GCPStorageAdapter, AzureBlobStorageAdapter, S3StorageAdapter } from '@bucketspace/storage-adapters';
import { ProviderType } from '@bucketspace/shared';

/* ------------------------------------------------------------------ */
/*  Media Stream & HLS Transcoding Controller                          */
/* ------------------------------------------------------------------ */

export function registerMediaRoutes(server: FastifyInstance): void {
  /**
   * GET /api/v1/media/hls/:fileId/playlist.m3u8
   * Generates dynamic HLS (HTTP Live Streaming) M3U8 index playlist for video files.
   */
  server.get(
    '/api/v1/media/hls/:fileId/playlist.m3u8',
    async (request: FastifyRequest<{ Params: { fileId: string } }>, reply: FastifyReply) => {
      const { fileId } = request.params;

      const file = await prisma.fileObject.findUnique({
        where: { id: fileId },
        include: {
          bucket: true,
          chunks: { orderBy: { chunkIndex: 'asc' } },
        },
      });

      if (!file) {
        return reply.status(404).send({ error: 'FILE_NOT_FOUND', message: `File ${fileId} not found` });
      }

      // Generate dynamic HLS M3U8 Manifest
      const targetDuration = 10;
      let manifest = '#EXTM3U\n';
      manifest += '#EXT-X-VERSION:3\n';
      manifest += `#EXT-X-TARGETDURATION:${targetDuration}\n`;
      manifest += '#EXT-X-MEDIA-SEQUENCE:0\n';

      const chunkCount = file.chunks.length > 0 ? file.chunks.length : 1;

      for (let i = 0; i < chunkCount; i++) {
        manifest += `#EXTINF:${targetDuration}.0,\n`;
        manifest += `/api/v1/media/hls/${fileId}/segment/${i}\n`;
      }

      manifest += '#EXT-X-ENDLIST\n';

      return reply
        .header('Content-Type', 'application/x-mpegURL')
        .header('Cache-Control', 'public, max-age=3600')
        .send(manifest);
    }
  );

  /**
   * GET /api/v1/media/hls/:fileId/segment/:chunkIndex
   * Streams a specific video chunk segment.
   */
  server.get(
    '/api/v1/media/hls/:fileId/segment/:chunkIndex',
    async (
      request: FastifyRequest<{ Params: { fileId: string; chunkIndex: string } }>,
      reply: FastifyReply
    ) => {
      const { fileId, chunkIndex } = request.params;
      const index = parseInt(chunkIndex, 10);

      const file = await prisma.fileObject.findUnique({
        where: { id: fileId },
        include: {
          bucket: true,
          chunks: { where: { chunkIndex: index } },
        },
      });

      if (!file) {
        return reply.status(404).send({ error: 'FILE_NOT_FOUND' });
      }

      const chunk = file.chunks[0];
      const provider = file.bucket.provider;

      let stream;
      if (provider === ProviderType.GCP_STORAGE) {
        const adapter = new GCPStorageAdapter();
        stream = await adapter.getChunkStream(file.bucket.targetChannelId, chunk?.telegramFileId || `${fileId}.part${index}`);
      } else if (provider === ProviderType.AZURE_BLOB) {
        const adapter = new AzureBlobStorageAdapter();
        stream = await adapter.getChunkStream(file.bucket.targetChannelId, chunk?.telegramFileId || `${fileId}.part${index}`);
      } else if (provider === ProviderType.AWS_S3 || provider === ProviderType.CLOUDFLARE_R2) {
        const adapter = new S3StorageAdapter();
        stream = await adapter.getChunkStream(file.bucket.targetChannelId, chunk?.telegramFileId || `${fileId}.part${index}`);
      } else {
        const botToken = process.env.TELEGRAM_BOT_TOKEN || 'dummy-token';
        const adapter = new TelegramStorageAdapter({ botToken });
        stream = chunk
          ? await adapter.getChunkStream(file.bucket.targetChannelId, chunk.telegramFileId)
          : null;
      }

      if (!stream) {
        // Dev stream fallback snippet
        return reply
          .header('Content-Type', 'video/MP2T')
          .send(Buffer.from(`[HLS TS Segment ${index} for file ${fileId}]`));
      }

      return reply
        .header('Content-Type', 'video/MP2T')
        .header('Cache-Control', 'public, max-age=86400')
        .send(stream);
    }
  );

  /**
   * GET /api/v1/media/thumbnail/:fileId
   * Dynamic thumbnail / poster image endpoint for UI video and image previews.
   */
  server.get(
    '/api/v1/media/thumbnail/:fileId',
    async (request: FastifyRequest<{ Params: { fileId: string } }>, reply: FastifyReply) => {
      const { fileId } = request.params;

      const file = await prisma.fileObject.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        return reply.status(404).send({ error: 'FILE_NOT_FOUND' });
      }

      // Generate dynamic SVG poster preview thumbnail
      const fileExt = file.filename.split('.').pop()?.toUpperCase() || 'FILE';
      const isVideo = file.mimeType.startsWith('video/');
      const bgGradient = isVideo
        ? 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)'
        : 'linear-gradient(135deg, #0284c7 0%, #0d9488 100%)';

      const svgThumbnail = `
        <svg xmlns="http://www.w3.org/2000/svg" width="400" height="250" viewBox="0 0 400 250">
          <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="${isVideo ? '#4f46e5' : '#0284c7'}" />
              <stop offset="100%" stop-color="${isVideo ? '#7c3aed' : '#0d9488'}" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#bg)" rx="12" />
          <circle cx="200" cy="110" r="40" fill="rgba(255,255,255,0.15)" />
          ${
            isVideo
              ? '<polygon points="190,95 220,110 190,125" fill="#ffffff" />'
              : '<path d="M185 95h30v30h-30z" fill="#ffffff"/>'
          }
          <text x="200" y="180" font-family="sans-serif" font-size="16" font-weight="bold" fill="#ffffff" text-anchor="middle">
            ${file.filename.length > 28 ? file.filename.slice(0, 25) + '...' : file.filename}
          </text>
          <text x="200" y="205" font-family="sans-serif" font-size="12" fill="rgba(255,255,255,0.7)" text-anchor="middle">
            ${fileExt} • ${(Number(file.sizeBytes) / (1024 * 1024)).toFixed(1)} MB
          </text>
        </svg>
      `.trim();

      return reply
        .header('Content-Type', 'image/svg+xml')
        .header('Cache-Control', 'public, max-age=86400')
        .send(svgThumbnail);
    }
  );
}
