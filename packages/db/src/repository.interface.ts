import {
  ChunkMetadata,
  FileId,
  FileMetadata,
  TransferState,
} from '@bucketspace/shared';

export interface IMetadataRepository {
  /** Create a new file metadata record */
  createFile(file: FileMetadata, status?: TransferState): Promise<FileMetadata>;

  /** Retrieve file metadata by ID (optionally including its chunk records) */
  getFileById(id: FileId): Promise<FileMetadata | null>;

  /** List all stored file records */
  listFiles(): Promise<FileMetadata[]>;

  /** Save or update a single chunk record */
  saveChunk(chunk: ChunkMetadata): Promise<void>;

  /** Save multiple chunk records atomically in a single transaction */
  saveChunksBulk(chunks: ChunkMetadata[]): Promise<void>;

  /** Update file transfer status */
  updateFileStatus(id: FileId, status: TransferState): Promise<void>;

  /** Delete metadata record for a file and its associated chunks (does NOT delete provider storage) */
  deleteFileMetadata(id: FileId): Promise<boolean>;

  /** Close the underlying database connection safely */
  close(): Promise<void>;
}
