import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DirectUploadPresignSchema } from '@bucketspace/shared';
import { TelegramStorageAdapter } from '@bucketspace/storage-adapters';

export function registerTelegramRoutes(fastify: FastifyInstance): void {
  /**
   * POST /api/v1/telegram/upload/initiate
   * Initializes a Telegram Drive upload session for a file payload
   */
  fastify.post('/api/v1/telegram/upload/initiate', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = DirectUploadPresignSchema.safeParse(request.body);

    if (!parseResult.success) {
      return reply.status(400).send({
        statusCode: 400,
        errorCode: 'VALIDATION_ERROR',
        message: 'Invalid upload initiation payload',
        details: parseResult.error.flatten(),
      });
    }

    const input = parseResult.data;

    // Calculate part chunk size (Standard: 20MB per Telegram Bot API chunk)
    const PART_SIZE_BYTES = 20 * 1024 * 1024;
    const totalChunks = Math.ceil(input.sizeBytes / PART_SIZE_BYTES);

    return reply.status(200).send({
      statusCode: 200,
      fileId: crypto.randomUUID(),
      workspaceId: input.workspaceId,
      channelId: input.channelId,
      filename: input.filename,
      partSizeBytes: PART_SIZE_BYTES,
      totalChunks,
      uploadStatus: 'PENDING_UPLOAD',
    });
  });

  /**
   * GET /api/v1/telegram/stream/:fileId/:chunkIndex
   * Streams a document chunk directly from Telegram Cloud Storage
   */
  fastify.get(
    '/api/v1/telegram/stream/:telegramFileId',
    async (request: FastifyRequest<{ Params: { telegramFileId: string } }>, reply: FastifyReply) => {
      const { telegramFileId } = request.params;
      const botToken = process.env.TELEGRAM_BOT_TOKEN;

      if (!botToken) {
        return reply.status(500).send({
          statusCode: 500,
          errorCode: 'CONFIG_ERROR',
          message: 'TELEGRAM_BOT_TOKEN environment variable is not configured',
        });
      }

      try {
        const adapter = new TelegramStorageAdapter({ botToken });
        const stream = await adapter.getChunkStream('', telegramFileId);

        reply.header('Content-Type', 'application/octet-stream');
        return reply.send(stream);
      } catch (err) {
        request.log.error({ err, telegramFileId }, 'Failed to stream Telegram file chunk');
        return reply.status(502).send({
          statusCode: 502,
          errorCode: 'STORAGE_PROVIDER_ERROR',
          message: (err as Error).message || 'Failed to download Telegram chunk',
        });
      }
    }
  );
}
