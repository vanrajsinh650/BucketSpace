import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { CreateLifecycleRuleSchema, ComplianceExportQuerySchema } from '@bucketspace/shared';
import { multiCloudCostService } from './cost.service';
import { lifecycleEngineService } from './lifecycle.service';
import { complianceAuditService } from './compliance.service';

/** Regex for UUID v4 format validation */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ------------------------------------------------------------------ */
/*  Enterprise Automation & Governance Controller                     */
/* ------------------------------------------------------------------ */

export function registerEnterpriseRoutes(fastify: FastifyInstance): void {
  /**
   * GET /api/v1/enterprise/cost-analytics/:workspaceId
   * Returns storage cost breakdown, provider usage, and recommendations.
   */
  fastify.get(
    '/api/v1/enterprise/cost-analytics/:workspaceId',
    async (
      request: FastifyRequest<{ Params: { workspaceId: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;

      if (!UUID_RE.test(workspaceId)) {
        return reply.status(400).send({
          statusCode: 400,
          errorCode: 'INVALID_ID',
          message: 'workspaceId must be a valid UUID',
        });
      }

      try {
        const analytics = await multiCloudCostService.getWorkspaceCostAnalytics(workspaceId);
        return reply.status(200).send(analytics);
      } catch (err) {
        request.log.error({ err }, 'Failed to fetch cost analytics');
        return reply.status(500).send({
          statusCode: 500,
          errorCode: 'COST_ANALYTICS_FAILED',
          message: (err as Error).message || 'Failed to analyze cloud storage costs',
        });
      }
    }
  );

  /**
   * POST /api/v1/enterprise/lifecycle
   * Creates a new automated lifecycle migration rule.
   */
  fastify.post(
    '/api/v1/enterprise/lifecycle',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = CreateLifecycleRuleSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          errorCode: 'VALIDATION_ERROR',
          message: 'Invalid lifecycle rule payload',
          details: parseResult.error.flatten(),
        });
      }

      try {
        const rule = await lifecycleEngineService.createRule(parseResult.data);
        return reply.status(201).send({
          statusCode: 201,
          rule,
        });
      } catch (err) {
        return reply.status(400).send({
          statusCode: 400,
          errorCode: 'CREATE_RULE_FAILED',
          message: (err as Error).message || 'Failed to create lifecycle rule',
        });
      }
    }
  );

  /**
   * GET /api/v1/enterprise/lifecycle/:workspaceId
   * Lists all lifecycle rules for a workspace.
   */
  fastify.get(
    '/api/v1/enterprise/lifecycle/:workspaceId',
    async (
      request: FastifyRequest<{ Params: { workspaceId: string } }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;

      if (!UUID_RE.test(workspaceId)) {
        return reply.status(400).send({
          statusCode: 400,
          errorCode: 'INVALID_ID',
          message: 'workspaceId must be a valid UUID',
        });
      }

      const rules = await lifecycleEngineService.listRules(workspaceId);
      return reply.status(200).send({
        statusCode: 200,
        workspaceId,
        rules,
      });
    }
  );

  /**
   * POST /api/v1/enterprise/lifecycle/:ruleId/execute
   * Triggers immediate execution of a lifecycle rule.
   */
  fastify.post(
    '/api/v1/enterprise/lifecycle/:ruleId/execute',
    async (
      request: FastifyRequest<{ Params: { ruleId: string } }>,
      reply: FastifyReply
    ) => {
      const { ruleId } = request.params;

      if (!UUID_RE.test(ruleId)) {
        return reply.status(400).send({
          statusCode: 400,
          errorCode: 'INVALID_ID',
          message: 'ruleId must be a valid UUID',
        });
      }

      try {
        const result = await lifecycleEngineService.executeRule(ruleId);
        return reply.status(200).send({
          statusCode: 200,
          ruleId,
          status: 'EXECUTED',
          itemsProcessed: result.itemsProcessed,
          bytesAffected: result.bytesAffected,
        });
      } catch (err) {
        return reply.status(400).send({
          statusCode: 400,
          errorCode: 'EXECUTE_RULE_FAILED',
          message: (err as Error).message || `Failed to execute lifecycle rule ${ruleId}`,
        });
      }
    }
  );

  /**
   * GET /api/v1/enterprise/compliance/export/:workspaceId
   * Generates tamper-evident SOC 2 / HIPAA compliance audit export.
   */
  fastify.get(
    '/api/v1/enterprise/compliance/export/:workspaceId',
    async (
      request: FastifyRequest<{
        Params: { workspaceId: string };
        Querystring: { startDate?: string; endDate?: string; actorUserId?: string; action?: string; format?: 'json' | 'csv' };
      }>,
      reply: FastifyReply
    ) => {
      const { workspaceId } = request.params;

      if (!UUID_RE.test(workspaceId)) {
        return reply.status(400).send({
          statusCode: 400,
          errorCode: 'INVALID_ID',
          message: 'workspaceId must be a valid UUID',
        });
      }

      const queryParse = ComplianceExportQuerySchema.safeParse({ workspaceId, ...request.query });
      const queryData = queryParse.success
        ? queryParse.data
        : {
            workspaceId,
            format: 'json' as const,
            startDate: undefined,
            endDate: undefined,
            actorUserId: undefined,
            action: undefined,
          };

      try {
        const report = await complianceAuditService.generateComplianceReport(
          workspaceId,
          queryData.startDate,
          queryData.endDate,
          queryData.actorUserId,
          queryData.action
        );

        if (queryData.format === 'csv') {
          const csvData = complianceAuditService.convertToCsv(report);
          return reply
            .header('Content-Type', 'text/csv')
            .header('Content-Disposition', `attachment; filename="compliance_audit_${workspaceId}.csv"`)
            .status(200)
            .send(csvData);
        }

        return reply.status(200).send(report);
      } catch (err) {
        request.log.error({ err }, 'Failed to generate compliance export');
        return reply.status(500).send({
          statusCode: 500,
          errorCode: 'COMPLIANCE_EXPORT_FAILED',
          message: (err as Error).message || 'Failed to generate compliance export',
        });
      }
    }
  );
}
