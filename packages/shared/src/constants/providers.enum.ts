/**
 * Universal Storage Provider Enum
 */
export enum ProviderType {
  TELEGRAM_DRIVE = 'TELEGRAM_DRIVE',
  AWS_S3 = 'AWS_S3',
  CLOUDFLARE_R2 = 'CLOUDFLARE_R2',
  GCP_STORAGE = 'GCP_STORAGE',
  AZURE_BLOB = 'AZURE_BLOB',
  MINIO = 'MINIO'
}

/**
 * Object Upload and Processing Status Enum
 */
export enum ObjectStatus {
  PENDING_UPLOAD = 'PENDING_UPLOAD',
  UPLOADING = 'UPLOADING',
  PROCESSED = 'PROCESSED',
  QUARANTINED = 'QUARANTINED',
  DELETED = 'DELETED'
}
