import { z } from 'zod';

export const SyncConflictStrategySchema = z.enum(['OVERWRITE', 'SKIP', 'LWW']);
export type SyncConflictStrategy = z.infer<typeof SyncConflictStrategySchema>;

export const CreateSyncPolicySchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().min(1).max(255),
  sourceBucketId: z.string().uuid(),
  destinationBucketId: z.string().uuid(),
  scheduleCron: z.string().max(100).optional(),
  conflictStrategy: SyncConflictStrategySchema.default('LWW'),
  enabled: z.boolean().default(true),
}).refine(
  (data) => data.sourceBucketId !== data.destinationBucketId,
  { message: 'Source and destination buckets must be different', path: ['destinationBucketId'] }
);

export type CreateSyncPolicyInput = z.infer<typeof CreateSyncPolicySchema>;

export const TriggerSyncJobSchema = z.object({
  policyId: z.string().uuid(),
});

export type TriggerSyncJobInput = z.infer<typeof TriggerSyncJobSchema>;
