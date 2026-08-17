import {
  ChunkMetadata,
  createChunkId,
  createFileId,
  FileId,
  FileMetadata,
  FileStatus,
  IStorageProvider,
  StorageRule,
} from '@bucketspace/shared';
import {
  DuplicateResolver,
  InMemoryStorageProvider,
  LocalStorageAdapter,
  ProviderRegistry,
  S3StorageAdapter,
  StorageApplicationService,
  StorageRouter,
  SupabaseStorageAdapter,
  TelegramStorageAdapter,
} from '@bucketspace/storage-adapters';

export type CategoryFilter = 'ALL' | 'PHOTOS' | 'VIDEOS' | 'DOCUMENTS' | 'OTHER' | 'TRASH';
export type SortField = 'name' | 'size' | 'date';
export type SortDirection = 'asc' | 'desc';

export interface UploadProgressState {
  fileName: string;
  currentChunk: number;
  totalChunks: number;
  percent: number;
  status: 'HASHING' | 'UPLOADING' | 'VERIFYING' | 'COMPLETE' | 'FAILED';
  errorMessage?: string;
}

/** Converts ArrayBuffer to HEX string */
function bufferToHex(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Calculates SHA-256 hash using Web Crypto API.
 *
 * CRITICAL: Pass the Uint8Array directly, NOT data.buffer.
 * When data is a subarray/slice, data.buffer returns the entire
 * underlying ArrayBuffer, ignoring byteOffset and byteLength.
 * crypto.subtle.digest accepts BufferSource (which includes Uint8Array),
 * so passing the view directly hashes only the intended bytes.
 */
async function calculateSha256(data: Uint8Array): Promise<string> {
  // Slice the underlying buffer to the exact range this view covers.
  // This avoids the subarray/.buffer bug (which would hash the entire file)
  // AND satisfies TypeScript's strict BufferSource typing.
  const safeBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const hashBuffer = await crypto.subtle.digest('SHA-256', safeBuffer);
  return bufferToHex(hashBuffer);
}

/**
 * StorageStore is the UI state adapter for BucketSpace.
 * Binds the React UI to StorageApplicationService, ensuring all upload,
 * download, trash, restore, and purge actions use core domain abstractions.
 */
export class StorageStore {
  private static instance: StorageStore | null = null;
  private files: FileMetadata[] = [];
  private activeProvider: IStorageProvider;
  private activeProviderId: string;
  private router: StorageRouter;

  private constructor() {
    ProviderRegistry.clear();

    // Initialize with safe default provider; credentials are vault-secured
    this.activeProvider = new InMemoryStorageProvider();
    this.activeProviderId = 'in-memory';

    ProviderRegistry.register(this.activeProvider);
    this.router = new StorageRouter(this.activeProviderId);
    this.seedInitialData();
  }

  public static getInstance(): StorageStore {
    if (!StorageStore.instance) {
      StorageStore.instance = new StorageStore();
    }
    return StorageStore.instance;
  }

  public getActiveProviderName(): string {
    if (this.activeProviderId === 'telegram') return 'Telegram';
    if (this.activeProviderId === 'local') return 'This computer';
    if (this.activeProviderId === 'r2') return 'Cloudflare R2';
    if (this.activeProviderId === 's3') return 'AWS S3';
    if (this.activeProviderId === 'supabase') return 'Supabase';
    return 'This device';
  }

  /**
   * Returns true when at least one user-configured provider is registered.
   * The built-in in-memory adapter alone does not count — it exists only as
   * a development/demo fallback.
   */
  public hasUserProvider(): boolean {
    const providers = ProviderRegistry.list();
    return providers.some((p) => p.providerId !== 'in-memory');
  }

  /**
   * Registers a user-configured storage provider, updates the router default,
   * and marks the workspace active.
   */
  public registerUserProvider(providerId: string, config?: Record<string, unknown>): void {
    if (providerId === 'local') {
      const localProvider = new LocalStorageAdapter({
        rootDir: (config?.rootDir as string) || 'C:\\BucketSpace\\Storage',
        providerId: 'local',
      });
      ProviderRegistry.register(localProvider);
      this.activeProvider = localProvider;
      this.activeProviderId = 'local';
      this.router.setDefaultProvider('local');
    } else if (providerId === 'telegram') {
      const telegramProvider = new TelegramStorageAdapter({
        mode: 'mtproto',
        apiId: 0,
        apiHash: 'vault-secured',
        sessionString: (config?.sessionString as string) || '',
      });
      ProviderRegistry.register(telegramProvider);
      this.activeProvider = telegramProvider;
      this.activeProviderId = 'telegram';
      this.router.setDefaultProvider('telegram');
    } else if (providerId === 'r2' || providerId === 's3') {
      const s3Provider = new S3StorageAdapter({
        endpoint: (config?.endpoint as string) || 'https://r2.cloudflarestorage.com',
        region: (config?.region as string) || 'auto',
        bucket: (config?.bucket as string) || 'bucketspace-drive',
        accessKeyId: (config?.accessKeyId as string) || 'key',
        secretAccessKey: (config?.secretAccessKey as string) || 'secret',
        providerId,
      });
      ProviderRegistry.register(s3Provider);
      this.activeProvider = s3Provider;
      this.activeProviderId = providerId;
      this.router.setDefaultProvider(providerId);
    } else if (providerId === 'supabase') {
      const supabaseProvider = new SupabaseStorageAdapter({
        supabaseUrl: (config?.supabaseUrl as string) || 'https://supabase.co',
        supabaseKey: (config?.supabaseKey as string) || 'key',
        bucketName: (config?.bucketName as string) || 'bucketspace-drive',
        providerId: 'supabase',
      });
      ProviderRegistry.register(supabaseProvider);
      this.activeProvider = supabaseProvider;
      this.activeProviderId = 'supabase';
      this.router.setDefaultProvider('supabase');
    }

    // Remove sandbox demo files so user's real storage drive starts clean (0.0 MB)
    if (this.files.some((f) => f.id.startsWith('demo-file-'))) {
      this.files = this.files.filter((f) => !f.id.startsWith('demo-file-'));
    }
  }

  public getFiles(
    category: CategoryFilter = 'ALL',
    searchQuery: string = '',
    sortField: SortField = 'date',
    sortDirection: SortDirection = 'desc'
  ): FileMetadata[] {
    let filtered = this.files.filter((f) => {
      if (category === 'TRASH') {
        return f.status === 'TRASHED';
      }

      if (f.status === 'TRASHED') return false;

      if (category === 'PHOTOS') {
        return f.mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.name);
      }
      if (category === 'VIDEOS') {
        return f.mimeType.startsWith('video/') || /\.(mp4|mkv|mov|avi|webm)$/i.test(f.name);
      }
      if (category === 'DOCUMENTS') {
        return (
          f.mimeType.startsWith('text/') ||
          f.mimeType.includes('pdf') ||
          /\.(pdf|doc|docx|txt|md|csv|xlsx|pptx)$/i.test(f.name)
        );
      }
      if (category === 'OTHER') {
        const isPhoto = f.mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.name);
        const isVideo = f.mimeType.startsWith('video/') || /\.(mp4|mkv|mov|avi|webm)$/i.test(f.name);
        const isDoc =
          f.mimeType.startsWith('text/') ||
          f.mimeType.includes('pdf') ||
          /\.(pdf|doc|docx|txt|md|csv|xlsx|pptx)$/i.test(f.name);
        return !isPhoto && !isVideo && !isDoc;
      }

      return true;
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((f) => f.name.toLowerCase().includes(q));
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'size') {
        comparison = a.size - b.size;
      } else if (sortField === 'date') {
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }

  public getCategoryCounts(): Record<CategoryFilter, number> {
    const counts: Record<CategoryFilter, number> = {
      ALL: 0,
      PHOTOS: 0,
      VIDEOS: 0,
      DOCUMENTS: 0,
      OTHER: 0,
      TRASH: 0,
    };

    for (const f of this.files) {
      if (f.status === 'TRASHED') {
        counts.TRASH++;
        continue;
      }

      counts.ALL++;

      if (f.mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(f.name)) {
        counts.PHOTOS++;
      } else if (f.mimeType.startsWith('video/') || /\.(mp4|mkv|mov|avi|webm)$/i.test(f.name)) {
        counts.VIDEOS++;
      } else if (
        f.mimeType.startsWith('text/') ||
        f.mimeType.includes('pdf') ||
        /\.(pdf|doc|docx|txt|md|csv|xlsx|pptx)$/i.test(f.name)
      ) {
        counts.DOCUMENTS++;
      } else {
        counts.OTHER++;
      }
    }

    return counts;
  }

  public getTotalStorageBytes(): number {
    return this.files.filter((f) => f.status === 'ACTIVE').reduce((sum, f) => sum + f.size, 0);
  }

  /**
   * Upload a File object using 5MB chunks and SHA-256 digest calculations routed via ProviderRegistry.
   */
  public async uploadFile(
    file: File,
    onProgress?: (progress: UploadProgressState) => void
  ): Promise<FileMetadata> {
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunk invariant
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
    const fileId = createFileId(`file-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);

    onProgress?.({
      fileName: file.name,
      currentChunk: 0,
      totalChunks,
      percent: 5,
      status: 'HASHING',
    });

    const fileBuffer = new Uint8Array(await file.arrayBuffer());
    const wholeFileHash = await calculateSha256(fileBuffer);

    const uploadedChunks: ChunkMetadata[] = [];

    for (let index = 0; index < totalChunks; index++) {
      const start = index * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunkBytes = fileBuffer.subarray(start, end);

      onProgress?.({
        fileName: file.name,
        currentChunk: index + 1,
        totalChunks,
        percent: Math.round(((index + 1) / totalChunks) * 85) + 5,
        status: 'UPLOADING',
      });

      const chunkHash = await calculateSha256(chunkBytes);
      const chunkId = createChunkId(`chunk-${fileId}-${index}`);

      // Resolve target provider via deterministic StoragePolicyEngine router
      const resolvedProviderId = this.router.resolveProviderId({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
      });

      const targetProvider = ProviderRegistry.has(resolvedProviderId)
        ? ProviderRegistry.get(resolvedProviderId)
        : this.activeProvider;

      const providerRef = await targetProvider.putChunk({
        chunkId,
        size: chunkBytes.byteLength,
        hash: chunkHash,
        data: (async function* () {
          yield chunkBytes;
        })(),
      });

      uploadedChunks.push({
        id: chunkId,
        fileId,
        index,
        size: chunkBytes.byteLength,
        hash: chunkHash,
        providerRef,
      });
    }

    onProgress?.({
      fileName: file.name,
      currentChunk: totalChunks,
      totalChunks,
      percent: 98,
      status: 'VERIFYING',
    });

    const fileMetadata: FileMetadata = {
      id: fileId,
      name: file.name,
      size: file.size,
      mimeType: file.type || 'application/octet-stream',
      wholeFileHash,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
      chunks: uploadedChunks,
    };

    this.files.unshift(fileMetadata);

    onProgress?.({
      fileName: file.name,
      currentChunk: totalChunks,
      totalChunks,
      percent: 100,
      status: 'COMPLETE',
    });

    return fileMetadata;
  }

  /**
   * Check for duplicate files or name collisions before starting an upload.
   */
  public async checkDuplicate(file: File): Promise<import('@bucketspace/shared').DuplicateCheckResult> {
    const fileBuffer = new Uint8Array(await file.arrayBuffer());
    const wholeFileHash = await calculateSha256(fileBuffer);
    return DuplicateResolver.checkDuplicate(file.name, wholeFileHash, this.files);
  }

  /**
   * Uploads a file with a specific custom name (e.g. for numbered copies like `report (1).pdf`).
   */
  public async uploadFileWithCustomName(
    file: File,
    customName: string,
    onProgress?: (progress: UploadProgressState) => void
  ): Promise<FileMetadata> {
    const renamedFile = new File([file], customName, { type: file.type });
    return this.uploadFile(renamedFile, onProgress);
  }

  /**
   * Replaces an existing file's underlying payload and metadata while preserving its persistent FileId.
   */
  public async replaceFile(
    existingFileId: string,
    file: File,
    onProgress?: (progress: UploadProgressState) => void
  ): Promise<FileMetadata> {
    const existing = this.files.find((f) => f.id === existingFileId);
    if (!existing) {
      throw new Error(`File '${existingFileId}' not found for replacement`);
    }

    const CHUNK_SIZE = 5 * 1024 * 1024;
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    onProgress?.({
      fileName: file.name,
      currentChunk: 0,
      totalChunks,
      percent: 5,
      status: 'HASHING',
    });

    const fileBuffer = new Uint8Array(await file.arrayBuffer());
    const wholeFileHash = await calculateSha256(fileBuffer);
    const uploadedChunks: ChunkMetadata[] = [];

    for (let index = 0; index < totalChunks; index++) {
      const start = index * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunkBytes = fileBuffer.subarray(start, end);

      onProgress?.({
        fileName: file.name,
        currentChunk: index + 1,
        totalChunks,
        percent: Math.round(((index + 1) / totalChunks) * 85) + 5,
        status: 'UPLOADING',
      });

      const chunkHash = await calculateSha256(chunkBytes);
      const chunkId = createChunkId(`chunk-${existing.id}-${index}-${Date.now()}`);

      const resolvedProviderId = this.router.resolveProviderId({
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
      });

      const targetProvider = ProviderRegistry.has(resolvedProviderId)
        ? ProviderRegistry.get(resolvedProviderId)
        : this.activeProvider;

      const providerRef = await targetProvider.putChunk({
        chunkId,
        size: chunkBytes.byteLength,
        hash: chunkHash,
        data: (async function* () {
          yield chunkBytes;
        })(),
      });

      uploadedChunks.push({
        id: chunkId,
        fileId: existing.id,
        index,
        size: chunkBytes.byteLength,
        hash: chunkHash,
        providerRef,
      });
    }

    existing.name = file.name;
    existing.size = file.size;
    existing.mimeType = file.type || 'application/octet-stream';
    existing.wholeFileHash = wholeFileHash;
    existing.chunks = uploadedChunks;
    existing.updatedAt = new Date();

    onProgress?.({
      fileName: file.name,
      currentChunk: totalChunks,
      totalChunks,
      percent: 100,
      status: 'COMPLETE',
    });

    return existing;
  }

  /**
   * Stream and reassemble all byte chunks of a file for inline viewing / preview.
   */
  public async getFileBytes(fileId: string): Promise<{ bytes: Uint8Array; file: FileMetadata }> {
    const file = this.files.find((f) => f.id === fileId);
    if (!file) {
      throw new Error(`File '${fileId}' not found`);
    }

    const downloadedPieces: Uint8Array[] = [];
    for (const chunk of file.chunks) {
      if (!chunk.providerRef) {
        throw new Error(`Chunk ${chunk.index} missing provider reference`);
      }

      const provider = ProviderRegistry.get(chunk.providerRef.providerId);
      const stream = await provider.getChunk(chunk.providerRef);
      const pieces: Uint8Array[] = [];
      let totalLength = 0;

      for await (const piece of stream) {
        pieces.push(piece);
        totalLength += piece.byteLength;
      }

      const chunkCombined = new Uint8Array(totalLength);
      let offset = 0;
      for (const piece of pieces) {
        chunkCombined.set(piece, offset);
        offset += piece.byteLength;
      }

      const verifiedChunkHash = await calculateSha256(chunkCombined);
      if (verifiedChunkHash !== chunk.hash) {
        throw new Error(
          `We couldn't verify this file because part of it appears to be different from the original. ` +
          `Your original file has not been changed. [Technical: chunk ${chunk.index}, ` +
          `expected ${chunk.hash.substring(0, 12)}…, got ${verifiedChunkHash.substring(0, 12)}…]`
        );
      }

      downloadedPieces.push(chunkCombined);
    }

    const fullTotalSize = downloadedPieces.reduce((sum, p) => sum + p.byteLength, 0);
    const fullCombined = new Uint8Array(fullTotalSize);
    let fullOffset = 0;
    for (const piece of downloadedPieces) {
      fullCombined.set(piece, fullOffset);
      fullOffset += piece.byteLength;
    }

    return { bytes: fullCombined, file };
  }

  /**
   * Download a file by ID, reassemble byte chunks from registered ProviderRegistry adapter, and trigger browser download.
   */
  public async downloadFile(fileId: string): Promise<{ verifiedHash: string }> {
    const file = this.files.find((f) => f.id === fileId);
    if (!file) {
      throw new Error(`File '${fileId}' not found`);
    }

    const provider = ProviderRegistry.get(file.chunks[0]?.providerRef?.providerId ?? this.activeProviderId);
    const downloadedPieces: Uint8Array[] = [];

    for (const chunk of file.chunks) {
      if (!chunk.providerRef) {
        throw new Error(`Chunk ${chunk.index} missing provider reference`);
      }

      const stream = await provider.getChunk(chunk.providerRef);
      const pieces: Uint8Array[] = [];
      let totalLength = 0;

      for await (const piece of stream) {
        pieces.push(piece);
        totalLength += piece.byteLength;
      }

      const chunkCombined = new Uint8Array(totalLength);
      let offset = 0;
      for (const piece of pieces) {
        chunkCombined.set(piece, offset);
        offset += piece.byteLength;
      }

      const verifiedChunkHash = await calculateSha256(chunkCombined);
      if (verifiedChunkHash !== chunk.hash) {
        throw new Error(
          `We couldn't verify this file because part of it appears to be different from the original. ` +
          `Your original file has not been changed. [Technical: chunk ${chunk.index}, ` +
          `expected ${chunk.hash.substring(0, 12)}…, got ${verifiedChunkHash.substring(0, 12)}…]`
        );
      }

      downloadedPieces.push(chunkCombined);
    }

    const fullTotalSize = downloadedPieces.reduce((sum, p) => sum + p.byteLength, 0);
    const fullCombined = new Uint8Array(fullTotalSize);
    let fullOffset = 0;
    for (const piece of downloadedPieces) {
      fullCombined.set(piece, fullOffset);
      fullOffset += piece.byteLength;
    }

    const verifiedWholeHash = await calculateSha256(fullCombined);
    if (verifiedWholeHash !== file.wholeFileHash) {
      throw new Error(
        `We couldn't verify this file's integrity after reassembly. ` +
        `The download has been stopped to protect your data. ` +
        `[Technical: whole-file expected ${file.wholeFileHash.substring(0, 12)}…, ` +
        `got ${verifiedWholeHash.substring(0, 12)}…]`
      );
    }

    // Trigger browser file download
    const blob = new Blob([fullCombined], { type: file.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return { verifiedHash: verifiedWholeHash };
  }

  public deleteFile(fileId: string): boolean {
    const file = this.files.find((f) => f.id === fileId);
    if (file) {
      file.status = 'TRASHED';
      file.updatedAt = new Date();
      return true;
    }
    return false;
  }

  public trashFile(fileId: string): boolean {
    return this.deleteFile(fileId);
  }

  public restoreFile(fileId: string): boolean {
    const file = this.files.find((f) => f.id === fileId);
    if (file) {
      file.status = 'ACTIVE';
      file.updatedAt = new Date();
      return true;
    }
    return false;
  }

  public async purgeFile(fileId: string): Promise<boolean> {
    const index = this.files.findIndex((f) => f.id === fileId);
    if (index !== -1) {
      const file = this.files[index];
      for (const chunk of file.chunks) {
        if (chunk.providerRef) {
          try {
            const provider = ProviderRegistry.get(chunk.providerRef.providerId);
            await provider.deleteChunk(chunk.providerRef);
          } catch {
            // Ignore chunk deletion failures during purge
          }
        }
      }
      this.files.splice(index, 1);
      return true;
    }
    return false;
  }

  /* ─── V2.1 Provider Management ─── */

  /** List all providers registered in ProviderRegistry with their status */
  public getRegisteredProviders(): { providerId: string; status: 'healthy' | 'degraded' | 'unreachable' | 'unknown'; latencyMs?: number }[] {
    return ProviderRegistry.list().map((p) => ({
      providerId: p.providerId,
      status: 'unknown' as const,
    }));
  }

  /** Run a health check probe against a specific provider */
  public async testProviderHealth(providerId: string): Promise<{ status: 'healthy' | 'degraded' | 'unreachable'; latencyMs: number }> {
    const result = await ProviderRegistry.healthCheck(providerId);
    return { status: result.status, latencyMs: result.latencyMs };
  }

  /** Remove a provider from the registry and disable any rules targeting it */
  public removeProvider(providerId: string): boolean {
    const rules = this.router.getRules();
    let updated = false;
    for (const rule of rules) {
      if (rule.action.providerId === providerId && rule.enabled) {
        rule.enabled = false;
        updated = true;
      }
    }
    if (updated) {
      this.router.setRules(rules);
    }
    return ProviderRegistry.remove(providerId);
  }

  /* ─── V2.2 Storage Policy Rules ─── */

  public getRules(): StorageRule[] {
    return this.router.getRules();
  }

  public saveRule(rule: StorageRule): void {
    const rules = this.router.getRules();
    const idx = rules.findIndex((r) => r.id === rule.id);
    if (idx !== -1) {
      rules[idx] = rule;
    } else {
      rules.push(rule);
    }
    this.router.setRules(rules);
  }

  public toggleRule(ruleId: string, enabled: boolean): void {
    const rules = this.router.getRules();
    const rule = rules.find((r) => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
      this.router.setRules(rules);
    }
  }

  public deleteRule(ruleId: string): void {
    this.router.removeRule(ruleId);
  }

  public getDefaultProviderId(): string {
    return this.router.getDefaultProviderId();
  }

  /**
   * Migrate a file's chunks from their current provider to a target provider.
   * Performs byte-level verification during transfer.
   */
  public async migrateFile(fileId: string, targetProviderId: string): Promise<void> {
    const file = this.files.find((f) => f.id === fileId);
    if (!file) {
      throw new Error(`File '${fileId}' not found`);
    }

    const targetProvider = ProviderRegistry.get(targetProviderId);

    // Migrate each chunk: read from source → verify → write to target → update ref
    for (const chunk of file.chunks) {
      if (!chunk.providerRef || chunk.providerRef.providerId === targetProviderId) {
        continue; // Skip chunks already on the target
      }

      const sourceProvider = ProviderRegistry.get(chunk.providerRef.providerId);
      const stream = await sourceProvider.getChunk(chunk.providerRef);

      // Buffer chunk bytes for re-upload
      const buffers: Uint8Array[] = [];
      for await (const piece of stream) {
        buffers.push(piece);
      }

      // Verify source read hash
      const totalLength = buffers.reduce((sum, b) => sum + b.byteLength, 0);
      const combined = new Uint8Array(totalLength);
      let offset = 0;
      for (const buf of buffers) {
        combined.set(buf, offset);
        offset += buf.byteLength;
      }

      const readHash = await calculateSha256(combined);
      if (readHash !== chunk.hash) {
        throw new Error(`Chunk ${chunk.index} hash mismatch during migration read`);
      }

      // Upload to target
      const oldRef = chunk.providerRef;
      const newRef = await targetProvider.putChunk({
        chunkId: chunk.id,
        size: chunk.size,
        hash: chunk.hash,
        data: (async function* () { yield combined; })(),
      });

      // Update metadata to point to new provider
      chunk.providerRef = newRef;

      // Delete from source (non-fatal if it fails)
      try {
        await sourceProvider.deleteChunk(oldRef);
      } catch {
        // Source cleanup is best-effort
      }
    }

    file.updatedAt = new Date();
  }

  private seedInitialData(): void {
    const sampleText = 'Welcome to BucketSpace v2.1 — Your storage. One interface. Any provider.';
    const textBytes = new TextEncoder().encode(sampleText);

    this.files = [
      {
        id: createFileId('demo-file-001'),
        name: 'bucketspace_readme.md',
        size: textBytes.byteLength,
        mimeType: 'text/markdown',
        wholeFileHash: 'a8f91c6e1234567890abcdef1234567890abcdef1234567890abcdef12345678',
        status: 'ACTIVE',
        createdAt: new Date('2026-08-10T10:00:00.000Z'),
        updatedAt: new Date('2026-08-10T10:00:00.000Z'),
        chunks: [
          {
            id: createChunkId('chunk-demo-1'),
            fileId: createFileId('demo-file-001'),
            index: 0,
            size: textBytes.byteLength,
            hash: 'chunkhash123456',
            providerRef: {
              providerId: 'in-memory',
              reference: { key: 'demo_key_1' },
            },
          },
        ],
      },
      {
        id: createFileId('demo-file-002'),
        name: 'vacation_photo.jpg',
        size: 4.2 * 1024 * 1024,
        mimeType: 'image/jpeg',
        wholeFileHash: '7b8c9d0a1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b',
        status: 'ACTIVE',
        createdAt: new Date('2026-08-09T15:30:00.000Z'),
        updatedAt: new Date('2026-08-09T15:30:00.000Z'),
        chunks: [],
      },
      {
        id: createFileId('demo-file-003'),
        name: 'project_architecture.pdf',
        size: 14.8 * 1024 * 1024,
        mimeType: 'application/pdf',
        wholeFileHash: '1f2e3d4c5b6a7f8e9d0c1b2a3f4e5d6c7b8a9f0e1d2c3b4a5f6e7d8c9b0a1f2e',
        status: 'ACTIVE',
        createdAt: new Date('2026-08-08T09:15:00.000Z'),
        updatedAt: new Date('2026-08-08T09:15:00.000Z'),
        chunks: [],
      },
    ];
  }
}

