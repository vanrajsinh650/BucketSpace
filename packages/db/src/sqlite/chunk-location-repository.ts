import { DatabaseSync } from 'node:sqlite';
import {
  ChunkLocation,
  LocationRole,
  LocationState,
  ProviderChunkRef,
} from '@bucketspace/shared';

interface LocationRow {
  id: string;
  chunk_id: string;
  file_id: string;
  provider_id: string;
  provider_ref_json: string;
  role: string;
  state: string;
  verified_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * ChunkLocationRepository manages the `chunk_locations` table, which tracks
 * every place a chunk exists across storage providers, its role (PRIMARY/REPLICA),
 * and its verification state machine.
 */
export class ChunkLocationRepository {
  private readonly db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  /** Insert a new chunk location */
  public saveLocation(location: ChunkLocation): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO chunk_locations
        (id, chunk_id, file_id, provider_id, provider_ref_json, role, state, verified_at, last_error, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      location.id,
      location.chunkId,
      location.fileId,
      location.providerId,
      JSON.stringify(location.providerRef),
      location.role,
      location.state,
      location.verifiedAt?.toISOString() ?? null,
      location.lastError ?? null,
      location.createdAt.toISOString(),
      location.updatedAt.toISOString(),
    );
  }

  /** Get all locations for a specific chunk */
  public getLocationsForChunk(chunkId: string): ChunkLocation[] {
    const stmt = this.db.prepare('SELECT * FROM chunk_locations WHERE chunk_id = ?');
    const rows = (stmt.all(chunkId) as unknown) as LocationRow[];
    return rows.map((r) => this.rowToLocation(r));
  }

  /** Get all locations for a file (across all chunks) */
  public getLocationsForFile(fileId: string): ChunkLocation[] {
    const stmt = this.db.prepare('SELECT * FROM chunk_locations WHERE file_id = ?');
    const rows = (stmt.all(fileId) as unknown) as LocationRow[];
    return rows.map((r) => this.rowToLocation(r));
  }

  /** Get all locations on a specific provider */
  public getLocationsForProvider(providerId: string): ChunkLocation[] {
    const stmt = this.db.prepare('SELECT * FROM chunk_locations WHERE provider_id = ?');
    const rows = (stmt.all(providerId) as unknown) as LocationRow[];
    return rows.map((r) => this.rowToLocation(r));
  }

  /** Transition a location's state */
  public updateLocationState(id: string, state: LocationState, error?: string): void {
    const now = new Date().toISOString();
    const verifiedAt = state === 'VERIFIED' ? now : null;

    const stmt = this.db.prepare(`
      UPDATE chunk_locations
      SET state = ?, verified_at = COALESCE(?, verified_at), last_error = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(state, verifiedAt, error ?? null, now, id);
  }

  /** Delete a location record */
  public deleteLocation(id: string): boolean {
    const stmt = this.db.prepare('DELETE FROM chunk_locations WHERE id = ?');
    const result = stmt.run(id);
    return (result.changes ?? 0) > 0;
  }

  /** Get a single location by ID */
  public getLocationById(id: string): ChunkLocation | null {
    const stmt = this.db.prepare('SELECT * FROM chunk_locations WHERE id = ?');
    const row = (stmt.get(id) as unknown) as LocationRow | undefined;
    return row ? this.rowToLocation(row) : null;
  }

  private rowToLocation(row: LocationRow): ChunkLocation {
    return {
      id: row.id,
      chunkId: row.chunk_id,
      fileId: row.file_id,
      providerId: row.provider_id,
      providerRef: JSON.parse(row.provider_ref_json) as ProviderChunkRef,
      role: row.role as LocationRole,
      state: row.state as LocationState,
      verifiedAt: row.verified_at ? new Date(row.verified_at) : undefined,
      lastError: row.last_error ?? undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
