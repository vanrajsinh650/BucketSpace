import { ChunkMetadata } from './chunks';
import { FileId } from './ids';

export type FileStatus = 'ACTIVE' | 'TRASHED';

export interface FileMetadata {
  id: FileId;
  name: string;
  size: number;
  mimeType: string;
  wholeFileHash: string; // SHA-256 digest of original full file
  status: FileStatus;
  createdAt: Date;
  updatedAt: Date;
  chunks: ChunkMetadata[];
}
