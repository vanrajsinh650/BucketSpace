import { z } from 'zod';

export const AISearchModeSchema = z.enum(['HYBRID', 'TRANSCRIPT', 'DOCUMENT', 'VISUAL']);
export type AISearchMode = z.infer<typeof AISearchModeSchema>;

export const AISearchQuerySchema = z.object({
  workspaceId: z.string().uuid(),
  query: z.string().min(1).max(1024),
  mode: AISearchModeSchema.default('HYBRID'),
  topK: z.number().int().positive().max(50).default(10),
  minScore: z.number().min(0).max(1).default(0.3),
});

export type AISearchQueryInput = z.infer<typeof AISearchQuerySchema>;

export interface AISearchResultItem {
  fileId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  provider: string;
  similarityScore: number;
  matchedSnippet: string;
  matchType: 'VISUAL' | 'TRANSCRIPT' | 'DOCUMENT' | 'HYBRID';
  transcriptionText?: string;
  ocrText?: string;
}

export interface AISearchResponse {
  statusCode: number;
  query: string;
  mode: AISearchMode;
  totalMatches: number;
  results: AISearchResultItem[];
}
