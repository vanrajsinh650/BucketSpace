import {
  IMetadataRepository,
  ListFilesOptions,
} from '@/modules/db';
import { FileId, FileMetadata } from '@/shared';
import { ProviderRegistry } from '../registry/provider-registry';
import { StorageRouter } from '../routing/storage-router';
import { ShareLink, TokenShareProvider } from '../share';
import { InspectionResult, RecoveryEngine } from '../transfer/recovery-engine';
import { DownloadResult, TransferOrchestrator } from '../transfer/transfer-orchestrator';

export interface StorageApplicationConfig {
  repository: IMetadataRepository;
  router?: StorageRouter;
  defaultProviderId?: string;
  defaultChunkSize?: number;
}

export interface UploadFileRequest {
  filePath: string;
  name: string;
  mimeType: string;
  providerId?: string;
  chunkSize?: number;
}

export interface DownloadFileRequest {
  fileId: string;
  destinationPath: string;
}

export interface ResumeUploadRequest {
  fileId: string;
  filePath: string;
  providerId?: string;
  chunkSize?: number;
}

/**
 * StorageApplicationService is the unified application facade for BucketSpace.
 * Ensures all UI applications and CLI tools consume the exact same TransferEngine,
 * RecoveryEngine, and SqliteMetadataRepository workflows without bypassing abstractions.
 */
export class StorageApplicationService {
  private repository: IMetadataRepository;
  private router?: StorageRouter;
  private defaultProviderId: string;
  private defaultChunkSize: number;

  constructor(config: StorageApplicationConfig) {
    this.repository = config.repository;
    this.router = config.router;
    this.defaultProviderId = config.defaultProviderId ?? 'in-memory';
    this.defaultChunkSize = config.defaultChunkSize ?? 5 * 1024 * 1024;
  }

  public async listFiles(options?: ListFilesOptions): Promise<FileMetadata[]> {
    return this.repository.listFiles(options);
  }

  public async searchFiles(query: string, options?: ListFilesOptions): Promise<FileMetadata[]> {
    return this.repository.searchFiles(query, options);
  }

  public async createShareLink(
    fileId: string,
    options?: { expiresInSeconds?: number; baseUrl?: string }
  ): Promise<ShareLink> {
    const file = await this.repository.getFileById(fileId as FileId);
    if (!file) {
      throw new Error(`File '${fileId}' not found for sharing`);
    }

    const shareProvider = new TokenShareProvider();
    return shareProvider.createShareLink(fileId, options);
  }

  public async getFile(fileId: string): Promise<FileMetadata | null> {
    return this.repository.getFileById(fileId as FileId);
  }

  /**
   * Upload a file. Provider resolution order:
   * 1. Explicit `request.providerId` (user override)
   * 2. `StorageRouter.resolveProviderId()` (rule-based routing by MIME/extension)
   * 3. `defaultProviderId` fallback
   */
  public async uploadFile(request: UploadFileRequest): Promise<FileMetadata> {
    let providerId = request.providerId;

    if (!providerId && this.router) {
      providerId = this.router.resolveProviderId({
        name: request.name,
        mimeType: request.mimeType,
      });
    }

    providerId = providerId ?? this.defaultProviderId;
    const provider = ProviderRegistry.get(providerId);

    return TransferOrchestrator.uploadFile({
      filePath: request.filePath,
      name: request.name,
      mimeType: request.mimeType,
      chunkSize: request.chunkSize ?? this.defaultChunkSize,
      provider,
      repository: this.repository,
    });
  }

  /**
   * Download a file. Each chunk's provider is resolved independently from its
   * providerRef, allowing files whose chunks span multiple providers.
   */
  public async downloadFile(request: DownloadFileRequest): Promise<DownloadResult> {
    const metadata = await this.repository.getFileById(request.fileId as FileId);
    if (!metadata) {
      throw new Error(`File '${request.fileId}' not found in metadata repository`);
    }

    return TransferOrchestrator.downloadFileMultiProvider({
      fileId: request.fileId as FileId,
      destinationPath: request.destinationPath,
      repository: this.repository,
    });
  }

  public async deleteFile(fileId: string): Promise<boolean> {
    return this.repository.deleteFileMetadata(fileId as FileId);
  }

  public async restoreFile(fileId: string): Promise<boolean> {
    return this.repository.restoreFileMetadata(fileId as FileId);
  }

  public async purgeFile(fileId: string): Promise<boolean> {
    const metadata = await this.repository.getFileById(fileId as FileId);
    if (!metadata) {
      return false;
    }

    for (const chunk of metadata.chunks) {
      if (chunk.providerRef) {
        try {
          const provider = ProviderRegistry.get(chunk.providerRef.providerId);
          await provider.deleteChunk(chunk.providerRef);
        } catch {
          // Ignore chunk deletion errors if chunk was already deleted on provider
        }
      }
    }

    return this.repository.purgeFileMetadata(fileId as FileId);
  }

  public async inspectFile(fileId: string): Promise<InspectionResult> {
    const metadata = await this.repository.getFileById(fileId as FileId);
    if (!metadata) {
      throw new Error(`File '${fileId}' not found in metadata repository`);
    }

    const providerId = metadata.chunks[0]?.providerRef?.providerId ?? this.defaultProviderId;
    const provider = ProviderRegistry.get(providerId);

    return RecoveryEngine.inspectFileChunks(fileId as FileId, this.repository, provider);
  }

  public async resumeUpload(request: ResumeUploadRequest): Promise<FileMetadata> {
    const metadata = await this.repository.getFileById(request.fileId as FileId);
    if (!metadata) {
      throw new Error(`File '${request.fileId}' not found in metadata repository`);
    }

    const providerId = request.providerId ?? metadata.chunks[0]?.providerRef?.providerId ?? this.defaultProviderId;
    const provider = ProviderRegistry.get(providerId);

    return RecoveryEngine.resumeUpload({
      fileId: request.fileId as FileId,
      filePath: request.filePath,
      provider,
      repository: this.repository,
      chunkSize: request.chunkSize ?? this.defaultChunkSize,
    });
  }
}
