import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { AISearchQuerySchema } from '@bucketspace/shared';
import { multimodalAIService } from './ai.service';
import { prisma } from '@bucketspace/db';

/* ------------------------------------------------------------------ */
/*  Multimodal AI Controller Routes                                    */
/* ------------------------------------------------------------------ */

export function registerAIRoutes(fastify: FastifyInstance): void {
  /**
   * POST /api/v1/ai/search
   * Executes Multimodal Semantic Vector Search across Visual CLIP,
   * Whisper Speech Transcripts, and Document OCR Text.
   */
  fastify.post(
    '/api/v1/ai/search',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = AISearchQuerySchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          errorCode: 'VALIDATION_ERROR',
          message: 'Invalid AI search payload',
          details: parseResult.error.flatten(),
        });
      }

      const input = parseResult.data;

      try {
        const results = await multimodalAIService.search(
          input.workspaceId,
          input.query,
          input.mode,
          input.topK,
          input.minScore
        );

        return reply.status(200).send({
          statusCode: 200,
          query: input.query,
          mode: input.mode,
          totalMatches: results.length,
          results,
        });
      } catch (err) {
        request.log.error({ err }, 'Multimodal AI search failed');
        return reply.status(500).send({
          statusCode: 500,
          errorCode: 'AI_SEARCH_ERROR',
          message: (err as Error).message || 'Failed to execute AI search query',
        });
      }
    }
  );

  /**
   * POST /api/v1/ai/index/:fileId
   * Triggers background speech-to-text transcription / OCR text extraction for a file.
   */
  fastify.post(
    '/api/v1/ai/index/:fileId',
    async (
      request: FastifyRequest<{ Params: { fileId: string } }>,
      reply: FastifyReply
    ) => {
      const { fileId } = request.params;

      try {
        const indexingResult = await multimodalAIService.indexFileObject(fileId);
        return reply.status(200).send({
          statusCode: 200,
          fileId,
          status: 'INDEXED',
          transcriptionText: indexingResult.transcriptionText,
          ocrText: indexingResult.ocrText,
        });
      } catch (err) {
        return reply.status(404).send({
          statusCode: 404,
          errorCode: 'INDEXING_FAILED',
          message: (err as Error).message || `Failed to index file ${fileId}`,
        });
      }
    }
  );

  /**
   * GET /api/v1/ai/status/:fileId
   * Checks the AI indexing status and transcript/OCR snippets of a file.
   */
  fastify.get(
    '/api/v1/ai/status/:fileId',
    async (
      request: FastifyRequest<{ Params: { fileId: string } }>,
      reply: FastifyReply
    ) => {
      const { fileId } = request.params;

      const embedding = await prisma.objectEmbedding.findUnique({
        where: { fileId },
        include: { file: { select: { filename: true, mimeType: true } } },
      });

      if (!embedding) {
        return reply.status(404).send({
          statusCode: 404,
          isIndexed: false,
          message: `File ${fileId} has not been indexed yet`,
        });
      }

      return reply.status(200).send({
        statusCode: 200,
        isIndexed: true,
        fileId,
        filename: embedding.file.filename,
        mimeType: embedding.file.mimeType,
        transcriptionText: embedding.transcriptionText,
        ocrText: embedding.ocrText,
        indexedAt: embedding.indexedAt,
      });
    }
  );
}
