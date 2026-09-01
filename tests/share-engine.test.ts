import { describe, it } from 'node:test';
import assert from 'node:assert';
import { TokenShareProvider } from '../src/modules/storage/share/token-share-provider';
import { ShareEngine } from '../src/modules/storage/share/share-engine';
import { SqliteMetadataRepository } from '../src/modules/db/sqlite/sqlite-metadata-repository';
import { createFileId, FileMetadata } from '../src/shared';

describe('ShareEngine & TokenShareProvider - Public Link Sharing', () => {
  it('should generate secure share tokens and support revocation', async () => {
    const repo = new SqliteMetadataRepository(':memory:');
    const tokenProvider = new TokenShareProvider();
    const shareEngine = new ShareEngine(repo, tokenProvider);

    const fileId = createFileId(`file_${Date.now()}`);
    const fileMeta: FileMetadata = {
      id: fileId,
      name: 'financial_report_2026.xlsx',
      size: 524288,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      wholeFileHash: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
      chunks: [],
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await repo.createFile(fileMeta, 'COMPLETED');

    // 1. Create a public share link
    const link = await shareEngine.createShareLink(fileId, {
      expiresInSeconds: 3600,
    });

    assert.ok(link.shareId, 'Share ID must be generated');
    assert.strictEqual(link.fileId, fileId);

    // 2. Validate resolution
    const resolvedLink = await tokenProvider.getShareLink(link.shareId);
    assert.ok(resolvedLink, 'Share link must be resolved');
    assert.strictEqual(resolvedLink.fileId, fileId);

    // 3. Revoke share link
    await shareEngine.revokeShareLink(link.shareId);
    const resolvedAfterRevoke = await tokenProvider.getShareLink(link.shareId);
    assert.strictEqual(resolvedAfterRevoke, null, 'Revoked share link must return null');
  });
});
