import { DatabaseSync } from 'node:sqlite';

export function createSqliteDatabase(filepath: string = ':memory:'): DatabaseSync {
  const db = new DatabaseSync(filepath);

  // Enable foreign keys and WAL mode for reader/writer concurrency
  db.exec('PRAGMA foreign_keys = ON;');
  if (filepath !== ':memory:') {
    db.exec('PRAGMA journal_mode = WAL;');
  }

  // Create tables & indexes
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      size INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      whole_file_hash TEXT NOT NULL,
      transfer_status TEXT NOT NULL DEFAULT 'UPLOADING',
      file_status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      size INTEGER NOT NULL,
      hash TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      provider_ref_json TEXT NOT NULL,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
      CONSTRAINT uq_file_chunk UNIQUE (file_id, chunk_index)
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_file_id ON chunks(file_id);

    CREATE TABLE IF NOT EXISTS storage_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      priority INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      conditions_json TEXT NOT NULL,
      action_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chunk_locations (
      id TEXT PRIMARY KEY,
      chunk_id TEXT NOT NULL,
      file_id TEXT NOT NULL,
      provider_id TEXT NOT NULL,
      provider_ref_json TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'PRIMARY',
      state TEXT NOT NULL DEFAULT 'PENDING',
      verified_at TEXT,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE,
      CONSTRAINT uq_chunk_provider UNIQUE (chunk_id, provider_id)
    );

    CREATE INDEX IF NOT EXISTS idx_chunk_locations_file_id ON chunk_locations(file_id);
    CREATE INDEX IF NOT EXISTS idx_chunk_locations_chunk_id ON chunk_locations(chunk_id);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      actor TEXT NOT NULL DEFAULT 'SYSTEM',
      details_json TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);

    CREATE TABLE IF NOT EXISTS content_metadata (
      file_id TEXT PRIMARY KEY,
      extractor_id TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      full_text TEXT NOT NULL,
      language TEXT,
      metadata_json TEXT NOT NULL,
      extracted_at TEXT NOT NULL,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS content_segments (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      segment_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      page_number INTEGER,
      char_offset INTEGER,
      start_time_seconds REAL,
      end_time_seconds REAL,
      confidence REAL,
      bounding_box_json TEXT,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_content_segments_file ON content_segments(file_id);

    CREATE VIRTUAL TABLE IF NOT EXISTS content_fts USING fts5(
      file_id UNINDEXED,
      full_text,
      tokenize='unicode61'
    );

    CREATE TABLE IF NOT EXISTS vector_chunks (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      page_number INTEGER,
      char_offset INTEGER,
      start_time_seconds REAL,
      end_time_seconds REAL,
      confidence REAL,
      embedding_json TEXT NOT NULL,
      model_id TEXT NOT NULL,
      dimensions INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (file_id) REFERENCES files(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_vector_chunks_file ON vector_chunks(file_id);
    CREATE INDEX IF NOT EXISTS idx_vector_chunks_model ON vector_chunks(model_id);

    CREATE TABLE IF NOT EXISTS embedding_models (
      model_id TEXT PRIMARY KEY,
      model_version TEXT NOT NULL,
      dimensions INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_ledger (
      local_path TEXT PRIMARY KEY,
      absolute_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      mtime_ms INTEGER NOT NULL,
      sha256_hash TEXT NOT NULL,
      remote_file_id TEXT,
      sync_status TEXT NOT NULL DEFAULT 'PENDING_UPLOAD',
      direction TEXT NOT NULL DEFAULT 'IDLE',
      error_message TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      last_synced_at TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      is_deleted INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_ledger(sync_status);
    CREATE INDEX IF NOT EXISTS idx_sync_remote_file_id ON sync_ledger(remote_file_id);
    CREATE INDEX IF NOT EXISTS idx_sync_sha256_hash ON sync_ledger(sha256_hash);
  `);

  return db;
}
