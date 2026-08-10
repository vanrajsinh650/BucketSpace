import { randomUUID } from 'node:crypto';
import {
  ChunkMetadata,
  createChunkId,
  FileId,
  FileMetadata,
  IStorageProvider,
} from '@bucketspace/shared';
import { IMetadataRepository } from '@bucketspace/db';
import { createFileChunker } from './file-chunker';

export interface ResumeUploadInput {
  fileId: FileId;
  filePath: string;
  provider: IStorageProvider;
  repository: IMetadataRepository;
  chunkSize?: number;
}

export interface InspectionResult {
  verifiedChunkIndexes: number[];
  missingChunkIndexes: number[];
}

export class RecoveryEngine {
  /**
   * Inspect SQLite metadata and cross-verify chunk existence with the storage provider.
   */
  public static async inspectFileChunks(
    fileId: FileId,
    repository: IMetadataRepository,
    provider: IStorageProvider
  ): Promise<InspectionResult> {
    const file = await repository.getFileById(fileId);
    if (!file) {
      return { verifiedChunkIndexes: [], missingChunkIndexes: [] };
    }

    const verifiedChunkIndexes: number[] = [];
    const missingChunkIndexes: number[] = [];

    for (const chunk of file.chunks) {
      if (!chunk.providerRef) {
        missingChunkIndexes.push(chunk.index);
        continue;
      }

      const stat = await provider.hasChunk(chunk.providerRef);
      if (stat.exists) {
        verifiedChunkIndexes.push(chunk.index);
      } else {
        missingChunkIndexes.push(chunk.index);
      }
    }

    return { verifiedChunkIndexes, missingChunkIndexes };
  }

  /**
   * Resume an interrupted or partial file upload, skipping already verified chunks on the provider.
   */
  public static async resumeUpload(input: ResumeUploadInput): Promise<FileMetadata> {
    const file = await input.repository.getFileById(input.fileId);
    if (!file) {
      throw new Error(`Cannot resume upload: file metadata for '${input.fileId}' not found in SQLite`);
    }

    await input.repository.updateFileStatus(input.fileId, 'UPLOADING');

    const { verifiedChunkIndexes } = await this.inspectFileChunks(
      input.fileId,
      input.repository,
      input.provider
    );
    const verifiedSet = new Set(verifiedChunkIndexes);

    const chunkSize = input.chunkSize ?? 5 * 1024 * 1024;
    const { chunkStream, getWholeFileHash } = createFileChunker(input.filePath, chunkSize);

    for await (const chunkItem of chunkStream) {
      // Skip chunk if provider already has it verified
      if (verifiedSet.has(chunkItem.index)) {
        continue;
      }

      const chunkId = createChunkId(randomUUID());

      const providerRef = await input.provider.putChunk({
        chunkId,
        size: chunkItem.size,
        hash: chunkItem.hash,
        data: chunkItem.data,
      });

      const chunkMetadata: ChunkMetadata = {
        id: chunkId,
        fileId: input.fileId,
        index: chunkItem.index,
        size: chunkItem.size,
        hash: chunkItem.hash,
        providerRef,
      };

      await input.repository.saveChunk(chunkMetadata);
    }

    const wholeFileHash = getWholeFileHash();
    if (file.wholeFileHash !== wholeFileHash) {
      await input.repository.updateFileStatus(input.fileId, 'FAILED');
      throw new Error(`File content has changed during resume! Whole-file hash does not match original.`);
    }

    await input.repository.updateFileStatus(input.fileId, 'COMPLETED');
    return (await input.repository.getFileById(input.fileId))!;
  }
}
