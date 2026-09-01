import { promises as fs, realpathSync, Stats } from 'fs';
import path from 'path';

type FSWatcher = any;

export type FileWatcherEventType = 'add' | 'change' | 'unlink';

export interface WatcherFileEvent {
  type: FileWatcherEventType;
  localPath: string;
  absolutePath: string;
  stats?: Stats;
}

export interface FolderWatcherConfig {
  rootDir: string;
  debounceMs?: number;
  stabilityThresholdMs?: number;
  ignorePatterns?: string[];
}

export class FolderWatcher {
  private watcher: FSWatcher | null = null;
  private isWatching = false;
  private rootDir: string;
  private readonly stabilityThresholdMs: number;
  private readonly ignorePatterns: (string | RegExp)[];
  private readonly inFlightSuppression = new Map<string, { expectedHash: string; expiresAt: number }>();
  private readonly listeners = new Set<(event: WatcherFileEvent) => void>();

  constructor(config: FolderWatcherConfig) {
    this.rootDir = path.resolve(config.rootDir);
    this.stabilityThresholdMs = config.stabilityThresholdMs ?? 1500;

    const defaultIgnores: (string | RegExp)[] = [
      /(^|[\/\\])\../,            // dotfiles/dotfolders (.git, .bucketspace, etc.)
      /node_modules/,
      /\.tmp$/,
      /\.part$/,
      /\.crdownload$/,
      /Thumbs\.db$/,
      /desktop\.ini$/,
      /\.DS_Store$/,
      /~\$/,
    ];

    if (config.ignorePatterns) {
      for (const pattern of config.ignorePatterns) {
        defaultIgnores.push(pattern);
      }
    }

    this.ignorePatterns = defaultIgnores;
  }

  /**
   * Starts watching the target folder.
   */
  public async start(): Promise<void> {
    if (this.isWatching) return;

    // Ensure root directory exists and resolve canonical filesystem path
    await fs.mkdir(this.rootDir, { recursive: true });
    try {
      this.rootDir = realpathSync.native ? realpathSync.native(this.rootDir) : realpathSync(this.rootDir);
    } catch {
      // Fallback to resolved path
    }

    // Dynamically load chokidar on Node.js runtime
    const chokidarModule: any = await import('chokidar' as any);
    const chokidarWatcher = chokidarModule.default?.watch ?? chokidarModule.watch;

    this.watcher = chokidarWatcher(this.rootDir, {
      ignored: this.ignorePatterns,
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: this.stabilityThresholdMs,
        pollInterval: 150,
      },
      atomic: true,
      depth: 99,
    });

    this.watcher.on('add', (filePath: string, stats?: Stats) => {
      this.handleEvent('add', filePath, stats);
    });

    this.watcher.on('change', (filePath: string, stats?: Stats) => {
      this.handleEvent('change', filePath, stats);
    });

    this.watcher.on('unlink', (filePath: string) => {
      this.handleEvent('unlink', filePath);
    });

    this.isWatching = true;
  }

  /**
   * Stops watching the directory.
   */
  public async stop(): Promise<void> {
    if (!this.isWatching || !this.watcher) return;
    await this.watcher.close();
    this.watcher = null;
    this.isWatching = false;
    this.inFlightSuppression.clear();
  }

  /**
   * Suppresses watcher events for a file currently being downloaded/written by the sync daemon.
   */
  public suppressEcho(localPath: string, expectedHash: string, durationMs = 8000): void {
    const normalized = this.normalizeRelativePath(localPath);
    this.inFlightSuppression.set(normalized, {
      expectedHash,
      expiresAt: Date.now() + durationMs,
    });
  }

  /**
   * Checks if an incoming path matches an active echo suppression.
   */
  public isSuppressed(localPath: string): boolean {
    const normalized = this.normalizeRelativePath(localPath);
    const item = this.inFlightSuppression.get(normalized);
    if (!item) return false;

    if (Date.now() > item.expiresAt) {
      this.inFlightSuppression.delete(normalized);
      return false;
    }
    return true;
  }

  /**
   * Subscribes a listener to watcher events.
   */
  public subscribe(listener: (event: WatcherFileEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Probes whether a file is currently locked/accessible for reading.
   */
  public static async isFileAccessible(filePath: string): Promise<boolean> {
    try {
      const handle = await fs.open(filePath, 'r');
      await handle.close();
      return true;
    } catch (err: any) {
      if (err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'EACCES') {
        return false;
      }
      throw err;
    }
  }

  private handleEvent(type: FileWatcherEventType, rawPath: string, stats?: Stats): void {
    const absolutePath = path.resolve(rawPath);
    const relativePath = path.relative(this.rootDir, absolutePath);
    const localPath = this.normalizeRelativePath(relativePath);

    // Skip root directory event itself
    if (!localPath || localPath === '.') return;

    // Check echo suppression
    if (this.isSuppressed(localPath)) {
      return;
    }

    const event: WatcherFileEvent = {
      type,
      localPath,
      absolutePath,
      stats,
    };

    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Prevent listener errors from crashing watcher
      }
    }
  }

  private normalizeRelativePath(relPath: string): string {
    return relPath.replace(/\\/g, '/').replace(/^\/+/, '');
  }
}
