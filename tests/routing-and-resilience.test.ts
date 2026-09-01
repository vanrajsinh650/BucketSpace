import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  concatByteArrays,
  createFileId,
  FileMetadata,
  FileRoutingInfo,
  StorageRule,
} from '../src/shared';
import { StoragePolicyEngine } from '../src/modules/storage/routing/storage-policy-engine';
import { StorageRouter } from '../src/modules/storage/routing/storage-router';
import { DuplicateResolver } from '../src/modules/storage/duplicate/duplicate-resolver';
import { BackupManager } from '../src/modules/storage/resilience/backup-manager';
import { SqliteMetadataRepository } from '../src/modules/db/sqlite/sqlite-metadata-repository';
import { InMemoryStorageProvider } from '../src/modules/storage/in-memory/in-memory-storage-provider';
import { ProviderRegistry } from '../src/modules/storage/registry/provider-registry';

describe('Canonical Byte Utilities & Routing Engine', () => {
  it('concatByteArrays should accurately merge arrays of byte buffers', () => {
    const b1 = new Uint8Array([1, 2, 3]);
    const b2 = new Uint8Array([4, 5]);
    const b3 = new Uint8Array([6, 7, 8, 9]);

    const merged = concatByteArrays([b1, b2, b3]);
    assert.strictEqual(merged.length, 9);
    assert.deepStrictEqual(Array.from(merged), [1, 2, 3, 4, 5, 6, 7, 8, 9]);

    const emptyMerged = concatByteArrays([]);
    assert.strictEqual(emptyMerged.length, 0);
  });

  it('StoragePolicyEngine should evaluate rules by priority descending', () => {
    const engine = new StoragePolicyEngine();

    const rules: StorageRule[] = [
      {
        id: 'rule-low',
        name: 'Low Priority Video',
        priority: 10,
        enabled: true,
        conditions: [{ field: 'extension', operator: 'equals', value: 'mp4' }],
        action: { providerId: 'telegram' },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'rule-high',
        name: 'High Priority Video Large',
        priority: 50,
        enabled: true,
        conditions: [
          { field: 'extension', operator: 'equals', value: 'mp4' },
          { field: 'size', operator: 'gt', value: 1000000 },
        ],
        action: { providerId: 's3-cold' },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // 1. Large video matches high priority rule
    const largeVideo: FileRoutingInfo = {
      name: 'movie.mp4',
      size: 5000000,
      mimeType: 'video/mp4',
    };
    const res1 = engine.evaluate(rules, largeVideo, 'default-provider');
    assert.strictEqual(res1.matched, true);
    assert.strictEqual(res1.providerId, 's3-cold');

    // 2. Small video falls through to low priority rule
    const smallVideo: FileRoutingInfo = {
      name: 'clip.mp4',
      size: 500,
      mimeType: 'video/mp4',
    };
    const res2 = engine.evaluate(rules, smallVideo, 'default-provider');
    assert.strictEqual(res2.matched, true);
    assert.strictEqual(res2.providerId, 'telegram');

    // 3. Document falls through to default
    const doc: FileRoutingInfo = {
      name: 'notes.pdf',
      size: 500,
      mimeType: 'application/pdf',
    };
    const res3 = engine.evaluate(rules, doc, 'default-provider');
    assert.strictEqual(res3.matched, false);
    assert.strictEqual(res3.providerId, 'default-provider');
  });

  it('DuplicateResolver should detect name collisions and generate auto-numbered filenames', () => {
    const existing: FileMetadata[] = [
      {
        id: createFileId('f1'),
        name: 'report.pdf',
        size: 1000,
        mimeType: 'application/pdf',
        wholeFileHash: 'hash_abc123',
        chunks: [],
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // 1. Exact collision (same name + same content)
    const check1 = DuplicateResolver.checkDuplicate('report.pdf', 'hash_abc123', existing);
    assert.strictEqual(check1.scenario, 'SAME_NAME_IDENTICAL_CONTENT');
    assert.strictEqual(check1.suggestedName, 'report (1).pdf');

    // 2. Name collision with different content
    const check2 = DuplicateResolver.checkDuplicate('report.pdf', 'hash_different', existing);
    assert.strictEqual(check2.scenario, 'SAME_NAME_DIFFERENT_CONTENT');
    assert.strictEqual(check2.suggestedName, 'report (1).pdf');

    // 3. Numbered collision series
    const numbered = DuplicateResolver.generateNumberedName('report.pdf', [
      'report.pdf',
      'report (1).pdf',
      'report (2).pdf',
    ]);
    assert.strictEqual(numbered, 'report (3).pdf');
  });

  it('BackupManager should audit restored metadata and verify chunk presence', async () => {
    const metaRepo = new SqliteMetadataRepository(':memory:');
    const inMem = new InMemoryStorageProvider('in-memory');
    ProviderRegistry.register(inMem);

    const chunkData = new Uint8Array([10, 20, 30, 40]);
    const ref = await inMem.putChunk({
      chunkId: 'chk_1',
      size: 4,
      hash: 'testhash',
      data: (async function* () { yield chunkData; })(),
    });

    const file: FileMetadata = {
      id: createFileId('file_audit_test'),
      name: 'backup_target.bin',
      size: 4,
      mimeType: 'application/octet-stream',
      wholeFileHash: 'testhash',
      chunks: [
        {
          id: 'chk_1' as any,
          fileId: createFileId('file_audit_test'),
          index: 0,
          size: 4,
          hash: 'testhash',
          providerRef: ref,
        },
      ],
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await metaRepo.createFile(file, 'COMPLETED');

    const audit = await BackupManager.verifyRestoredInstallation(metaRepo);
    assert.strictEqual(audit.totalFiles, 1);
    assert.strictEqual(audit.verifiedFiles, 1);
    assert.strictEqual(audit.missingChunks, 0);

    // Delete chunk from provider and verify missing chunk detection
    await inMem.deleteChunk(ref);
    const auditAfterDelete = await BackupManager.verifyRestoredInstallation(metaRepo);
    assert.strictEqual(auditAfterDelete.missingChunks, 1);
    assert.strictEqual(auditAfterDelete.verifiedFiles, 0);
  });
});
