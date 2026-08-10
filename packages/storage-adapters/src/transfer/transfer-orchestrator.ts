import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import {
  ChunkMetadata,
  createChunkId,
  createFileId,
  FileId,
  FileMetadata,
  IStorageProvider,
} from '@bucketspace/shared';
import { IMetadataRepository } from '@bucketspace/db';
import { createFileChunker } from './file-chunker';

export interface UploadFileInput {
  filePath: string;
  name: string;
  mimeType: string;
  chunkSize?: number;
  provider: IStorageProvider;
  repository: IMetadataRepository;
}

export interface DownloadFileInput {
  fileId: FileId;
  destinationPath: string;
  provider: IStorageProvider;
  repository: IMetadataRepository;
}

export interface DownloadResult {
  destinationPath: string;
  file: FileMetadata;
  verifiedHash: string;
}

export class TransferOrchestrator {
  /**
   * Upload a local disk file, stream chunks to provider, and save metadata to SQLite.
   */
  public static async uploadFile(input: UploadFileInput): Promise<FileMetadata> {
    const fileId = createFileId(randomUUID());
    const chunkSize = input.chunkSize ?? 5 * 1024 * 1024;

    const { chunkStream, getWholeFileHash, totalSize } = createFileChunker(input.filePath, chunkSize);
    const uploadedChunks: ChunkMetadata[] = [];

    for await (const chunkItem of chunkStream) {
      const chunkId = createChunkId(randomUUID());

      const providerRef = await input.provider.putChunk({
        chunkId,
        size: chunkItem.size,
        hash: chunkItem.hash,
        data: chunkItem.data,
      });

      uploadedChunks.push({
        id: chunkId,
        fileId,
        index: chunkItem.index,
        size: chunkItem.size,
        hash: chunkItem.hash,
        providerRef,
      });
    }

    const wholeFileHash = getWholeFileHash();
    const fileMetadata: FileMetadata = {
      id: fileId,
      name: input.name,
      size: totalSize,
      mimeType: input.mimeType,
      wholeFileHash,
      createdAt: new Date(),
      updatedAt: new Date(),
      chunks: uploadedChunks,
    };

    await input.repository.createFile(fileMetadata, 'COMPLETED');
    return fileMetadata;
  }

  /**
   * Download and reassemble a file, verifying chunk and whole-file SHA-256 digests.
   */
  public static async downloadFile(input: DownloadFileInput): Promise<DownloadResult> {
    const file = await input.repository.getFileById(input.fileId);
    if (!file) {
      throw new Error(`File metadata for id '${input.fileId}' not found in SQLite repository`);
    }

    const sortedChunks = [...file.chunks].sort((a, b) => a.index - b.index);
    const writeStream = createWriteStream(input.destinationPath);
    const wholeFileHasher = createHash('sha256');

    try {
      for (const chunk of sortedChunks) {
        if (!chunk.providerRef) {
          throw new Error(`Chunk ${chunk.index} is missing provider reference`);
        }

        const chunkByteStream = await input.provider.getChunk(chunk.providerRef);
        const chunkHasher = createHash('sha256');

        for await (const piece of chunkByteStream) {
          chunkHasher.update(piece);
          wholeFileHasher.update(piece);

          const canContinue = writeStream.write(piece);
          if (!canContinue) {
            await new Promise<void>((resolve) => writeStream.once('drain', () => resolve()));
          }
        }

        const computedChunkHash = chunkHasher.digest('hex');
        if (computedChunkHash !== chunk.hash) {
          throw new Error(
            `Chunk ${chunk.index} hash mismatch during download! Expected '${chunk.hash}', got '${computedChunkHash}'`
          );
        }
      }

      await new Promise<void>((resolve, reject) => {
        writeStream.end((err?: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } catch (err) {
      writeStream.destroy();
      throw err;
    }

    const computedWholeFileHash = wholeFileHasher.digest('hex');
    if (computedWholeFileHash !== file.wholeFileHash) {
      throw new Error(
        `Whole-file hash mismatch during download reassembly! Expected '${file.wholeFileHash}', got '${computedWholeFileHash}'`
      );
    }

    return {
      destinationPath: input.destinationPath,
      file,
      verifiedHash: computedWholeFileHash,
    };
  }
}
