import assert from 'node:assert';
import test from 'node:test';
import { createFileId, FileMetadata } from '@bucketspace/shared';
import { DuplicateResolver } from '../src';

/* ─── 1.0 Release Candidate: Duplicate Detection & Collision Resolution ─── */

test('1.0 RC Duplicate — Case A: Same Filename, Different Content (Auto-Rename Sequence)', () => {
  const existingFiles: FileMetadata[] = [
    {
      id: createFileId('f1'),
      name: 'financial_report.pdf',
      size: 1024 * 1024,
      mimeType: 'application/pdf',
      wholeFileHash: 'hash-version-1',
      status: 'ACTIVE',
      createdAt: new Date('2026-08-01'),
      updatedAt: new Date('2026-08-01'),
      chunks: [],
    },
  ];

  // Incoming same filename with DIFFERENT hash
  const result = DuplicateResolver.checkDuplicate(
    'financial_report.pdf',
    'hash-version-2',
    existingFiles
  );

  assert.strictEqual(result.scenario, 'SAME_NAME_DIFFERENT_CONTENT');
  assert.ok(result.existingFile !== undefined);
  assert.strictEqual(result.existingFile?.name, 'financial_report.pdf');
  assert.strictEqual(result.suggestedName, 'financial_report (1).pdf');

  // Verify multi-collision sequence (financial_report (1).pdf already exists -> financial_report (2).pdf)
  const existingWithCopies: FileMetadata[] = [
    ...existingFiles,
    {
      id: createFileId('f2'),
      name: 'financial_report (1).pdf',
      size: 1024 * 1024,
      mimeType: 'application/pdf',
      wholeFileHash: 'hash-version-2',
      status: 'ACTIVE',
      createdAt: new Date('2026-08-02'),
      updatedAt: new Date('2026-08-02'),
      chunks: [],
    },
  ];

  const nextResult = DuplicateResolver.checkDuplicate(
    'financial_report.pdf',
    'hash-version-3',
    existingWithCopies
  );
  assert.strictEqual(nextResult.suggestedName, 'financial_report (2).pdf');
});

test('1.0 RC Duplicate — Case B: Same Filename, Identical Content (True Duplicate Warning)', () => {
  const existingFiles: FileMetadata[] = [
    {
      id: createFileId('f1'),
      name: 'passport_scan.jpg',
      size: 2 * 1024 * 1024,
      mimeType: 'image/jpeg',
      wholeFileHash: 'hash-identical-bytes-xyz',
      status: 'ACTIVE',
      createdAt: new Date('2026-08-10'),
      updatedAt: new Date('2026-08-10'),
      chunks: [],
    },
  ];

  // Incoming same name AND identical SHA-256
  const result = DuplicateResolver.checkDuplicate(
    'passport_scan.jpg',
    'hash-identical-bytes-xyz',
    existingFiles
  );

  assert.strictEqual(result.scenario, 'SAME_NAME_IDENTICAL_CONTENT');
  assert.strictEqual(result.existingFile?.id, 'f1');
});

test('1.0 RC Duplicate — Case C: Different Filename, Identical Content (Intentional Alias Preservation)', () => {
  const existingFiles: FileMetadata[] = [
    {
      id: createFileId('f1'),
      name: 'IMG_1234.jpg',
      size: 2 * 1024 * 1024,
      mimeType: 'image/jpeg',
      wholeFileHash: 'hash-shared-payload-999',
      status: 'ACTIVE',
      createdAt: new Date('2026-08-10'),
      updatedAt: new Date('2026-08-10'),
      chunks: [],
    },
  ];

  // Uploading identical photo under user-intended name 'Vacation.jpg'
  const result = DuplicateResolver.checkDuplicate(
    'Vacation.jpg',
    'hash-shared-payload-999',
    existingFiles
  );

  assert.strictEqual(result.scenario, 'DIFFERENT_NAME_IDENTICAL_CONTENT');
  assert.strictEqual(result.existingFile?.name, 'IMG_1234.jpg');
  // Does not force renaming because 'Vacation.jpg' is unique by name
  assert.strictEqual(result.suggestedName, 'Vacation.jpg');
});

test('1.0 RC Duplicate — Policy Evaluation Engine (Auto-actions vs Prompt User)', () => {
  const checkCaseB = {
    scenario: 'SAME_NAME_IDENTICAL_CONTENT' as const,
    suggestedName: 'test (1).pdf',
  };

  // Default policy prompts user
  assert.strictEqual(
    DuplicateResolver.resolvePolicyAction(checkCaseB, {
      identicalContentPolicy: 'ASK',
      nameConflictPolicy: 'ASK',
    }),
    'PROMPT_USER'
  );

  // Policy: SKIP identical duplicates automatically
  assert.strictEqual(
    DuplicateResolver.resolvePolicyAction(checkCaseB, {
      identicalContentPolicy: 'SKIP',
      nameConflictPolicy: 'ASK',
    }),
    'SKIP'
  );

  // Policy: REPLACE_EXISTING for name conflicts
  const checkCaseA = {
    scenario: 'SAME_NAME_DIFFERENT_CONTENT' as const,
    suggestedName: 'test (1).pdf',
  };
  assert.strictEqual(
    DuplicateResolver.resolvePolicyAction(checkCaseA, {
      identicalContentPolicy: 'ASK',
      nameConflictPolicy: 'REPLACE_EXISTING',
    }),
    'REPLACE_EXISTING'
  );

  // Policy: KEEP_BOTH for name conflicts
  assert.strictEqual(
    DuplicateResolver.resolvePolicyAction(checkCaseA, {
      identicalContentPolicy: 'ASK',
      nameConflictPolicy: 'KEEP_BOTH',
    }),
    'KEEP_BOTH'
  );
});
