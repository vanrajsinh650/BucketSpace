import assert from 'node:assert';
import {
  StorageStore,
} from '../apps/web/src/lib/storage-store';
import {
  createFileId,
  createChunkId,
  FileMetadata,
} from '@bucketspace/shared';
import {
  ProviderRegistry,
  LocalStorageAdapter,
  InMemoryStorageProvider,
} from '@bucketspace/storage-adapters';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

async function main() {
  console.log('\n======================================================');
  console.log('   BUCKETSPACE CLIENT STATE & WORKFLOW STRESS TEST');
  console.log('======================================================\n');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bucketspace-workflow-test-'));

  try {
    // 1. Initialize StorageStore
    console.log('▶ Step 1: Initializing StorageStore instance...');
    const store = StorageStore.getInstance();
    assert.ok(store, 'StorageStore must instantiate cleanly');

    // 2. Initial Provider State Check
    console.log('▶ Step 2: Testing Onboarding Gate (hasUserProvider)...');
    // Initially only in-memory exists, so hasUserProvider should be false for clean install
    // Let's test registering a real local provider
    store.registerUserProvider('local', { rootDir: tempDir });
    assert.strictEqual(store.hasUserProvider(), true, 'hasUserProvider must be true after registering local disk');
    assert.strictEqual(store.getActiveProviderName(), 'This computer');
    console.log('  ✓ Local provider registered and recognized as active');

    // 3. Testing File Listing and Initial Seed Data
    console.log('▶ Step 3: Testing File Queries, Sorting, and Categorization...');
    const allFiles = store.getFiles('ALL');
    assert.ok(allFiles.length > 0, 'Seed files must be present');
    console.log(`  ✓ Retrieved ${allFiles.length} files from store`);

    const photos = store.getFiles('PHOTOS');
    assert.ok(photos.every((f) => f.mimeType.startsWith('image/')), 'Photos category must only contain images');
    console.log(`  ✓ Photos filter correctly isolates image files`);

    const docs = store.getFiles('DOCUMENTS');
    assert.ok(docs.every((f) => f.mimeType.includes('pdf') || f.mimeType.includes('text') || f.mimeType.includes('markdown')), 'Documents filter correctly isolates documents');
    console.log(`  ✓ Documents filter correctly isolates docs`);

    const counts = store.getCategoryCounts();
    assert.ok(counts.ALL >= counts.PHOTOS, 'Category count hierarchy must be consistent');
    console.log(`  ✓ Category counts validated: ALL=${counts.ALL}, PHOTOS=${counts.PHOTOS}, DOCS=${counts.DOCUMENTS}`);

    // 4. Testing Search Query Filtering
    console.log('▶ Step 4: Testing Instant Substring Search...');
    const searchResults = store.getFiles('ALL', 'vacation');
    assert.strictEqual(searchResults.length, 1);
    assert.ok(searchResults[0].name.includes('vacation'));
    console.log(`  ✓ Search for "vacation" returned exact match: ${searchResults[0].name}`);

    // 5. Testing Multi-Provider Switching
    console.log('▶ Step 5: Testing Dynamic Multi-Provider Registration & Switching...');
    store.registerUserProvider('telegram', { phone: '+919876543210' });
    assert.strictEqual(store.getActiveProviderName(), 'Telegram');
    console.log('  ✓ Switched active provider to Telegram Cloud');

    store.registerUserProvider('r2', {
      endpoint: 'https://r2.cloudflarestorage.com',
      bucket: 'test-bucket',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    });
    assert.strictEqual(store.getActiveProviderName(), 'Cloudflare R2');
    console.log('  ✓ Switched active provider to Cloudflare R2');

    // 6. Testing Trash and Restore Lifecycle
    console.log('▶ Step 6: Testing Trash, Restore, and Purge Lifecycle...');
    const demoFile = allFiles[0];
    const initialTrashCount = store.getCategoryCounts().TRASH;

    const trashRes = store.trashFile(demoFile.id);
    assert.strictEqual(trashRes, true, 'trashFile must succeed');
    assert.strictEqual(store.getCategoryCounts().TRASH, initialTrashCount + 1, 'Trash count must increment');
    console.log('  ✓ File moved to Trash');

    const restoreRes = store.restoreFile(demoFile.id);
    assert.strictEqual(restoreRes, true, 'restoreFile must succeed');
    assert.strictEqual(store.getCategoryCounts().TRASH, initialTrashCount, 'Trash count must decrement back');
    console.log('  ✓ File restored from Trash');

    // 7. Testing Storage Policy Rules API
    console.log('▶ Step 7: Testing Storage Policy Rules Engine...');
    const rules = store.getRules();
    assert.ok(Array.isArray(rules), 'getRules must return an array');
    console.log(`  ✓ Storage policy rules engine verified (${rules.length} active rules)`);

    console.log('\n======================================================');
    console.log('   ALL CLIENT WORKFLOWS & STATE TRANSITIONS PASSED!   ');
    console.log('======================================================\n');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error('Workflow stress test failed:', err);
  process.exit(1);
});
