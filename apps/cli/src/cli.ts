#!/usr/bin/env node
import { existsSync, statSync } from 'node:fs';
import { basename, resolve } from 'node:path';
import { SqliteMetadataRepository, SqliteSyncLedgerRepository } from '@bucketspace/db';
import { createFileId, IStorageProvider } from '@bucketspace/shared';
import {
  InMemoryStorageProvider,
  ProviderRegistry,
  RecoveryEngine,
  StorageApplicationService,
  SyncDaemon,
  TelegramStorageAdapter,
  TransferOrchestrator,
} from '@bucketspace/storage-adapters';

function printUsage(): void {
  console.log(`
📦 BucketSpace CLI Laboratory

Usage:
  bucketspace add <filepath>                 Upload a file to BucketSpace
  bucketspace list [--trashed]               List stored files (active or trashed)
  bucketspace info <file-id>                 Show file metadata & chunk references
  bucketspace download <file-id> <destpath>  Download and verify file by ID
  bucketspace delete <file-id>               Soft-delete file to Trash (metadata state = TRASHED)
  bucketspace restore <file-id>              Restore soft-deleted file back to Active
  bucketspace purge <file-id>                Permanently purge file from SQLite & Provider
  bucketspace verify <file-id>               Verify chunk presence & provider health
  bucketspace resume <file-id> <filepath>    Resume/repair missing or unverified chunks
  bucketspace sync [--folder <path>] [--once] Watch & auto-sync local directory with cloud drive
  bucketspace sync status                    Show current folder sync ledger stats
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }

  const command = args[0];

  // 1. Initialize Metadata DB
  const dbPath = process.env.BUCKETSPACE_DB_PATH ?? resolve(process.cwd(), 'bucketspace.db');
  const repo = new SqliteMetadataRepository(dbPath);

  // 2. Initialize Provider (Telegram if credentials exist, otherwise InMemoryStorageProvider)
  let provider: IStorageProvider;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_STORAGE_CHAT_ID;

  if (botToken && chatId) {
    provider = new TelegramStorageAdapter({
      botToken,
      defaultChatId: chatId,
    });
  } else {
    provider = new InMemoryStorageProvider();
  }

  try {
    switch (command) {
      case 'add': {
        const filePath = args[1];
        if (!filePath || !existsSync(filePath)) {
          console.error('Error: Please provide a valid file path to add');
          process.exit(1);
        }

        const fileName = basename(filePath);
        const stats = statSync(filePath);
        console.log(`⏳ Adding file '${fileName}' (${(stats.size / 1024 / 1024).toFixed(2)} MB)...`);

        const file = await TransferOrchestrator.uploadFile({
          filePath,
          name: fileName,
          mimeType: 'application/octet-stream',
          chunkSize: 5 * 1024 * 1024, // 5MB chunk invariant
          provider,
          repository: repo,
        });

        console.log(`✅ File added successfully!`);
        console.log(`   ID:            ${file.id}`);
        console.log(`   Name:          ${file.name}`);
        console.log(`   Size:          ${file.size} bytes`);
        console.log(`   SHA-256:       ${file.wholeFileHash}`);
        console.log(`   Chunks Count:  ${file.chunks.length}`);
        break;
      }

      case 'list': {
        const includeTrashed = args.includes('--trashed');
        const files = await repo.listFiles({ includeTrashed });
        console.log(`\n📦 Stored Files (${files.length}):`);
        console.log(`--------------------------------------------------------------------------------`);
        console.log(`ID                                    Name                 Status    Size (MB)   Chunks`);
        console.log(`--------------------------------------------------------------------------------`);
        for (const file of files) {
          const sizeMb = (file.size / 1024 / 1024).toFixed(2).padStart(8);
          console.log(
            `${file.id.padEnd(36)}  ${file.name.padEnd(18)}  ${file.status.padEnd(8)}  ${sizeMb}   ${file.chunks.length}`
          );
        }
        console.log(`--------------------------------------------------------------------------------\n`);
        break;
      }

      case 'info': {
        const fileId = args[1];
        if (!fileId) {
          console.error('Error: Please provide a file ID');
          process.exit(1);
        }

        const file = await repo.getFileById(createFileId(fileId));
        if (!file) {
          console.error(`Error: File '${fileId}' not found in metadata database`);
          process.exit(1);
        }

        console.log(`\n📄 File Information:`);
        console.log(`   ID:            ${file.id}`);
        console.log(`   Name:          ${file.name}`);
        console.log(`   Size:          ${file.size} bytes`);
        console.log(`   Status:        ${file.status}`);
        console.log(`   SHA-256:       ${file.wholeFileHash}`);
        console.log(`   Created At:    ${file.createdAt.toISOString()}`);
        console.log(`   Chunks (${file.chunks.length}):`);
        for (const chunk of file.chunks) {
          console.log(
            `     - Index ${chunk.index}: ${chunk.size} bytes | hash: ${chunk.hash.substring(0, 16)}... | provider: ${chunk.providerRef?.providerId ?? 'none'}`
          );
        }
        console.log(``);
        break;
      }

      case 'download': {
        const fileId = args[1];
        const destPath = args[2];
        if (!fileId || !destPath) {
          console.error('Error: Usage: bucketspace download <file-id> <destpath>');
          process.exit(1);
        }

        console.log(`⏳ Downloading file '${fileId}' to '${destPath}'...`);
        const result = await TransferOrchestrator.downloadFile({
          fileId: createFileId(fileId),
          destinationPath: destPath,
          provider,
          repository: repo,
        });

        console.log(`✅ Download complete & byte-verified!`);
        console.log(`   Destination:   ${result.destinationPath}`);
        console.log(`   Verified Hash: ${result.verifiedHash}`);
        break;
      }

      case 'delete': {
        const fileId = args[1];
        if (!fileId) {
          console.error('Error: Please provide a file ID');
          process.exit(1);
        }

        const success = await repo.deleteFileMetadata(createFileId(fileId));
        if (success) {
          console.log(`🗑️  File '${fileId}' moved to Trash (status = TRASHED). Provider storage retained.`);
        } else {
          console.error(`Error: File '${fileId}' not found`);
        }
        break;
      }

      case 'restore': {
        const fileId = args[1];
        if (!fileId) {
          console.error('Error: Please provide a file ID');
          process.exit(1);
        }

        const success = await repo.restoreFileMetadata(createFileId(fileId));
        if (success) {
          console.log(`♻️  File '${fileId}' restored to Active status.`);
        } else {
          console.error(`Error: File '${fileId}' not found`);
        }
        break;
      }

      case 'purge': {
        const fileId = args[1];
        if (!fileId) {
          console.error('Error: Please provide a file ID');
          process.exit(1);
        }

        const file = await repo.getFileById(createFileId(fileId));
        if (!file) {
          console.error(`Error: File '${fileId}' not found`);
          process.exit(1);
        }

        console.log(`🔥 Permanently purging file '${fileId}' and provider chunks...`);
        for (const chunk of file.chunks) {
          if (chunk.providerRef) {
            await provider.deleteChunk(chunk.providerRef);
          }
        }

        await repo.purgeFileMetadata(createFileId(fileId));
        console.log(`💥 File '${fileId}' permanently purged from SQLite metadata & provider storage.`);
        break;
      }

      case 'verify': {
        const fileId = args[1];
        if (!fileId) {
          console.error('Error: Please provide a file ID');
          process.exit(1);
        }

        console.log(`🔍 Inspecting provider health for file '${fileId}'...`);
        const inspection = await RecoveryEngine.inspectFileChunks(createFileId(fileId), repo, provider);

        const totalChunks = inspection.verifiedChunkIndexes.length + inspection.missingChunkIndexes.length;
        console.log(`   Total Chunks:    ${totalChunks}`);
        console.log(`   Verified Chunks: ${inspection.verifiedChunkIndexes.length}`);
        console.log(`   Missing Chunks:  ${inspection.missingChunkIndexes.length}`);
        if (inspection.missingChunkIndexes.length === 0) {
          console.log(`✅ File storage is HEALTHY! All provider chunks intact.`);
        } else {
          console.log(`⚠️  File storage is DESYNCED! Missing chunk indexes: [${inspection.missingChunkIndexes.join(', ')}]`);
        }
        break;
      }

      case 'resume': {
        const fileId = args[1];
        const filePath = args[2];
        if (!fileId || !filePath || !existsSync(filePath)) {
          console.error('Error: Usage: bucketspace resume <file-id> <filepath>');
          process.exit(1);
        }

        console.log(`⏳ Resuming upload & repairing missing chunks for '${fileId}'...`);
        const file = await RecoveryEngine.resumeUpload({
          fileId: createFileId(fileId),
          filePath,
          provider,
          repository: repo,
          chunkSize: 5 * 1024 * 1024,
        });

        console.log(`✅ Resume complete! Storage status verified for '${file.name}'.`);
        break;
      }

      case 'sync': {
        const subCmd = args[1];
        ProviderRegistry.register(provider);
        const appService = new StorageApplicationService({
          repository: repo,
          defaultProviderId: provider.providerId,
        });
        const ledgerRepo = new SqliteSyncLedgerRepository((repo as any).db);

        if (subCmd === 'status') {
          const stats = await ledgerRepo.getStats();
          console.log(`\n📊 BucketSpace Folder Sync Ledger Status:`);
          console.log(`   Total Tracked Files: ${stats.totalFiles}`);
          console.log(`   Synced Files:        ${stats.syncedFiles}`);
          console.log(`   Pending Uploads:     ${stats.pendingUploads}`);
          console.log(`   Pending Downloads:   ${stats.pendingDownloads}`);
          console.log(`   Conflicts:           ${stats.conflicts}`);
          console.log(`   Failed Files:        ${stats.failedCount}`);
          console.log(`   Total Size:          ${(stats.totalBytes / (1024 * 1024)).toFixed(2)} MB\n`);
          break;
        }

        let folderPath = resolve(process.cwd(), 'BucketSpace-Sync');
        const folderIdx = args.indexOf('--folder');
        if (folderIdx !== -1 && args[folderIdx + 1]) {
          folderPath = resolve(args[folderIdx + 1]);
        }

        const isOnce = args.includes('--once');

        console.log(`\n🔄 BucketSpace Folder Auto-Sync Daemon`);
        console.log(`   Sync Folder: ${folderPath}`);
        console.log(`   Mode:        ${isOnce ? 'Single Scan & Reconcile' : 'Continuous Background Watcher'}\n`);

        const syncDaemon = new SyncDaemon(
          {
            syncRootDir: folderPath,
            debounceMs: 1500,
            concurrency: 3,
          },
          ledgerRepo,
          appService
        );

        syncDaemon.onEvent((event) => {
          const { payload, type } = event;
          const time = new Date().toLocaleTimeString();
          if (type === 'SYNC_COMPLETED') {
            console.log(`   [${time}] ✅ SYNCED: ${payload.fileName} (${(payload.fileSize / 1024).toFixed(1)} KB)`);
          } else if (type === 'SYNC_STARTED') {
            console.log(`   [${time}] ⏳ ${payload.direction === 'UPLOAD' ? 'Uploading' : 'Downloading'}: ${payload.fileName}...`);
          } else if (type === 'SYNC_CONFLICT') {
            console.log(`   [${time}] ⚠️  CONFLICT: ${payload.fileName} -> Fork saved as '${payload.conflictPath}'`);
          } else if (type === 'SYNC_ERROR') {
            console.error(`   [${time}] ❌ ERROR: ${payload.fileName}: ${payload.error}`);
          }
        });

        await syncDaemon.start();

        if (isOnce) {
          await syncDaemon.stop();
          console.log(`\n✨ One-time sync complete!\n`);
        } else {
          console.log(`👀 Watching for local changes & remote updates... (Press Ctrl+C to stop)`);
          await new Promise(() => {}); // Keep alive until SIGINT
        }
        break;
      }

      default:
        console.error(`Unknown command: '${command}'`);
        printUsage();
        process.exit(1);
    }
  } finally {
    await repo.close();
  }
}

main().catch((err) => {
  console.error('Fatal CLI Error:', err);
  process.exit(1);
});
