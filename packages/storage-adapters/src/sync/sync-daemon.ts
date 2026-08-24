import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, promises as fs, realpathSync, Stats } from 'node:fs';
import path from 'node:path';
import {
  SyncDaemonConfig,
  SyncDaemonStats,
  SyncDirection,
  SyncEvent,
  SyncLedgerEntry,
  SyncProgressPayload,
  SyncStatus,
} from '@bucketspace/shared';
import { ISyncLedgerRepository } from '@bucketspace/db';
import { StorageApplicationService } from '../application/storage-application.service';
import { FolderWatcher, WatcherFileEvent } from './folder-watcher';
import {
  LocalFileState,
  ReconciliationDecision,
  ReconciliationEngine,
  RemoteFileState,
} from './reconciliation-engine';

export class SyncDaemon {
  private watcher: FolderWatcher | null = null;
  private isRunning = false;
  private isPaused = false;
  private isScanning = false;
  private syncJobId = randomUUID();
  private readonly config: Required<SyncDaemonConfig>;
  private readonly ledger: ISyncLedgerRepository;
  private readonly appService: StorageApplicationService;
  private readonly eventListeners = new Set<(event: SyncEvent) => void>();
  private activeTransfers = 0;
  private unsubscribeWatcher: (() => void) | null = null;

  constructor(
    config: SyncDaemonConfig,
    ledger: ISyncLedgerRepository,
    appService: StorageApplicationService
  ) {
    this.config = {
      syncRootDir: path.resolve(config.syncRootDir),
      dbPath: config.dbPath ?? ':memory:',
      debounceMs: config.debounceMs ?? 2000,
      concurrency: config.concurrency ?? 3,
      ignorePatterns: config.ignorePatterns ?? [],
      autoDeleteRemote: config.autoDeleteRemote ?? false,
    };
    this.ledger = ledger;
    this.appService = appService;
  }

  /**
   * Starts the sync daemon.
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;

    this.syncJobId = randomUUID();
    await fs.mkdir(this.config.syncRootDir, { recursive: true });
    try {
      const real = realpathSync.native ? realpathSync.native(this.config.syncRootDir) : realpathSync(this.config.syncRootDir);
      this.config.syncRootDir = real;
    } catch {
      // Fallback
    }

    this.watcher = new FolderWatcher({
      rootDir: this.config.syncRootDir,
      stabilityThresholdMs: this.config.debounceMs,
      ignorePatterns: this.config.ignorePatterns,
    });

    this.unsubscribeWatcher = this.watcher.subscribe((event) => {
      this.handleWatcherEvent(event);
    });

    await this.watcher.start();
    this.isRunning = true;
    this.isPaused = false;

    // Initial full reconciliation scan
    await this.scanAndReconcile();
  }

  /**
   * Stops the daemon.
   */
  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    if (this.unsubscribeWatcher) {
      this.unsubscribeWatcher();
      this.unsubscribeWatcher = null;
    }

    if (this.watcher) {
      await this.watcher.stop();
      this.watcher = null;
    }

    this.isRunning = false;
    this.isPaused = false;
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
  }

  public onEvent(listener: (event: SyncEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Gets current operational stats.
   */
  public async getStats(): Promise<SyncDaemonStats> {
    const rawStats = await this.ledger.getStats();
    let status: SyncDaemonStats['status'] = 'STOPPED';
    if (this.isRunning) {
      status = this.isPaused ? 'PAUSED' : 'RUNNING';
    }

    return {
      status,
      syncRootDir: this.config.syncRootDir,
      totalFiles: rawStats.totalFiles,
      syncedFiles: rawStats.syncedFiles,
      pendingUploads: rawStats.pendingUploads,
      pendingDownloads: rawStats.pendingDownloads,
      conflicts: rawStats.conflicts,
      failedCount: rawStats.failedCount,
      totalBytes: rawStats.totalBytes,
    };
  }

  /**
   * Performs a 3-way reconciliation scan of the root folder against the remote drive.
   */
  public async scanAndReconcile(): Promise<void> {
    if (!this.isRunning || this.isScanning) return;
    this.isScanning = true;

    try {
      this.emitEvent('FOLDER_SCAN_STARTED', {
        syncJobId: this.syncJobId,
        folderPath: this.config.syncRootDir,
        localPath: '',
        fileName: '',
        fileSize: 0,
        direction: 'IDLE',
        bytesTransferred: 0,
        percent: 0,
        status: 'SYNCING',
        timestamp: Date.now(),
      });

      // 1. Scan local filesystem recursively
      const localFiles = await this.collectLocalFiles(this.config.syncRootDir);

      // 2. Fetch remote files from storage application service
      const remoteFilesList = await this.appService.listFiles({ includeTrashed: false });
      const remoteFileMap = new Map<string, RemoteFileState>();
      for (const rf of remoteFilesList) {
        remoteFileMap.set(rf.name, {
          fileId: rf.id,
          name: rf.name,
          fileSize: rf.size,
          wholeFileHash: rf.wholeFileHash,
          updatedAt: rf.updatedAt,
        });
      }

      // 3. Reconcile local files
      for (const [relPath, localState] of localFiles) {
        const ledgerEntry = await this.ledger.getEntry(relPath);
        const remoteState = remoteFileMap.get(relPath) ?? null;

        const decision = ReconciliationEngine.reconcile(localState, ledgerEntry, remoteState);
        await this.executeDecision(decision, localState, ledgerEntry, remoteState);
        remoteFileMap.delete(relPath);
      }

      // 4. Any remaining remote files that do not exist locally -> download
      for (const [remoteName, remoteState] of remoteFileMap) {
        const ledgerEntry = await this.ledger.getEntry(remoteName);
        const decision = ReconciliationEngine.reconcile(null, ledgerEntry, remoteState);
        await this.executeDecision(decision, null, ledgerEntry, remoteState);
      }

      this.emitEvent('FOLDER_SCAN_COMPLETED', {
        syncJobId: this.syncJobId,
        folderPath: this.config.syncRootDir,
        localPath: '',
        fileName: '',
        fileSize: 0,
        direction: 'IDLE',
        bytesTransferred: 0,
        percent: 100,
        status: 'SYNCED',
        timestamp: Date.now(),
      });
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Processes a single incoming watcher event.
   */
  private async handleWatcherEvent(event: WatcherFileEvent): Promise<void> {
    if (!this.isRunning || this.isPaused) return;

    const { localPath, absolutePath, type } = event;

    if (type === 'unlink') {
      await this.ledger.markDeleted(localPath);
      return;
    }

    try {
      const stats = event.stats ?? (await fs.stat(absolutePath));
      if (stats.isDirectory()) return;

      const hash = await this.calculateFileHash(absolutePath);
      const localState: LocalFileState = {
        localPath,
        absolutePath,
        fileSize: stats.size,
        mtimeMs: stats.mtimeMs,
        sha256Hash: hash,
        exists: true,
      };

      const ledgerEntry = await this.ledger.getEntry(localPath);
      let remoteState: RemoteFileState | null = null;
      if (ledgerEntry?.remoteFileId) {
        const rf = await this.appService.getFile(ledgerEntry.remoteFileId);
        if (rf) {
          remoteState = {
            fileId: rf.id,
            name: rf.name,
            fileSize: rf.size,
            wholeFileHash: rf.wholeFileHash,
            updatedAt: rf.updatedAt,
          };
        }
      }

      const decision = ReconciliationEngine.reconcile(localState, ledgerEntry, remoteState);
      await this.executeDecision(decision, localState, ledgerEntry, remoteState);
    } catch (err) {
      // Ignore transient access errors on files in rapid modification
    }
  }

  /**
   * Executes a reconciliation decision.
   */
  private async executeDecision(
    decision: ReconciliationDecision,
    local: LocalFileState | null,
    ledger: SyncLedgerEntry | null,
    remote: RemoteFileState | null
  ): Promise<void> {
    const { action, localPath } = decision;

    if (action === 'NOOP') {
      if (local && (!ledger || ledger.syncStatus !== 'SYNCED')) {
        await this.ledger.upsertEntry({
          localPath,
          absolutePath: local.absolutePath,
          fileSize: local.fileSize,
          mtimeMs: local.mtimeMs,
          sha256Hash: local.sha256Hash,
          remoteFileId: remote?.fileId ?? ledger?.remoteFileId,
          syncStatus: 'SYNCED',
          direction: 'IDLE',
          retryCount: 0,
          isDeleted: false,
          lastSyncedAt: new Date(),
        });
      }
      return;
    }

    if (action === 'UPLOAD' && local) {
      await this.uploadLocalFile(local, ledger);
      return;
    }

    if (action === 'DOWNLOAD' && remote) {
      await this.downloadRemoteFile(remote);
      return;
    }

    if (action === 'CONFLICT' && decision.conflictDetails && local) {
      await this.handleConflict(decision.conflictDetails, local, remote);
      return;
    }
  }

  private async uploadLocalFile(local: LocalFileState, ledger: SyncLedgerEntry | null): Promise<void> {
    const absPath = local.absolutePath;
    const fileName = path.basename(local.localPath);

    await this.ledger.upsertEntry({
      localPath: local.localPath,
      absolutePath: absPath,
      fileSize: local.fileSize,
      mtimeMs: local.mtimeMs,
      sha256Hash: local.sha256Hash,
      remoteFileId: ledger?.remoteFileId,
      syncStatus: 'PENDING_UPLOAD',
      direction: 'UPLOAD',
      retryCount: 0,
      isDeleted: false,
    });

    this.emitEvent('SYNC_STARTED', {
      syncJobId: this.syncJobId,
      folderPath: this.config.syncRootDir,
      localPath: local.localPath,
      fileName,
      fileSize: local.fileSize,
      direction: 'UPLOAD',
      bytesTransferred: 0,
      percent: 0,
      status: 'SYNCING',
      timestamp: Date.now(),
    });

    try {
      // Determine MIME type
      const mimeType = this.getMimeType(fileName);

      // Upload via StorageApplicationService
      const uploaded = await this.appService.uploadFile({
        filePath: absPath,
        name: fileName,
        mimeType,
      });

      await this.ledger.upsertEntry({
        localPath: local.localPath,
        absolutePath: absPath,
        fileSize: local.fileSize,
        mtimeMs: local.mtimeMs,
        sha256Hash: uploaded.wholeFileHash,
        remoteFileId: uploaded.id,
        syncStatus: 'SYNCED',
        direction: 'IDLE',
        retryCount: 0,
        isDeleted: false,
        lastSyncedAt: new Date(),
      });

      this.emitEvent('SYNC_COMPLETED', {
        syncJobId: this.syncJobId,
        folderPath: this.config.syncRootDir,
        localPath: local.localPath,
        fileName,
        fileSize: local.fileSize,
        direction: 'UPLOAD',
        bytesTransferred: local.fileSize,
        percent: 100,
        status: 'SYNCED',
        timestamp: Date.now(),
      });
    } catch (err: any) {
      await this.ledger.markStatus(local.localPath, 'FAILED', err.message);

      this.emitEvent('SYNC_ERROR', {
        syncJobId: this.syncJobId,
        folderPath: this.config.syncRootDir,
        localPath: local.localPath,
        fileName,
        fileSize: local.fileSize,
        direction: 'UPLOAD',
        bytesTransferred: 0,
        percent: 0,
        status: 'FAILED',
        error: err.message,
        timestamp: Date.now(),
      });
    }
  }

  private async downloadRemoteFile(remote: RemoteFileState): Promise<void> {
    const targetAbsPath = path.resolve(this.config.syncRootDir, remote.name);
    const targetDir = path.dirname(targetAbsPath);
    await fs.mkdir(targetDir, { recursive: true });

    const tempPartPath = `${targetAbsPath}.bucketspace-tmp-${remote.fileId}.part`;

    this.emitEvent('SYNC_STARTED', {
      syncJobId: this.syncJobId,
      folderPath: this.config.syncRootDir,
      localPath: remote.name,
      fileName: remote.name,
      fileSize: remote.fileSize,
      direction: 'DOWNLOAD',
      bytesTransferred: 0,
      percent: 0,
      status: 'SYNCING',
      timestamp: Date.now(),
    });

    try {
      // Suppress watcher echo
      this.watcher?.suppressEcho(remote.name, remote.wholeFileHash);

      // Download file to temp .part
      await this.appService.downloadFile({
        fileId: remote.fileId,
        destinationPath: tempPartPath,
      });

      // Verify downloaded whole file hash
      const downloadedHash = await this.calculateFileHash(tempPartPath);
      if (downloadedHash !== remote.wholeFileHash) {
        await fs.unlink(tempPartPath).catch(() => {});
        throw new Error(
          `Downloaded file hash mismatch for '${remote.name}': expected ${remote.wholeFileHash}, got ${downloadedHash}`
        );
      }

      // Atomically move .part to final destination
      await fs.rename(tempPartPath, targetAbsPath);

      const stats = await fs.stat(targetAbsPath);
      await this.ledger.upsertEntry({
        localPath: remote.name,
        absolutePath: targetAbsPath,
        fileSize: stats.size,
        mtimeMs: stats.mtimeMs,
        sha256Hash: downloadedHash,
        remoteFileId: remote.fileId,
        syncStatus: 'SYNCED',
        direction: 'IDLE',
        retryCount: 0,
        isDeleted: false,
        lastSyncedAt: new Date(),
      });

      this.emitEvent('SYNC_COMPLETED', {
        syncJobId: this.syncJobId,
        folderPath: this.config.syncRootDir,
        localPath: remote.name,
        fileName: remote.name,
        fileSize: remote.fileSize,
        direction: 'DOWNLOAD',
        bytesTransferred: remote.fileSize,
        percent: 100,
        status: 'SYNCED',
        timestamp: Date.now(),
      });
    } catch (err: any) {
      await this.ledger.markStatus(remote.name, 'FAILED', err.message);

      this.emitEvent('SYNC_ERROR', {
        syncJobId: this.syncJobId,
        folderPath: this.config.syncRootDir,
        localPath: remote.name,
        fileName: remote.name,
        fileSize: remote.fileSize,
        direction: 'DOWNLOAD',
        bytesTransferred: 0,
        percent: 0,
        status: 'FAILED',
        error: err.message,
        timestamp: Date.now(),
      });
    }
  }

  private async handleConflict(
    conflict: { originalPath: string; forkPath: string },
    local: LocalFileState,
    remote: RemoteFileState | null
  ): Promise<void> {
    const forkAbsPath = path.resolve(this.config.syncRootDir, conflict.forkPath);

    // 1. Rename local file to conflict fork
    await fs.rename(local.absolutePath, forkAbsPath);

    // 2. Mark original path in conflict state
    await this.ledger.upsertEntry({
      localPath: conflict.originalPath,
      absolutePath: local.absolutePath,
      fileSize: local.fileSize,
      mtimeMs: local.mtimeMs,
      sha256Hash: local.sha256Hash,
      remoteFileId: remote?.fileId,
      syncStatus: 'CONFLICT',
      direction: 'IDLE',
      errorMessage: `Conflict detected. Local copy saved as '${conflict.forkPath}'`,
      retryCount: 0,
      isDeleted: false,
    });

    // 3. Download the canonical remote version if available
    if (remote) {
      await this.downloadRemoteFile(remote);
    }

    // 4. Emit conflict event
    this.emitEvent('SYNC_CONFLICT', {
      syncJobId: this.syncJobId,
      folderPath: this.config.syncRootDir,
      localPath: conflict.originalPath,
      fileName: path.basename(conflict.originalPath),
      fileSize: local.fileSize,
      direction: 'IDLE',
      bytesTransferred: 0,
      percent: 0,
      status: 'CONFLICT',
      conflictPath: conflict.forkPath,
      error: `Concurrent edits detected. Local version saved as '${conflict.forkPath}'`,
      timestamp: Date.now(),
    });
  }

  private async collectLocalFiles(dir: string, baseDir = dir): Promise<Map<string, LocalFileState>> {
    const results = new Map<string, LocalFileState>();

    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

      // Skip dotfiles, temp files, and node_modules
      if (
        entry.name.startsWith('.') ||
        entry.name === 'node_modules' ||
        entry.name.endsWith('.tmp') ||
        entry.name.endsWith('.part')
      ) {
        continue;
      }

      if (entry.isDirectory()) {
        const subFiles = await this.collectLocalFiles(fullPath, baseDir);
        for (const [subRel, subState] of subFiles) {
          results.set(subRel, subState);
        }
      } else if (entry.isFile()) {
        const stats = await fs.stat(fullPath);
        const hash = await this.calculateFileHash(fullPath);
        results.set(relPath, {
          localPath: relPath,
          absolutePath: fullPath,
          fileSize: stats.size,
          mtimeMs: stats.mtimeMs,
          sha256Hash: hash,
          exists: true,
        });
      }
    }

    return results;
  }

  private async calculateFileHash(filePath: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const hash = createHash('sha256');
      const stream = createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });
  }

  private emitEvent(type: SyncEvent['type'], payload: SyncProgressPayload): void {
    const event: SyncEvent = {
      type,
      payload,
      timestamp: Date.now(),
    };

    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch {
        // Prevent listener crashes
      }
    }
  }

  private getMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const mimeMap: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mp3': 'audio/mpeg',
      '.zip': 'application/zip',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    };
    return mimeMap[ext] ?? 'application/octet-stream';
  }
}
