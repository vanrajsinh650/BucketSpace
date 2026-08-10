import {
  ChunkMetadata,
  createChunkId,
  createFileId,
  FileId,
  FileMetadata,
  FileStatus,
  IStorageProvider,
} from '@bucketspace/shared';
import {
  InMemoryStorageProvider,
  ProviderRegistry,
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

/** Calculates SHA-256 hash using Web Crypto API */
async function calculateSha256(data: Uint8Array): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer);
  return bufferToHex(hashBuffer);
}

export class StorageStore {
  private static instance: StorageStore | null = null;
  private files: FileMetadata[] = [];
  private activeProvider: IStorageProvider;

  private constructor() {
    ProviderRegistry.clear();

    const botToken = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
    const chatId = process.env.NEXT_PUBLIC_TELEGRAM_STORAGE_CHAT_ID;

    if (botToken && chatId) {
      this.activeProvider = new TelegramStorageAdapter({
        botToken,
        defaultChatId: chatId,
      });
    } else {
      this.activeProvider = new InMemoryStorageProvider();
    }

    ProviderRegistry.register(this.activeProvider);
    this.seedInitialData();
  }

  public static getInstance(): StorageStore {
    if (!StorageStore.instance) {
      StorageStore.instance = new StorageStore();
    }
    return StorageStore.instance;
  }

  public getActiveProviderName(): string {
    return this.activeProvider.providerId === 'telegram'
      ? 'Telegram Private Channel'
      : 'In-Memory Test Adapter';
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
        comparison = a.createdAt.getTime() - b.createdAt.getTime();
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
   * Upload a File object using stream chunking and SHA-256 digest calculations.
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

      const providerRef = await this.activeProvider.putChunk({
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
   * Download a file by ID, reassemble byte chunks from provider, and trigger browser download.
   */
  public async downloadFile(fileId: string): Promise<{ verifiedHash: string }> {
    const file = this.files.find((f) => f.id === fileId);
    if (!file) {
      throw new Error(`File '${fileId}' not found`);
    }

    const provider = ProviderRegistry.get(file.chunks[0]?.providerRef?.providerId ?? 'in-memory');
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
        throw new Error(`Chunk ${chunk.index} hash mismatch during download!`);
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
      throw new Error(`Whole-file SHA-256 hash mismatch during download reassembly!`);
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
          await this.activeProvider.deleteChunk(chunk.providerRef);
        }
      }
      this.files.splice(index, 1);
      return true;
    }
    return false;
  }

  public async verifyFileHealth(fileId: string): Promise<{ healthy: boolean; missingCount: number }> {
    const file = this.files.find((f) => f.id === fileId);
    if (!file) return { healthy: false, missingCount: 0 };

    let missing = 0;
    for (const chunk of file.chunks) {
      if (!chunk.providerRef) {
        missing++;
        continue;
      }
      const stat = await this.activeProvider.hasChunk(chunk.providerRef);
      if (!stat.exists) {
        missing++;
      }
    }

    return { healthy: missing === 0, missingCount: missing };
  }

  private seedInitialData(): void {
    const sampleText = 'Welcome to BucketSpace V0.1 — Local Personal Storage!';
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
