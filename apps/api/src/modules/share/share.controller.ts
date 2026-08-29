import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export interface ServerShareRecord {
  token: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  wholeFileHash: string;
  chunks: Array<{
    id: string;
    index: number;
    size: number;
    hash: string;
    providerRef?: any;
  }>;
  createdAt: string;
  expiresAt?: string;
  passcode?: string;
}

const shareStore = new Map<string, ServerShareRecord>();

export function registerShareRoutes(fastify: FastifyInstance): void {
  /**
   * POST /api/v1/shares
   * Publishes a share record to the server for universal link access across any device.
   */
  fastify.post('/api/v1/shares', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Partial<ServerShareRecord>;

    if (!body?.token || !body?.fileName || !body?.chunks) {
      return reply.status(400).send({
        statusCode: 400,
        errorCode: 'VALIDATION_ERROR',
        message: 'Share token, fileName, and chunks are required',
      });
    }

    const shareRecord: ServerShareRecord = {
      token: body.token,
      fileId: body.fileId || `file_${Date.now()}`,
      fileName: body.fileName,
      fileSize: Number(body.fileSize) || 0,
      mimeType: body.mimeType || 'application/octet-stream',
      wholeFileHash: body.wholeFileHash || '',
      chunks: body.chunks || [],
      createdAt: body.createdAt || new Date().toISOString(),
      expiresAt: body.expiresAt || undefined,
      passcode: body.passcode || undefined,
    };

    shareStore.set(body.token, shareRecord);

    return reply.status(201).send({
      statusCode: 201,
      success: true,
      token: shareRecord.token,
      url: `/s/${shareRecord.token}`,
      expiresAt: shareRecord.expiresAt,
    });
  });

  /**
   * GET /api/v1/shares/:token
   * Retrieves public metadata for a shared file.
   */
  fastify.get(
    '/api/v1/shares/:token',
    async (request: FastifyRequest<{ Params: { token: string } }>, reply: FastifyReply) => {
      const { token } = request.params;
      const rec = shareStore.get(token);

      if (!rec) {
        return reply.status(404).send({
          statusCode: 404,
          errorCode: 'SHARE_NOT_FOUND',
          message: 'Share link not found or has been revoked',
        });
      }

      // Check expiration: if expiresAt is set and past, revoke
      if (rec.expiresAt && new Date(rec.expiresAt).getTime() <= Date.now()) {
        shareStore.delete(token);
        return reply.status(410).send({
          statusCode: 410,
          errorCode: 'SHARE_EXPIRED',
          message: 'This share link has expired',
        });
      }

      return reply.status(200).send({
        statusCode: 200,
        token: rec.token,
        fileId: rec.fileId,
        fileName: rec.fileName,
        fileSize: rec.fileSize,
        mimeType: rec.mimeType,
        wholeFileHash: rec.wholeFileHash,
        chunks: rec.chunks,
        createdAt: rec.createdAt,
        expiresAt: rec.expiresAt,
        hasPasscode: Boolean(rec.passcode),
      });
    }
  );

  /**
   * POST /api/v1/shares/:token/verify
   * Validates passcode for protected shared links.
   */
  fastify.post(
    '/api/v1/shares/:token/verify',
    async (
      request: FastifyRequest<{ Params: { token: string }; Body: { passcode?: string } }>,
      reply: FastifyReply
    ) => {
      const { token } = request.params;
      const rec = shareStore.get(token);

      if (!rec) {
        return reply.status(404).send({
          statusCode: 404,
          errorCode: 'SHARE_NOT_FOUND',
          message: 'Share link not found',
        });
      }

      if (rec.expiresAt && new Date(rec.expiresAt).getTime() <= Date.now()) {
        shareStore.delete(token);
        return reply.status(410).send({
          statusCode: 410,
          errorCode: 'SHARE_EXPIRED',
          message: 'Share link has expired',
        });
      }

      if (rec.passcode && rec.passcode !== request.body?.passcode) {
        return reply.status(401).send({
          statusCode: 401,
          errorCode: 'INVALID_PASSCODE',
          message: 'Incorrect passcode for protected share',
        });
      }

      return reply.status(200).send({
        statusCode: 200,
        success: true,
        fileId: rec.fileId,
        fileName: rec.fileName,
        fileSize: rec.fileSize,
        mimeType: rec.mimeType,
        wholeFileHash: rec.wholeFileHash,
        chunks: rec.chunks,
      });
    }
  );
}
