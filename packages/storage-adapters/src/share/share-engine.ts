import { createHash } from 'node:crypto';
import { FileId, FileMetadata } from '@bucketspace/shared';
import { IMetadataRepository } from '@bucketspace/db';
import { ProviderRegistry } from '../registry/provider-registry';
import { TokenShareProvider } from './token-share-provider';

export interface StreamedShareResult {
  file: FileMetadata;
  mimeType: string;
  size: number;
  stream: AsyncIterable<Uint8Array>;
}

/**
 * ShareEngine extends the token-based share layer with actual byte-serving.
 * When a shared link is accessed, this engine resolves the shareId → fileId,
 * loads chunk metadata, and returns a concatenated byte stream from whichever
 * provider(s) hold each chunk.
 */
export class ShareEngine {
  private shareProvider: TokenShareProvider;
  private repository: IMetadataRepository;

  constructor(repository: IMetadataRepository, shareProvider?: TokenShareProvider) {
    this.repository = repository;
    this.shareProvider = shareProvider ?? new TokenShareProvider();
  }

  /** Delegate: create a share link */
  public async createShareLink(
    fileId: string,
    options?: { expiresInSeconds?: number; baseUrl?: string }
  ) {
    const file = await this.repository.getFileById(fileId as FileId);
    if (!file) {
      throw new Error(`[ShareEngine] File '${fileId}' not found`);
    }
    return this.shareProvider.createShareLink(fileId, options);
  }

  /** Delegate: revoke a share link */
  public async revokeShareLink(shareId: string) {
    return this.shareProvider.revokeShareLink(shareId);
  }

  /**
   * Resolve a shareId and return a streamable byte source for the shared file.
   * Each chunk's provider is resolved independently from ProviderRegistry.
   */
  public async streamSharedFile(shareId: string): Promise<StreamedShareResult> {
    const link = await this.shareProvider.getShareLink(shareId);
    if (!link) {
      throw new Error(`[ShareEngine] Share link '${shareId}' not found or expired`);
    }

    const file = await this.repository.getFileById(link.fileId as FileId);
    if (!file) {
      throw new Error(`[ShareEngine] File '${link.fileId}' referenced by share '${shareId}' not found`);
    }

    const sortedChunks = [...file.chunks].sort((a, b) => a.index - b.index);

    // Return a lazy async iterable that streams chunks in order
    const stream = (async function* () {
      for (const chunk of sortedChunks) {
        if (!chunk.providerRef) {
          throw new Error(`[ShareEngine] Chunk ${chunk.index} missing provider reference`);
        }

        const provider = ProviderRegistry.get(chunk.providerRef.providerId);
        const chunkStream = await provider.getChunk(chunk.providerRef);

        for await (const piece of chunkStream) {
          yield piece;
        }
      }
    })();

    return {
      file,
      mimeType: file.mimeType,
      size: file.size,
      stream,
    };
  }
}
