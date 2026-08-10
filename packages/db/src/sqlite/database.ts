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
      status TEXT NOT NULL,
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
  `);

  return db;
}
