import {
  ChunkMetadata,
  FileId,
  FileMetadata,
  TransferState,
} from '@bucketspace/shared';

export interface ListFilesOptions {
  includeTrashed?: boolean;
}

export interface IMetadataRepository {
  /** Create a new file metadata record */
  createFile(file: FileMetadata, status?: TransferState): Promise<FileMetadata>;

  /** Retrieve file metadata by ID (including its chunk records) */
  getFileById(id: FileId): Promise<FileMetadata | null>;

  /** List stored file records (defaults to excluding trashed files unless includeTrashed = true) */
  listFiles(options?: ListFilesOptions): Promise<FileMetadata[]>;

  /** Save or update a single chunk record */
  saveChunk(chunk: ChunkMetadata): Promise<void>;

  /** Save multiple chunk records atomically in a single transaction */
  saveChunksBulk(chunks: ChunkMetadata[]): Promise<void>;

  /** Update file transfer status (e.g. UPLOADING, COMPLETED, FAILED) */
  updateFileStatus(id: FileId, status: TransferState): Promise<void>;

  /** Soft-delete file metadata by setting status to TRASHED (does NOT delete provider storage) */
  deleteFileMetadata(id: FileId): Promise<boolean>;

  /** Restore soft-deleted file metadata by setting status back to ACTIVE */
  restoreFileMetadata(id: FileId): Promise<boolean>;

  /** Permanently delete metadata record for a file and its associated chunks from SQLite DB */
  purgeFileMetadata(id: FileId): Promise<boolean>;

  /** Close the underlying database connection safely */
  close(): Promise<void>;
}
