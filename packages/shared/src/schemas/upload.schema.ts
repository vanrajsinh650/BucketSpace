import { z } from 'zod';
import { ProviderType } from '../constants/providers.enum';

export const DirectUploadPresignSchema = z.object({
  workspaceId: z.string().uuid(),
  channelId: z.string().min(1, 'Telegram channel ID is required'),
  filename: z.string().min(1).max(512),
  sizeBytes: z.number().positive(),
  mimeType: z.string().min(1),
  sha256Hash: z.string().length(64).optional(),
});

export type DirectUploadPresignInput = z.infer<typeof DirectUploadPresignSchema>;

export const TelegramChunkUploadSchema = z.object({
  fileId: z.string().uuid(),
  chunkIndex: z.number().int().nonnegative(),
  totalChunks: z.number().int().positive(),
  partSizeBytes: z.number().positive(),
});

export type TelegramChunkUploadInput = z.infer<typeof TelegramChunkUploadSchema>;
