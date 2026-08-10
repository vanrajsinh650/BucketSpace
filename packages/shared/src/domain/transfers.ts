export type TransferState =
  | 'PENDING'
  | 'CHUNKING'
  | 'UPLOADING'
  | 'VERIFYING'
  | 'COMPLETED'
  | 'FAILED'
  | 'PAUSED';
