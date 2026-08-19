import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { DirectUploadPresignSchema, TelegramChunkUploadSchema } from '@bucketspace/shared';
import { TelegramAuthService, TelegramStorageAdapter } from '@bucketspace/storage-adapters';
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

  const botToken = process.env.TELEGRAM_BOT_TOKEN ?? 'dummy_token';
  const defaultChatId = process.env.TELEGRAM_STORAGE_CHAT_ID ?? '@bucketspace_channel';

  adapterInstance = new TelegramStorageAdapter({ botToken, defaultChatId });
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

      const ref = await adapter.putChunk({
        chunkId: `chunk-${input.fileId}-${input.chunkIndex}`,
        size: chunkBuffer.byteLength,
        hash: 'hash-placeholder',
        data: (async function* () {
          yield chunkBuffer;
        })(),
      });

      // Persist the chunk record
      await prisma.fileChunk.create({
        data: {
          fileId: input.fileId,
          chunkIndex: input.chunkIndex,
          providerRef: JSON.stringify(ref.reference),
          providerMeta: {},
          partSizeBytes: BigInt(chunkBuffer.byteLength),
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
        chunkIndex: input.chunkIndex,
        providerRef: JSON.stringify(ref.reference),
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
        const stream = await adapter.getChunk({
          providerId: 'telegram',
          reference: { chatId: '@bucketspace_channel', messageId: 1, fileId: telegramFileId },
        });

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

  /* ---------------------------------------------------------------- */
  /*  POST /api/v1/telegram/auth/send-code                            */
  /*  Initiates MTProto phone verification with real Telegram code.   */
  /* ---------------------------------------------------------------- */
  fastify.post(
    '/api/v1/telegram/auth/send-code',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { phone?: string; apiId?: number; apiHash?: string };
      if (!body?.phone) {
        return reply.status(400).send({
          statusCode: 400,
          errorCode: 'VALIDATION_ERROR',
          message: 'Phone number is required',
        });
      }

      try {
        const result = await TelegramAuthService.sendCode({
          phone: body.phone,
          apiId: body.apiId,
          apiHash: body.apiHash,
        });

        return reply.status(200).send({
          statusCode: 200,
          success: true,
          sessionToken: result.sessionToken,
          phoneCodeHash: result.phoneCodeHash,
          isCodeViaApp: result.isCodeViaApp,
        });
      } catch (err: any) {
        request.log.error(err, 'Failed to send Telegram MTProto verification code');
        return reply.status(400).send({
          statusCode: 400,
          errorCode: 'TELEGRAM_AUTH_ERROR',
          message: err?.message || 'Failed to send verification code from Telegram',
        });
      }
    }
  );

  /* ---------------------------------------------------------------- */
  /*  POST /api/v1/telegram/auth/verify-code                          */
  /*  Verifies the 5-digit OTP code received on Telegram.             */
  /* ---------------------------------------------------------------- */
  fastify.post(
    '/api/v1/telegram/auth/verify-code',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { sessionToken?: string; code?: string };
      if (!body?.sessionToken || !body?.code) {
        return reply.status(400).send({
          statusCode: 400,
          errorCode: 'VALIDATION_ERROR',
          message: 'Session token and verification code are required',
        });
      }

      try {
        const result = await TelegramAuthService.verifyCode({
          sessionToken: body.sessionToken,
          code: body.code,
        });

        return reply.status(200).send({
          statusCode: 200,
          success: result.success,
          sessionString: result.sessionString,
          requires2FA: result.requires2FA,
        });
      } catch (err: any) {
        request.log.error(err, 'Failed to verify Telegram MTProto code');
        return reply.status(400).send({
          statusCode: 400,
          errorCode: 'TELEGRAM_AUTH_ERROR',
          message: err?.message || 'Invalid or expired verification code',
        });
      }
    }
  );

  /* ---------------------------------------------------------------- */
  /*  POST /api/v1/telegram/auth/verify-2fa                           */
  /*  Verifies the Telegram 2FA cloud password if enabled.            */
  /* ---------------------------------------------------------------- */
  fastify.post(
    '/api/v1/telegram/auth/verify-2fa',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = request.body as { sessionToken?: string; password?: string };
      if (!body?.sessionToken || !body?.password) {
        return reply.status(400).send({
          statusCode: 400,
          errorCode: 'VALIDATION_ERROR',
          message: 'Session token and 2FA password are required',
        });
      }

      try {
        const result = await TelegramAuthService.verify2FA({
          sessionToken: body.sessionToken,
          password: body.password,
        });

        return reply.status(200).send({
          statusCode: 200,
          success: result.success,
          sessionString: result.sessionString,
        });
      } catch (err: any) {
        request.log.error(err, 'Failed to verify Telegram 2FA password');
        return reply.status(400).send({
          statusCode: 400,
          errorCode: 'TELEGRAM_AUTH_ERROR',
          message: err?.message || 'Invalid 2FA password',
        });
      }
    }
  );

  /* ---------------------------------------------------------------- */
  /*  GET /api/v1/telegram/auth/session-check                         */
  /*  Validates whether a stored MTProto session is still connected.  */
  /* ---------------------------------------------------------------- */
  fastify.get(
    '/api/v1/telegram/auth/session-check',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as { sessionString?: string };
      const sessionString = query.sessionString || (request.headers['x-telegram-session'] as string);

      if (!sessionString) {
        return reply.status(400).send({
          statusCode: 400,
          errorCode: 'VALIDATION_ERROR',
          message: 'sessionString is required for session check',
        });
      }

      const result = await TelegramAuthService.checkSession(sessionString);
      return reply.status(200).send({
        statusCode: 200,
        valid: result.valid,
        user: result.user,
      });
    }
  );

  /* ---------------------------------------------------------------- */
  /*  POST /api/v1/telegram/mtproto/chunk                             */
  /*  Direct MTProto 2.0 binary chunk upload to Telegram Saved Msgs.  */
  /* ---------------------------------------------------------------- */
  fastify.post(
    '/api/v1/telegram/mtproto/chunk',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const multipartData = await request.file();
      if (!multipartData) {
        return reply.status(400).send({
          statusCode: 400,
          errorCode: 'MISSING_FILE',
          message: 'Multipart chunk file is required',
        });
      }

      const fields = multipartData.fields as Record<string, { value?: string }>;
      const sessionString = fields['sessionString']?.value || (request.headers['x-telegram-session'] as string);
      const chunkId = fields['chunkId']?.value || `chk_${Date.now()}`;
      const filename = fields['filename']?.value || multipartData.filename || `chunk_${chunkId}.bin`;
      const targetChatId = fields['targetChatId']?.value || 'me';

      if (!sessionString) {
        return reply.status(401).send({
          statusCode: 401,
          errorCode: 'UNAUTHORIZED',
          message: 'Telegram MTProto sessionString is required',
        });
      }

      try {
        const chunkBuffer = await multipartData.toBuffer();
        const refData = await TelegramAuthService.uploadChunk({
          sessionString,
          chunkId,
          buffer: chunkBuffer,
          filename,
          targetChatId,
        });

        return reply.status(201).send({
          statusCode: 201,
          success: true,
          providerId: 'telegram',
          chunkId,
          reference: refData,
        });
      } catch (err: any) {
        request.log.error(err, `Failed to upload MTProto chunk ${chunkId}`);
        return reply.status(500).send({
          statusCode: 500,
          errorCode: 'TELEGRAM_UPLOAD_ERROR',
          message: err?.message || 'Failed to upload chunk to Telegram MTProto storage',
        });
      }
    }
  );

  /* ---------------------------------------------------------------- */
  /*  GET /api/v1/telegram/mtproto/chunk                              */
  /*  Direct MTProto 2.0 binary chunk download from Telegram DC.      */
  /* ---------------------------------------------------------------- */
  fastify.get(
    '/api/v1/telegram/mtproto/chunk',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as {
        sessionString?: string;
        messageId?: string;
        targetChatId?: string;
      };

      const sessionString = query.sessionString || (request.headers['x-telegram-session'] as string);
      const messageId = Number(query.messageId);
      const targetChatId = query.targetChatId || 'me';

      if (!sessionString || !messageId) {
        return reply.status(400).send({
          statusCode: 400,
          errorCode: 'VALIDATION_ERROR',
          message: 'sessionString and messageId are required',
        });
      }

      try {
        const buffer = await TelegramAuthService.downloadChunk({
          sessionString,
          messageId,
          targetChatId,
        });

        reply.header('Content-Type', 'application/octet-stream');
        reply.header('Content-Length', buffer.length);
        return reply.send(buffer);
      } catch (err: any) {
        request.log.error(err, `Failed to download MTProto chunk message #${messageId}`);
        return reply.status(500).send({
          statusCode: 500,
          errorCode: 'TELEGRAM_DOWNLOAD_ERROR',
          message: err?.message || 'Failed to download chunk from Telegram MTProto storage',
        });
      }
    }
  );

  /* ---------------------------------------------------------------- */
  /*  DELETE /api/v1/telegram/mtproto/chunk                           */
  /*  Deletes chunk message from Telegram chat.                       */
  /* ---------------------------------------------------------------- */
  fastify.delete(
    '/api/v1/telegram/mtproto/chunk',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const body = (request.body || request.query) as {
        sessionString?: string;
        messageId?: number | string;
        targetChatId?: string;
      };

      const sessionString = body?.sessionString || (request.headers['x-telegram-session'] as string);
      const messageId = Number(body?.messageId);
      const targetChatId = body?.targetChatId || 'me';

      if (!sessionString || !messageId) {
        return reply.status(400).send({
          statusCode: 400,
          errorCode: 'VALIDATION_ERROR',
          message: 'sessionString and messageId are required',
        });
      }

      try {
        await TelegramAuthService.deleteChunk({
          sessionString,
          messageId,
          targetChatId,
        });

        return reply.status(200).send({
          statusCode: 200,
          success: true,
          message: `Chunk message #${messageId} purged from Telegram`,
        });
      } catch (err: any) {
        request.log.error(err, `Failed to purge MTProto chunk #${messageId}`);
        return reply.status(500).send({
          statusCode: 500,
          errorCode: 'TELEGRAM_PURGE_ERROR',
          message: err?.message || 'Failed to purge chunk from Telegram',
        });
      }
    }
  );
}

