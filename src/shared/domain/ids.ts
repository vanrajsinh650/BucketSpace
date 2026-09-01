export type FileId = string & { readonly __brand: unique symbol };
export type ChunkId = string & { readonly __brand: unique symbol };
export type ProviderId = string & { readonly __brand: unique symbol };

export const createFileId = (id: string): FileId => id as FileId;
export const createChunkId = (id: string): ChunkId => id as ChunkId;
export const createProviderId = (id: string): ProviderId => id as ProviderId;
