import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CreateSyncPolicySchema } from '@bucketspace/shared';
import { syncEngineService } from './sync.engine';
import { prisma } from '@bucketspace/db';

/** Regex for UUID v4 format validation */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ------------------------------------------------------------------ */
/*  Cross-Cloud Bucket Sync Controller Routes                          */
/* ------------------------------------------------------------------ */

export function registerSyncRoutes(fastify: FastifyInstance): void {
  /**
   * POST /api/v1/sync/policies
   * Creates an automated cross-cloud replication policy.
   */
  fastify.post(
    '/api/v1/sync/policies',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = CreateSyncPolicySchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          errorCode: 'VALIDATION_ERROR',
          message: 'Invalid sync policy payload',
          details: parseResult.error.flatten(),
        });
      }

      const input = parseResult.data;

      try {
        const policy = await prisma.syncPolicy.create({
          data: {
            workspaceId: input.workspaceId,
            name: input.name,
            sourceBucketId: input.sourceBucketId,
            destinationBucketId: input.destinationBucketId,
            scheduleCron: input.scheduleCron ?? null,
            conflictStrategy: input.conflictStrategy,
            enabled: input.enabled,
          },
        });

        return reply.status(201).send({
          statusCode: 201,
          policy,
        });
      } catch (err) {
        request.log.error({ err }, 'Failed to create sync policy');
        return reply.status(400).send({
          statusCode: 400,
          errorCode: 'CREATE_POLICY_FAILED',
          message: (err as Error).message || 'Failed to create sync policy',
        });
      }
    }
  );

  /**
   * GET /api/v1/sync/policies/:workspaceId
   * Lists all sync policies for a workspace.
   */
  fastify.get(
    '/api/v1/sync/policies/:workspaceId',
    async (
      request: FastifyRequest<{ Params: { workspaceId: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;

      if (!UUID_RE.test(workspaceId)) {
        return reply.status(400).send({ statusCode: 400, errorCode: 'INVALID_ID', message: 'workspaceId must be a valid UUID' });
      }

      const policies = await prisma.syncPolicy.findMany({
        where: { workspaceId },
        include: {
          jobs: {
            orderBy: { startedAt: 'desc' },
            take: 5,
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return reply.status(200).send({
        statusCode: 200,
        workspaceId,
        policies,
      });
    }
  );

  /**
   * POST /api/v1/sync/policies/:policyId/trigger
   * Triggers immediate execution of a sync policy.
   */
  fastify.post(
    '/api/v1/sync/policies/:policyId/trigger',
    async (
      request: FastifyRequest<{ Params: { policyId: string } }>,
      reply: FastifyReply
    ) => {
      const { policyId } = request.params;

      if (!UUID_RE.test(policyId)) {
        return reply.status(400).send({ statusCode: 400, errorCode: 'INVALID_ID', message: 'policyId must be a valid UUID' });
      }

      try {
        const jobId = await syncEngineService.executePolicy(policyId);
        return reply.status(202).send({
          statusCode: 202,
          policyId,
          jobId,
          status: 'RUNNING',
          message: 'Cross-cloud replication job initiated successfully',
        });
      } catch (err) {
        return reply.status(400).send({
          statusCode: 400,
          errorCode: 'TRIGGER_FAILED',
          message: (err as Error).message || `Failed to trigger sync policy ${policyId}`,
        });
      }
    }
  );

  /**
   * GET /api/v1/sync/jobs/:workspaceId
   * Retrieves recent sync job execution history across a workspace.
   */
  fastify.get(
    '/api/v1/sync/jobs/:workspaceId',
    async (
      request: FastifyRequest<{ Params: { workspaceId: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;

      if (!UUID_RE.test(workspaceId)) {
        return reply.status(400).send({ statusCode: 400, errorCode: 'INVALID_ID', message: 'workspaceId must be a valid UUID' });
      }

      const jobs = await prisma.syncJob.findMany({
        where: {
          policy: { workspaceId },
        },
        include: {
          policy: { select: { name: true, sourceBucketId: true, destinationBucketId: true } },
        },
        orderBy: { startedAt: 'desc' },
        take: 20,
      });

      const formattedJobs = jobs.map((j) => ({
        id: j.id,
        policyName: j.policy.name,
        status: j.status,
        itemsTotal: j.itemsTotal,
        itemsSynced: j.itemsSynced,
        bytesTransferred: j.bytesTransferred.toString(),
        startedAt: j.startedAt,
        finishedAt: j.finishedAt,
        errorMessage: j.errorMessage,
      }));

      return reply.status(200).send({
        statusCode: 200,
        workspaceId,
        jobs: formattedJobs,
      });
    }
  );
}
