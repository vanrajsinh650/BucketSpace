/**
 * Universal Storage Provider Enum
 */
export enum ProviderType {
  TELEGRAM_DRIVE = 'TELEGRAM_DRIVE'
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
