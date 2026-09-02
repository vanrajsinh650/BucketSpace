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
  `);

  return db;
}
