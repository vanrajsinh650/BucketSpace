import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { StorageRule } from '@bucketspace/shared';
import { createSqliteDatabase, SqliteMetadataRepository, StorageRuleRepository } from '@bucketspace/db';
import {
  matchesCondition,
  matchesRule,
  StoragePolicyEngine,
  StorageRouter,
  ProviderRegistry,
  StorageApplicationService,
  InMemoryStorageProvider,
  TelegramStorageAdapter,
} from '../src';

/* ─── V2.2 Storage Policy Engine Master Test Suite ─── */

test('V2.2 — RuleMatcher: MIME, Extension, and Size conditions', () => {
  const fileInfo = {
    name: 'vacation_photo.JPG',
    mimeType: 'image/jpeg',
    size: 2 * 1024 * 1024 * 1024, // 2 GB
  };

  // MIME startsWith
  assert.strictEqual(
    matchesCondition({ field: 'mimeType', operator: 'startsWith', value: 'image/' }, fileInfo),
    true
  );
  assert.strictEqual(
    matchesCondition({ field: 'mimeType', operator: 'startsWith', value: 'video/' }, fileInfo),
    false
  );

  // Extension case-insensitive matching
  assert.strictEqual(
    matchesCondition({ field: 'extension', operator: 'equals', value: 'jpg' }, fileInfo),
    true
  );
  assert.strictEqual(
    matchesCondition({ field: 'extension', operator: 'equals', value: 'png' }, fileInfo),
    false
  );

  // Size numeric operators (2GB > 1GB)
  const oneGigBytes = (1024 * 1024 * 1024).toString();
  assert.strictEqual(
    matchesCondition({ field: 'size', operator: 'gt', value: oneGigBytes }, fileInfo),
    true
  );
  assert.strictEqual(
    matchesCondition({ field: 'size', operator: 'lt', value: oneGigBytes }, fileInfo),
    false
  );
});

test('V2.2 — RuleMatcher: Multi-condition AND logic', () => {
  const fileInfo = {
    name: 'large_video.mp4',
    mimeType: 'video/mp4',
    size: 1.5 * 1024 * 1024 * 1024, // 1.5 GB
  };

  const rule: StorageRule = {
    id: 'rule-large-video',
    name: 'Large Video to Local Disk',
    priority: 100,
    enabled: true,
    conditions: [
      { field: 'mimeType', operator: 'startsWith', value: 'video/' },
      { field: 'size', operator: 'gt', value: (1024 * 1024 * 1024).toString() },
    ],
    action: { type: 'STORE', providerId: 'local-disk' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  assert.strictEqual(matchesRule(rule, fileInfo), true);

  // Small video shouldn't match
  const smallVideoInfo = { ...fileInfo, size: 500 * 1024 * 1024 };
  assert.strictEqual(matchesRule(rule, smallVideoInfo), false);
});

test('V2.2 — StoragePolicyEngine: Priority ordering and Conflict Resolution', () => {
  const engine = new StoragePolicyEngine();

  // Rule 1 (Priority 10): All photos go to Telegram
  const photoRule: StorageRule = {
    id: 'photos-rule',
    name: 'Photos to Telegram',
    priority: 10,
    enabled: true,
    conditions: [{ field: 'mimeType', operator: 'startsWith', value: 'image/' }],
    action: { type: 'STORE', providerId: 'telegram' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Rule 2 (Priority 100): Files > 1GB go to Local Disk
  const largeFileRule: StorageRule = {
    id: 'large-files-rule',
    name: 'Large Files to Local Disk',
    priority: 100,
    enabled: true,
    conditions: [{ field: 'size', operator: 'gt', value: (1024 * 1024 * 1024).toString() }],
    action: { type: 'STORE', providerId: 'local-disk' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const rules = [photoRule, largeFileRule]; // Array order doesn't matter, priority 100 wins

  // 1. Small photo (2MB) -> Matches photoRule (Telegram)
  const smallPhoto = { name: 'snap.jpg', mimeType: 'image/jpeg', size: 2 * 1024 * 1024 };
  const res1 = engine.evaluate(rules, smallPhoto, 'fallback-provider');
  assert.strictEqual(res1.matched, true);
  assert.strictEqual(res1.rule?.id, 'photos-rule');
  assert.strictEqual(res1.providerId, 'telegram');

  // 2. Huge photo (2GB) -> Matches largeFileRule first because Priority 100 > Priority 10 (Local Disk)
  const hugePhoto = { name: 'panorama_raw.jpg', mimeType: 'image/jpeg', size: 2 * 1024 * 1024 * 1024 };
  const res2 = engine.evaluate(rules, hugePhoto, 'fallback-provider');
  assert.strictEqual(res2.matched, true);
  assert.strictEqual(res2.rule?.id, 'large-files-rule');
  assert.strictEqual(res2.providerId, 'local-disk');

  // 3. Unmatched file -> Fallback to default
  const unmatched = { name: 'app.iso', mimeType: 'application/x-iso9660-image', size: 500 * 1024 * 1024 };
  const res3 = engine.evaluate(rules, unmatched, 'fallback-provider');
  assert.strictEqual(res3.matched, false);
  assert.strictEqual(res3.providerId, 'fallback-provider');
});

test('V2.2 — StoragePolicyEngine: Disabled rules are ignored', () => {
  const engine = new StoragePolicyEngine();

  const disabledRule: StorageRule = {
    id: 'disabled-rule',
    name: 'Disabled Rule',
    priority: 1000,
    enabled: false, // DISABLED
    conditions: [{ field: 'mimeType', operator: 'startsWith', value: 'image/' }],
    action: { type: 'STORE', providerId: 'disabled-target' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const res = engine.evaluate([disabledRule], { name: 'pic.png', mimeType: 'image/png', size: 100 }, 'default-disk');
  assert.strictEqual(res.matched, false);
  assert.strictEqual(res.providerId, 'default-disk');
});

test('V2.2 — SQLite StorageRuleRepository: CRUD Operations & Provider Safety', () => {
  const db = createSqliteDatabase(':memory:');
  const repo = new StorageRuleRepository(db);

  const now = new Date();
  const rule1: StorageRule = {
    id: 'rule-1',
    name: 'Rule One',
    priority: 50,
    enabled: true,
    conditions: [{ field: 'mimeType', operator: 'startsWith', value: 'image/' }],
    action: { type: 'STORE', providerId: 'telegram' },
    createdAt: now,
    updatedAt: now,
  };

  const rule2: StorageRule = {
    id: 'rule-2',
    name: 'Rule Two High Priority',
    priority: 200,
    enabled: true,
    conditions: [{ field: 'extension', operator: 'equals', value: 'pdf' }],
    action: { type: 'STORE', providerId: 's3-r2' },
    createdAt: now,
    updatedAt: now,
  };

  // Create
  repo.createRule(rule1);
  repo.createRule(rule2);

  // List (Sorted by priority DESC)
  const list = repo.listRules();
  assert.strictEqual(list.length, 2);
  assert.strictEqual(list[0].id, 'rule-2'); // 200 > 50
  assert.strictEqual(list[1].id, 'rule-1');

  // Update
  repo.updateRule({ ...rule1, priority: 300 });
  const updatedList = repo.listRules();
  assert.strictEqual(updatedList[0].id, 'rule-1'); // Now 300 > 200

  // Provider removal safety check (Acceptance #19)
  // Removing 'telegram' should disable rule-1 automatically
  const disabledCount = repo.disableRulesByProvider('telegram');
  assert.strictEqual(disabledCount, 1);

  const rule1Fetched = repo.getRuleById('rule-1');
  assert.strictEqual(rule1Fetched?.enabled, false);

  // Delete
  assert.strictEqual(repo.deleteRule('rule-2'), true);
  assert.strictEqual(repo.listRules().length, 1);
});

test('V2.2 — Detailed Evaluation Preview UI support', () => {
  const router = new StorageRouter('local-disk');
  router.clearRules();

  router.addRule({
    id: 'rule-preview-test',
    name: 'Images to Telegram',
    priority: 10,
    enabled: true,
    conditions: [{ field: 'mimeType', operator: 'startsWith', value: 'image/' }],
    action: { type: 'STORE', providerId: 'telegram' },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const preview = router.evaluateDetailed({
    name: 'photo.jpg',
    mimeType: 'image/jpeg',
    size: 5000,
  });

  assert.strictEqual(preview.matched, true);
  assert.strictEqual(preview.rule?.name, 'Images to Telegram');
  assert.strictEqual(preview.providerId, 'telegram');
  assert.strictEqual(preview.matchedConditions?.length, 1);
  assert.strictEqual(preview.matchedConditions?.[0].passed, true);
});
