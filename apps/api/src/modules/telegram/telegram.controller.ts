import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DirectUploadPresignSchema, TelegramChunkUploadSchema } from '@bucketspace/shared';
import { TelegramStorageAdapter } from '@bucketspace/storage-adapters';
import { prisma } from '@bucketspace/db';

/* ------------------------------------------------------------------ */
/*  Singleton adapter — instantiated once, reused across all requests  */
/* ------------------------------------------------------------------ */

let adapterInstance: TelegramStorageAdapter | null = null;

/**
 * Returns the shared TelegramStorageAdapter, creating it on first call.
 * Throws early if the required env var is missing.
 */
function getAdapter(): TelegramStorageAdapter {
  if (adapterInstance) return adapterInstance;

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    throw new Error('TELEGRAM_BOT_TOKEN environment variable is not configured');
  }

  adapterInstance = new TelegramStorageAdapter({ botToken });
  return adapterInstance;
}

/* ------------------------------------------------------------------ */
/*  Route Registration                                                 */
/* ------------------------------------------------------------------ */

export function registerTelegramRoutes(fastify: FastifyInstance): void {
  /* ---------------------------------------------------------------- */
  /*  POST /api/v1/telegram/upload/initiate                           */
  /*  Creates a FileObject record and returns chunking instructions.   */
  /* ---------------------------------------------------------------- */
  fastify.post(
    '/api/v1/telegram/upload/initiate',
    async (request: FastifyRequest, reply: FastifyReply) => {
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

      // Standard chunk size: 20 MB per Telegram Bot API part
      const PART_SIZE_BYTES = 20 * 1024 * 1024;
      const totalChunks = Math.ceil(input.sizeBytes / PART_SIZE_BYTES);

      // Lookup the bucket to get a valid bucketId
      const bucket = await prisma.bucket.findFirst({
        where: {
          workspaceId: input.workspaceId,
          targetChannelId: input.channelId,
        },
      });

      if (!bucket) {
        return reply.status(404).send({
          statusCode: 404,
          errorCode: 'BUCKET_NOT_FOUND',
          message: `No bucket found for workspace "${input.workspaceId}" with channel "${input.channelId}"`,
        });
      }

      // Persist the file record so chunks can reference it later
      const fileObject = await prisma.fileObject.create({
        data: {
          workspaceId: input.workspaceId,
          bucketId: bucket.id,
          filename: input.filename,
          sizeBytes: BigInt(input.sizeBytes),
          mimeType: input.mimeType,
          sha256Hash: input.sha256Hash ?? null,
          status: 'PENDING_UPLOAD',
        },
      });

      return reply.status(201).send({
        statusCode: 201,
        fileId: fileObject.id,
        workspaceId: input.workspaceId,
        channelId: input.channelId,
        filename: input.filename,
        partSizeBytes: PART_SIZE_BYTES,
        totalChunks,
        uploadStatus: 'PENDING_UPLOAD',
      });
    }
  );

  /* ---------------------------------------------------------------- */
  /*  POST /api/v1/telegram/upload/chunk                              */
  /*  Receives a binary chunk, pushes it to Telegram, saves metadata. */
  /* ---------------------------------------------------------------- */
  fastify.post(
    '/api/v1/telegram/upload/chunk',
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Parse the multipart form — file data + JSON metadata fields
      const multipartData = await request.file();
      if (!multipartData) {
        return reply.status(400).send({
          statusCode: 400,
          errorCode: 'MISSING_FILE',
          message: 'Request must include a multipart file field',
        });
      }

      // Extract metadata from multipart fields
      const fields = multipartData.fields as Record<string, { value?: string }>;
      const metaPayload = {
        fileId: fields['fileId']?.value,
        chunkIndex: Number(fields['chunkIndex']?.value),
        totalChunks: Number(fields['totalChunks']?.value),
        partSizeBytes: Number(fields['partSizeBytes']?.value),
      };

      const parseResult = TelegramChunkUploadSchema.safeParse(metaPayload);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          errorCode: 'VALIDATION_ERROR',
          message: 'Invalid chunk upload metadata',
          details: parseResult.error.flatten(),
        });
      }

      const input = parseResult.data;

      // Verify the parent file record exists and is in an uploadable state
      const fileObject = await prisma.fileObject.findUnique({
        where: { id: input.fileId },
        include: { bucket: true },
      });

      if (!fileObject) {
        return reply.status(404).send({
          statusCode: 404,
          errorCode: 'FILE_NOT_FOUND',
          message: `File record "${input.fileId}" does not exist`,
        });
      }

      if (fileObject.status !== 'PENDING_UPLOAD' && fileObject.status !== 'UPLOADING') {
        return reply.status(409).send({
          statusCode: 409,
          errorCode: 'INVALID_FILE_STATE',
          message: `File is in "${fileObject.status}" state and cannot accept chunks`,
        });
      }

      // Collect the file stream into a buffer for the Telegram adapter
      const chunkBuffer = await multipartData.toBuffer();
      const adapter = getAdapter();

      const result = await adapter.uploadChunk(
        fileObject.bucket.targetChannelId,
        {
          chunkIndex: input.chunkIndex,
          partBuffer: chunkBuffer,
          filename: fileObject.filename,
          mimeType: fileObject.mimeType,
        }
      );

      // Persist the chunk record
      await prisma.fileChunk.create({
        data: {
          fileId: input.fileId,
          chunkIndex: result.chunkIndex,
          providerRef: result.providerRef,
          providerMeta: result.providerMeta as Record<string, string | number>,
          partSizeBytes: BigInt(result.sizeBytes),
        },
      });

      // Transition file status to UPLOADING (or PROCESSED if this is the last chunk)
      const isLastChunk = input.chunkIndex === input.totalChunks - 1;

      // Count how many chunks we've stored (including this one)
      const storedChunkCount = await prisma.fileChunk.count({
        where: { fileId: input.fileId },
      });
      const allChunksReceived = storedChunkCount === input.totalChunks;

      await prisma.fileObject.update({
        where: { id: input.fileId },
        data: {
          status: allChunksReceived ? 'PROCESSED' : 'UPLOADING',
        },
      });

      return reply.status(200).send({
        statusCode: 200,
        fileId: input.fileId,
        chunkIndex: result.chunkIndex,
        providerRef: result.providerRef,
        uploadComplete: allChunksReceived,
        storedChunks: storedChunkCount,
        totalChunks: input.totalChunks,
      });
    }
  );

  /* ---------------------------------------------------------------- */
  /*  GET /api/v1/telegram/stream/:telegramFileId                     */
  /*  Streams a chunk directly from Telegram cloud storage.            */
  /* ---------------------------------------------------------------- */
  fastify.get(
    '/api/v1/telegram/stream/:telegramFileId',
    async (
      request: FastifyRequest<{ Params: { telegramFileId: string } }>,
      reply: FastifyReply
    ) => {
      const { telegramFileId } = request.params;

      // Basic param validation — Telegram file IDs are non-empty alphanumeric strings
      if (!telegramFileId || !/^[\w\-]+$/.test(telegramFileId)) {
        return reply.status(400).send({
          statusCode: 400,
          errorCode: 'INVALID_PARAM',
          message: 'telegramFileId must be a non-empty alphanumeric string',
        });
      }

      try {
        const adapter = getAdapter();
        const stream = await adapter.getChunkStream('', telegramFileId);

        // Look up the original filename for a proper Content-Disposition header
        const chunk = await prisma.fileChunk.findFirst({
          where: { providerRef: telegramFileId },
          include: { file: { select: { filename: true, mimeType: true } } },
        });

        const filename = chunk?.file?.filename ?? 'download';
        const mimeType = chunk?.file?.mimeType ?? 'application/octet-stream';

        reply.header('Content-Type', mimeType);
        reply.header(
          'Content-Disposition',
          `attachment; filename="${encodeURIComponent(filename)}"`
        );

        return reply.send(stream);
      } catch (err) {
        request.log.error({ err, telegramFileId }, 'Failed to stream Telegram file chunk');
        return reply.status(502).send({
          statusCode: 502,
          errorCode: 'STORAGE_PROVIDER_ERROR',
          message: (err as Error).message || 'Failed to download chunk from Telegram',
        });
      }
    }
  );
}
