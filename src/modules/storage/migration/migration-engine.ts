import { createHash } from 'crypto';
import {
  ChunkMetadata,
  FileId,
  FileMetadata,
  IStorageProvider,
  ProviderChunkRef,
} from '@/shared';
import { IMetadataRepository } from '@/modules/db';
import { ProviderRegistry } from '../registry/provider-registry';

export interface MigrationResult {
  fileId: string;
  sourceProviderId: string;
  targetProviderId: string;
  chunksTransferred: number;
  verified: boolean;
}

/**
 * MigrationEngine moves a file's chunks from one storage provider to another
 * using a two-phase commit approach:
 *
 *   Phase 1 — Write all chunks to target provider + verify SHA-256
 *   Phase 2 — Delete original chunks from source provider
 *
 * Source chunks are NEVER deleted until ALL target chunks are written and verified.
 */
export class MigrationEngine {

  /**
   * Migrate all chunks of a file from their current provider to a different provider.
   * Each chunk is re-hashed during transfer to guarantee byte-level integrity.
   */
  public static async migrateFile(
    fileId: FileId,
    targetProviderId: string,
    repository: IMetadataRepository,
  ): Promise<MigrationResult> {
    const file = await repository.getFileById(fileId);
    if (!file) {
      throw new Error(`[MigrationEngine] File '${fileId}' not found in metadata repository`);
    }

    const targetProvider = ProviderRegistry.get(targetProviderId);

    // Identify chunks that need migration (skip any already on the target)
    const chunksToMigrate = file.chunks.filter(
      (c) => c.providerRef && c.providerRef.providerId !== targetProviderId
    );

    if (chunksToMigrate.length === 0) {
      return {
        fileId,
        sourceProviderId: targetProviderId,
        targetProviderId,
        chunksTransferred: 0,
        verified: true,
      };
    }

    const sourceProviderId = chunksToMigrate[0].providerRef!.providerId;

    // ─── Phase 1: Write all chunks to target, collect new refs ───
    const migrationMap: { chunk: ChunkMetadata; oldRef: ProviderChunkRef; newRef: ProviderChunkRef }[] = [];

    for (const chunk of chunksToMigrate) {
      const sourceProvider = ProviderRegistry.get(chunk.providerRef!.providerId);
      const byteStream = await sourceProvider.getChunk(chunk.providerRef!);

      // Buffer the entire chunk to re-hash and re-upload
      const buffers: Uint8Array[] = [];
      const transferHasher = createHash('sha256');

      for await (const piece of byteStream) {
        transferHasher.update(piece);
        buffers.push(piece);
      }

      const transferHash = transferHasher.digest('hex');
      if (transferHash !== chunk.hash) {
        throw new Error(
          `[MigrationEngine] Chunk ${chunk.index} hash mismatch during migration read from '${chunk.providerRef!.providerId}'. ` +
          `Expected '${chunk.hash}', got '${transferHash}'`
        );
      }

      // Upload to target provider
      const newRef = await targetProvider.putChunk({
        chunkId: chunk.id,
        size: chunk.size,
        hash: chunk.hash,
        data: (async function* () { for (const b of buffers) yield b; })(),
      });

      migrationMap.push({ chunk, oldRef: chunk.providerRef!, newRef });
    }

    // ─── Phase 1b: Verify all target chunks exist ───
    for (const { chunk, newRef } of migrationMap) {
      const stat = await targetProvider.hasChunk(newRef);
      if (!stat.exists) {
        throw new Error(
          `[MigrationEngine] Verification failed: chunk ${chunk.index} not found on target provider '${targetProviderId}' after upload`
        );
      }
    }

    // ─── Phase 2a: Update SQLite metadata to point to new provider refs ───
    for (const { chunk, newRef } of migrationMap) {
      const updatedChunk: ChunkMetadata = { ...chunk, providerRef: newRef };
      await repository.saveChunk(updatedChunk);
    }

    // ─── Phase 2b: Delete original chunks from source provider ───
    for (const { chunk, oldRef } of migrationMap) {
      try {
        const sourceProvider = ProviderRegistry.get(oldRef.providerId);
        await sourceProvider.deleteChunk(oldRef);
      } catch {
        // Non-fatal: source chunk may already be gone, metadata is already updated
      }
    }

    return {
      fileId,
      sourceProviderId,
      targetProviderId,
      chunksTransferred: migrationMap.length,
      verified: true,
    };
  }
}
