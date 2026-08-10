import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { SqliteMetadataRepository } from '@bucketspace/db';
import { StorageApplicationService } from '../src/application/storage-application.service';
import { InMemoryStorageProvider } from '../src/in-memory/in-memory-storage-provider';
import { ProviderRegistry } from '../src/registry/provider-registry';

test('V1.5 — SQLite Search & TokenShareProvider Integration', async () => {
  ProviderRegistry.clear();

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bucketspace-v15-'));
  const dbPath = path.join(tempDir, 'metadata.db');
  const sourcePath1 = path.join(tempDir, 'vacation_photo.jpg');
  const sourcePath2 = path.join(tempDir, 'financial_report.pdf');

  fs.writeFileSync(sourcePath1, 'photo-content-bytes');
  fs.writeFileSync(sourcePath2, 'pdf-content-bytes');

  const repo = new SqliteMetadataRepository(dbPath);
  const provider = new InMemoryStorageProvider();
  ProviderRegistry.register(provider);

  const appService = new StorageApplicationService({
    repository: repo,
    defaultProviderId: 'in-memory',
    defaultChunkSize: 1024 * 1024,
  });

  const photo = await appService.uploadFile({
    filePath: sourcePath1,
    name: 'vacation_photo.jpg',
    mimeType: 'image/jpeg',
  });

  const pdf = await appService.uploadFile({
    filePath: sourcePath2,
    name: 'financial_report.pdf',
    mimeType: 'application/pdf',
  });

  // 1. Instant SQLite Search by name
  const searchResults1 = await appService.searchFiles('vacation');
  assert.strictEqual(searchResults1.length, 1);
  assert.strictEqual(searchResults1[0].name, 'vacation_photo.jpg');

  const searchResults2 = await appService.searchFiles('pdf');
  assert.strictEqual(searchResults2.length, 1);
  assert.strictEqual(searchResults2[0].name, 'financial_report.pdf');

  // 2. Share Link Creation
  const shareLink = await appService.createShareLink(photo.id, {
    expiresInSeconds: 3600,
    baseUrl: 'https://drive.bucketspace.io',
  });

  assert.strictEqual(shareLink.fileId, photo.id);
  assert.strictEqual(shareLink.url, `https://drive.bucketspace.io/share/${shareLink.shareId}`);
  assert.ok(shareLink.expiresAt);

  repo.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
});
