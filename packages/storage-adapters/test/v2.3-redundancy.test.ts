import assert from 'node:assert';
import { createHash } from 'node:crypto';
import test from 'node:test';
import {
  ChunkLocation,
  ChunkMetadata,
  createChunkId,
  createFileId,
} from '@bucketspace/shared';
import {
  createSqliteDatabase,
  ChunkLocationRepository,
  SqliteMetadataRepository,
} from '@bucketspace/db';
import {
  InMemoryStorageProvider,
  ProviderRegistry,
  ReplicationEngine,
  VerificationEngine,
  RepairEngine,
} from '../src';

/* ─── Helpers ─── */

function sha256(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

/** Upload a test file's chunks to a provider and return metadata */
async function seedFile(
  provider: InMemoryStorageProvider,
  db: import('node:sqlite').DatabaseSync,
  fileId: string,
  chunkCount: number,
  chunkSize: number = 1024,
): Promise<{ chunks: ChunkMetadata[]; data: Uint8Array[] }> {
  const chunks: ChunkMetadata[] = [];
  const data: Uint8Array[] = [];

  // Seed the files table so FK constraint on chunk_locations is satisfied
  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO files (id, name, size, mime_type, whole_file_hash, transfer_status, file_status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(fileId, `${fileId}.bin`, chunkCount * chunkSize, 'application/octet-stream', 'seed-hash', 'COMPLETE', 'ACTIVE', now, now);

  for (let i = 0; i < chunkCount; i++) {
    const bytes = new Uint8Array(chunkSize);
    // Fill with deterministic data for each chunk
    for (let j = 0; j < chunkSize; j++) {
      bytes[j] = (i * 37 + j * 13 + 42) % 256;
    }

    const hash = sha256(bytes);
    const chunkId = createChunkId(`chunk-${fileId}-${i}`);

    const providerRef = await provider.putChunk({
      chunkId: chunkId as string,
      size: bytes.byteLength,
      hash,
      data: (async function* () { yield bytes; })(),
    });

    chunks.push({
      id: chunkId,
      fileId: createFileId(fileId),
      index: i,
      size: bytes.byteLength,
      hash,
      providerRef,
    });

    data.push(bytes);
  }

  return { chunks, data };
}

/** Create a PRIMARY ChunkLocation for a chunk */
function createPrimaryLocation(
  chunk: ChunkMetadata,
  locationRepo: ChunkLocationRepository,
): ChunkLocation {
  const now = new Date();
  const location: ChunkLocation = {
    id: `loc-${chunk.id}-${chunk.providerRef!.providerId}`,
    chunkId: chunk.id as string,
    fileId: chunk.fileId as string,
    providerId: chunk.providerRef!.providerId,
    providerRef: chunk.providerRef!,
    role: 'PRIMARY',
    state: 'VERIFIED',
    verifiedAt: now,
    createdAt: now,
    updatedAt: now,
  };
  locationRepo.saveLocation(location);
  return location;
}

/* ─── V2.3 Test Suite ─── */

test('V2.3 — ReplicationEngine: Copy + SHA-256 Verify Lifecycle', async () => {
  // Setup: two in-memory providers
  ProviderRegistry.clear();
  const primary = new InMemoryStorageProvider('source-mem');
  const replica = new InMemoryStorageProvider('replica-mem');
  ProviderRegistry.register(primary);
  ProviderRegistry.register(replica);

  const db = createSqliteDatabase(':memory:');
  const locationRepo = new ChunkLocationRepository(db);
  const engine = new ReplicationEngine(locationRepo);

  const fileId = 'file-repl-test';
  const { chunks } = await seedFile(primary, db, fileId, 3);

  // Create PRIMARY locations
  for (const chunk of chunks) {
    createPrimaryLocation(chunk, locationRepo);
  }

  // Replicate to replica provider
  const progress = await engine.replicateFile(fileId, chunks, 'replica-mem');

  assert.strictEqual(progress.totalChunks, 3);
  assert.strictEqual(progress.verifiedChunks, 3);
  assert.strictEqual(progress.failedChunks, 0);

  // Verify replica locations exist and are VERIFIED
  for (const chunk of chunks) {
    const locations = locationRepo.getLocationsForChunk(chunk.id as string);
    assert.strictEqual(locations.length, 2); // PRIMARY + REPLICA
    const replicaLoc = locations.find((l) => l.providerId === 'replica-mem');
    assert.strictEqual(replicaLoc?.state, 'VERIFIED');
    assert.strictEqual(replicaLoc?.role, 'REPLICA');
    assert.ok(replicaLoc?.verifiedAt);
  }
});

test('V2.3 — VerificationEngine: Healthy vs Corrupted Detection', async () => {
  ProviderRegistry.clear();
  const provider = new InMemoryStorageProvider('verify-mem');
  ProviderRegistry.register(provider);

  const db = createSqliteDatabase(':memory:');
  const locationRepo = new ChunkLocationRepository(db);
  const verifier = new VerificationEngine(locationRepo);

  const fileId = 'file-verify-test';
  const { chunks, data } = await seedFile(provider, db, fileId, 2);

  // Create locations for both chunks
  for (const chunk of chunks) {
    createPrimaryLocation(chunk, locationRepo);
  }

  // Verify chunk 0 — should be healthy
  const loc0 = locationRepo.getLocationsForChunk(chunks[0].id as string)[0];
  const result0 = await verifier.verifyLocation(loc0, chunks[0].hash);
  assert.strictEqual(result0.valid, true);
  assert.strictEqual(result0.actualHash, chunks[0].hash);

  // Corrupt chunk 1 by overwriting its stored bytes with garbage
  provider.corruptChunk(chunks[1].providerRef!);

  // Verify chunk 1 — should detect corruption
  const loc1 = locationRepo.getLocationsForChunk(chunks[1].id as string)[0];
  const result1 = await verifier.verifyLocation(loc1, chunks[1].hash);
  assert.strictEqual(result1.valid, false);

  // Location should now be CORRUPTED
  const updatedLoc1 = locationRepo.getLocationById(loc1.id);
  assert.strictEqual(updatedLoc1?.state, 'CORRUPTED');
});

test('V2.3 — RepairEngine: Reconstruct Corrupted Chunk from Verified Source', async () => {
  ProviderRegistry.clear();
  const primary = new InMemoryStorageProvider('repair-primary');
  const replica = new InMemoryStorageProvider('repair-replica');
  ProviderRegistry.register(primary);
  ProviderRegistry.register(replica);

  const db = createSqliteDatabase(':memory:');
  const locationRepo = new ChunkLocationRepository(db);
  const replicator = new ReplicationEngine(locationRepo);
  const repairer = new RepairEngine(locationRepo);

  const fileId = 'file-repair-test';
  const { chunks, data } = await seedFile(primary, db, fileId, 2);

  // Create primary locations and replicate
  for (const chunk of chunks) {
    createPrimaryLocation(chunk, locationRepo);
  }
  await replicator.replicateFile(fileId, chunks, 'repair-replica');

  // Corrupt the primary copy of chunk 0 by overwriting bytes in-place
  primary.corruptChunk(chunks[0].providerRef!);

  // Mark primary location as CORRUPTED
  const primaryLocs = locationRepo.getLocationsForChunk(chunks[0].id as string);
  const damagedLoc = primaryLocs.find((l) => l.providerId === 'repair-primary')!;
  locationRepo.updateLocationState(damagedLoc.id, 'CORRUPTED');

  // Repair should use the VERIFIED replica to fix the primary
  const result = await repairer.repairFile(fileId, chunks);

  assert.strictEqual(result.repairedLocations, 1);
  assert.strictEqual(result.failedRepairs, 0);
  assert.strictEqual(result.details[0].sourceProviderId, 'repair-replica');
  assert.strictEqual(result.details[0].success, true);

  // Verify the repaired location is now VERIFIED
  const repairedLoc = locationRepo.getLocationById(damagedLoc.id);
  assert.strictEqual(repairedLoc?.state, 'VERIFIED');
});

test('V2.3 — Provider-Loss Recovery: Primary Provider Down, Repair from Replica', async () => {
  ProviderRegistry.clear();
  const primary = new InMemoryStorageProvider('lost-primary');
  const replica = new InMemoryStorageProvider('backup-replica');
  ProviderRegistry.register(primary);
  ProviderRegistry.register(replica);

  const db = createSqliteDatabase(':memory:');
  const locationRepo = new ChunkLocationRepository(db);
  const replicator = new ReplicationEngine(locationRepo);
  const repairer = new RepairEngine(locationRepo);

  const fileId = 'file-loss-test';
  const { chunks } = await seedFile(primary, db, fileId, 3);

  // Create primary locations and replicate to backup
  for (const chunk of chunks) {
    createPrimaryLocation(chunk, locationRepo);
  }
  await replicator.replicateFile(fileId, chunks, 'backup-replica');

  // Simulate complete primary provider loss — remove from registry and re-add an empty one
  ProviderRegistry.remove('lost-primary');
  const newPrimary = new InMemoryStorageProvider('lost-primary');
  ProviderRegistry.register(newPrimary);

  // Mark all primary locations as MISSING
  const allLocations = locationRepo.getLocationsForFile(fileId);
  for (const loc of allLocations) {
    if (loc.providerId === 'lost-primary') {
      locationRepo.updateLocationState(loc.id, 'MISSING');
    }
  }

  // Repair from backup replica
  const result = await repairer.repairFile(fileId, chunks);

  assert.strictEqual(result.repairedLocations, 3); // All 3 chunks restored
  assert.strictEqual(result.failedRepairs, 0);

  // Verify all repaired locations are VERIFIED
  for (const chunk of chunks) {
    const locs = locationRepo.getLocationsForChunk(chunk.id as string);
    const primaryLoc = locs.find((l) => l.providerId === 'lost-primary');
    assert.strictEqual(primaryLoc?.state, 'VERIFIED');
  }
});

test('V2.3 — Interrupted Replication: Resume After Crash', async () => {
  ProviderRegistry.clear();
  const primary = new InMemoryStorageProvider('int-primary');
  const replica = new InMemoryStorageProvider('int-replica');
  ProviderRegistry.register(primary);
  ProviderRegistry.register(replica);

  const db = createSqliteDatabase(':memory:');
  const locationRepo = new ChunkLocationRepository(db);
  const engine = new ReplicationEngine(locationRepo);

  const fileId = 'file-interrupt-test';
  const { chunks } = await seedFile(primary, db, fileId, 4);

  // Create primary locations
  for (const chunk of chunks) {
    createPrimaryLocation(chunk, locationRepo);
  }

  // Simulate partial replication: only replicate chunks 0 and 1
  const partialChunks = chunks.slice(0, 2);
  await engine.replicateFile(fileId, partialChunks, 'int-replica');

  // Verify: chunks 0,1 have replicas; chunks 2,3 do not
  const locsAfterCrash = locationRepo.getLocationsForFile(fileId);
  const replicaCount = locsAfterCrash.filter(
    (l) => l.providerId === 'int-replica' && l.state === 'VERIFIED'
  ).length;
  assert.strictEqual(replicaCount, 2);

  // Resume: replicate ALL chunks (already-verified ones should be skipped)
  const resumeProgress = await engine.replicateFile(fileId, chunks, 'int-replica');

  assert.strictEqual(resumeProgress.verifiedChunks, 4); // 2 skipped + 2 newly copied
  assert.strictEqual(resumeProgress.failedChunks, 0);

  // All 4 chunks now have replicas
  const finalLocs = locationRepo.getLocationsForFile(fileId);
  const finalReplicaCount = finalLocs.filter(
    (l) => l.providerId === 'int-replica' && l.state === 'VERIFIED'
  ).length;
  assert.strictEqual(finalReplicaCount, 4);
});

test('V2.3 — Full E2E Redundancy Lifecycle', async () => {
  ProviderRegistry.clear();
  const telegram = new InMemoryStorageProvider('telegram');
  const localDisk = new InMemoryStorageProvider('local-disk');
  ProviderRegistry.register(telegram);
  ProviderRegistry.register(localDisk);

  const db = createSqliteDatabase(':memory:');
  const locationRepo = new ChunkLocationRepository(db);
  const replicator = new ReplicationEngine(locationRepo);
  const verifier = new VerificationEngine(locationRepo);
  const repairer = new RepairEngine(locationRepo);

  // Step 1: Upload file to Telegram (primary)
  const fileId = 'file-e2e-redundancy';
  const { chunks, data } = await seedFile(telegram, db, fileId, 3, 2048);

  for (const chunk of chunks) {
    createPrimaryLocation(chunk, locationRepo);
  }

  // Step 2: Replicate to Local Disk
  const replProgress = await replicator.replicateFile(fileId, chunks, 'local-disk');
  assert.strictEqual(replProgress.verifiedChunks, 3);

  // Step 3: Verify all locations — everything should be healthy
  const report1 = await verifier.verifyFile(fileId, chunks);
  assert.strictEqual(report1.totalLocations, 6); // 3 primary + 3 replica
  assert.strictEqual(report1.verified, 6);
  assert.strictEqual(report1.corrupted, 0);
  assert.strictEqual(report1.missing, 0);

  // Step 4: Corrupt Telegram chunk 1 by overwriting bytes in-place
  telegram.corruptChunk(chunks[1].providerRef!);

  // Step 5: Re-verify — should detect corruption on Telegram chunk 1
  const report2 = await verifier.verifyFile(fileId, chunks);
  assert.strictEqual(report2.corrupted, 1);
  assert.strictEqual(report2.verified, 5);

  // Step 6: Repair — should fix Telegram chunk 1 from Local Disk replica
  const repairResult = await repairer.repairFile(fileId, chunks);
  assert.strictEqual(repairResult.repairedLocations, 1);
  assert.strictEqual(repairResult.details[0].sourceProviderId, 'local-disk');

  // Step 7: Final verification — everything healthy again
  const report3 = await verifier.verifyFile(fileId, chunks);
  assert.strictEqual(report3.verified, 6);
  assert.strictEqual(report3.corrupted, 0);
  assert.strictEqual(report3.missing, 0);

  console.log('🎉 V2.3 Full E2E Redundancy Lifecycle Test PASSED!');
});
