import { createHash } from 'node:crypto';
import { createReadStream, statSync } from 'node:fs';

export interface FileChunkItem {
  index: number;
  size: number;
  hash: string;
  data: AsyncIterable<Uint8Array>;
}

export interface ChunkerResult {
  chunkStream: AsyncIterable<FileChunkItem>;
  getWholeFileHash: () => string;
  totalSize: number;
}

/**
 * Creates an async stream of file chunks with SHA-256 digest calculation.
 * Streams bytes incrementally without loading the entire file into RAM.
 */
export function createFileChunker(filePath: string, chunkSize: number = 5 * 1024 * 1024): ChunkerResult {
  const fileStat = statSync(filePath);
  const totalSize = fileStat.size;

  const wholeFileHasher = createHash('sha256');
  let wholeFileHashResult: string | null = null;

  async function* generateChunks(): AsyncIterable<FileChunkItem> {
    const fileReadStream = createReadStream(filePath, { highWaterMark: 64 * 1024 });

    let currentChunkIndex = 0;
    let currentChunkBuffers: Uint8Array[] = [];
    let currentChunkSize = 0;

    for await (const rawPiece of fileReadStream) {
      const bufferPiece = new Uint8Array(rawPiece);
      wholeFileHasher.update(bufferPiece);

      let offset = 0;
      while (offset < bufferPiece.length) {
        const remainingSpaceInChunk = chunkSize - currentChunkSize;
        const sliceLength = Math.min(bufferPiece.length - offset, remainingSpaceInChunk);
        const subSlice = bufferPiece.subarray(offset, offset + sliceLength);

        currentChunkBuffers.push(subSlice);
        currentChunkSize += sliceLength;
        offset += sliceLength;

        // If chunk is full, compute chunk hash and yield it
        if (currentChunkSize >= chunkSize) {
          const chunkHash = computeBufferArrayHash(currentChunkBuffers);
          const chunkData = createChunkByteStream(currentChunkBuffers);

          yield {
            index: currentChunkIndex,
            size: currentChunkSize,
            hash: chunkHash,
            data: chunkData,
          };

          currentChunkIndex++;
          currentChunkBuffers = [];
          currentChunkSize = 0;
        }
      }
    }

    // Yield any remaining trailing chunk
    if (currentChunkSize > 0) {
      const chunkHash = computeBufferArrayHash(currentChunkBuffers);
      const chunkData = createChunkByteStream(currentChunkBuffers);

      yield {
        index: currentChunkIndex,
        size: currentChunkSize,
        hash: chunkHash,
        data: chunkData,
      };
    }

    wholeFileHashResult = wholeFileHasher.digest('hex');
  }

  return {
    chunkStream: generateChunks(),
    getWholeFileHash: () => {
      if (wholeFileHashResult === null) {
        throw new Error('Whole-file hash is not available until chunkStream is fully consumed.');
      }
      return wholeFileHashResult;
    },
    totalSize,
  };
}

function computeBufferArrayHash(buffers: Uint8Array[]): string {
  const hasher = createHash('sha256');
  for (const buf of buffers) {
    hasher.update(buf);
  }
  return hasher.digest('hex');
}

async function* createChunkByteStream(buffers: Uint8Array[]): AsyncIterable<Uint8Array> {
  for (const buf of buffers) {
    yield buf;
  }
}
