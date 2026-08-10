import { ChunkMetadata } from './chunks';
import { FileId } from './ids';

export interface FileMetadata {
  id: FileId;
  name: string;
  size: number;
  mimeType: string;
  wholeFileHash: string; // SHA-256 digest of original full file
  createdAt: Date;
  updatedAt: Date;
  chunks: ChunkMetadata[];
}
