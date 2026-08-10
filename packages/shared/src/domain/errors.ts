import { ProviderChunkRef } from './chunks';

export class StorageError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = 'StorageError';
  }
}

export class ChunkNotFoundError extends StorageError {
  constructor(public readonly ref: ProviderChunkRef) {
    super(`Chunk not found for provider '${ref.providerId}'`);
    this.name = 'ChunkNotFoundError';
  }
}

export class StorageQuotaError extends StorageError {
  constructor(message: string) {
    super(`Storage quota exceeded: ${message}`);
    this.name = 'StorageQuotaError';
  }
}

export class InvalidProviderRefError extends StorageError {
  constructor(providerId: string, details: string) {
    super(`Invalid reference for provider '${providerId}': ${details}`);
    this.name = 'InvalidProviderRefError';
  }
}
