import { Readable } from 'stream';

/* ------------------------------------------------------------------ */
/*  Shared Stream Utilities for Storage Adapters                       */
/* ------------------------------------------------------------------ */

/** Default safety cap for stream-to-buffer operations (100 MB) */
const DEFAULT_STREAM_BUFFER_MAX_BYTES = 100 * 1024 * 1024;

/**
 * Collects a Readable stream into a single Buffer.
 * Throws if the accumulated size exceeds the safety cap to prevent OOM.
 *
 * @param stream   - The readable stream to consume
 * @param maxBytes - Maximum allowed buffer size (default 100 MB)
 * @param label    - Label for error messages (e.g. adapter class name)
 */
export async function streamToBuffer(
  stream: Readable,
  maxBytes: number = DEFAULT_STREAM_BUFFER_MAX_BYTES,
  label: string = 'StorageAdapter'
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buf.length;

    if (totalBytes > maxBytes) {
      stream.destroy();
      throw new Error(
        `Stream exceeded ${maxBytes} byte safety cap in ${label} (received ${totalBytes} bytes)`
      );
    }
    chunks.push(buf);
  }

  return Buffer.concat(chunks);
}
