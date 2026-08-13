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

export type DuplicateScenario =
  | 'SAME_NAME_DIFFERENT_CONTENT'
  | 'SAME_NAME_IDENTICAL_CONTENT'
  | 'DIFFERENT_NAME_IDENTICAL_CONTENT'
  | 'UNIQUE';

export type DuplicateAction =
  | 'KEEP_BOTH'
  | 'REPLACE_EXISTING'
  | 'SKIP'
  | 'UPLOAD_ANYWAY';

export interface DuplicatePolicySettings {
  identicalContentPolicy: 'ASK' | 'SKIP' | 'UPLOAD_ANYWAY';
  nameConflictPolicy: 'ASK' | 'KEEP_BOTH' | 'REPLACE_EXISTING';
}

export interface DuplicateCheckResult {
  scenario: DuplicateScenario;
  existingFile?: FileMetadata;
  suggestedName: string;
}
