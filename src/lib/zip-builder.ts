/**
 * Zero-dependency pure in-memory PKZIP archive generator.
 * Encodes uncompressed (Stored) entries with CRC-32 and standard ZIP directory structures.
 */

// CRC-32 Lookup Table
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[i] = c >>> 0;
}

function calculateCrc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipFileInput {
  name: string;
  bytes: Uint8Array;
}

export function createZipArchive(files: ZipFileInput[]): Uint8Array {
  const encoder = new TextEncoder();
  const fileRecords: {
    nameBytes: Uint8Array;
    bytes: Uint8Array;
    crc32: number;
    offset: number;
  }[] = [];

  let totalSize = 0;

  // 1. Calculate Local Headers & Offsets
  for (const file of files) {
    const nameBytes = encoder.encode(file.name);
    const crc32 = calculateCrc32(file.bytes);
    fileRecords.push({
      nameBytes,
      bytes: file.bytes,
      crc32,
      offset: totalSize,
    });
    // Local header is 30 bytes + name length + file bytes
    totalSize += 30 + nameBytes.length + file.bytes.length;
  }

  const centralDirectoryOffset = totalSize;
  let centralDirectorySize = 0;

  // Calculate Central Directory Size
  for (const rec of fileRecords) {
    // Central directory header is 46 bytes + name length
    centralDirectorySize += 46 + rec.nameBytes.length;
  }

  // End of Central Directory record is 22 bytes
  totalSize += centralDirectorySize + 22;

  const buffer = new Uint8Array(totalSize);
  const view = new DataView(buffer.buffer);
  let pos = 0;

  // 2. Write Local File Headers + File Data
  for (const rec of fileRecords) {
    // Local File Header Signature: 0x04034b50
    view.setUint32(pos, 0x04034b50, true);
    view.setUint16(pos + 4, 20, true); // Version needed (2.0)
    view.setUint16(pos + 6, 0, true);  // General purpose bit flag
    view.setUint16(pos + 8, 0, true);  // Compression method (0 = Store)
    view.setUint16(pos + 10, 0, true); // Last mod file time
    view.setUint16(pos + 12, 0, true); // Last mod file date
    view.setUint32(pos + 14, rec.crc32, true); // CRC-32
    view.setUint32(pos + 18, rec.bytes.length, true); // Compressed size
    view.setUint32(pos + 22, rec.bytes.length, true); // Uncompressed size
    view.setUint16(pos + 26, rec.nameBytes.length, true); // File name length
    view.setUint16(pos + 28, 0, true); // Extra field length
    pos += 30;

    // File name
    buffer.set(rec.nameBytes, pos);
    pos += rec.nameBytes.length;

    // File data
    buffer.set(rec.bytes, pos);
    pos += rec.bytes.length;
  }

  // 3. Write Central Directory Headers
  for (const rec of fileRecords) {
    // Central Directory File Header Signature: 0x02014b50
    view.setUint32(pos, 0x02014b50, true);
    view.setUint16(pos + 4, 20, true); // Version made by
    view.setUint16(pos + 6, 20, true); // Version needed
    view.setUint16(pos + 8, 0, true);  // General purpose bit flag
    view.setUint16(pos + 10, 0, true); // Compression method (0 = Store)
    view.setUint16(pos + 12, 0, true); // Last mod file time
    view.setUint16(pos + 14, 0, true); // Last mod file date
    view.setUint32(pos + 16, rec.crc32, true); // CRC-32
    view.setUint32(pos + 20, rec.bytes.length, true); // Compressed size
    view.setUint32(pos + 24, rec.bytes.length, true); // Uncompressed size
    view.setUint16(pos + 28, rec.nameBytes.length, true); // File name length
    view.setUint16(pos + 30, 0, true); // Extra field length
    view.setUint16(pos + 32, 0, true); // File comment length
    view.setUint16(pos + 34, 0, true); // Disk number start
    view.setUint16(pos + 36, 0, true); // Internal file attributes
    view.setUint32(pos + 38, 0, true); // External file attributes
    view.setUint32(pos + 42, rec.offset, true); // Relative offset of local header
    pos += 46;

    buffer.set(rec.nameBytes, pos);
    pos += rec.nameBytes.length;
  }

  // 4. Write End of Central Directory Record: 0x06054b50
  view.setUint32(pos, 0x06054b50, true);
  view.setUint16(pos + 4, 0, true);  // Number of this disk
  view.setUint16(pos + 6, 0, true);  // Disk where central directory starts
  view.setUint16(pos + 8, fileRecords.length, true); // Number of central directory records on this disk
  view.setUint16(pos + 10, fileRecords.length, true); // Total number of central directory records
  view.setUint32(pos + 12, centralDirectorySize, true); // Size of central directory
  view.setUint32(pos + 16, centralDirectoryOffset, true); // Offset of start of central directory
  view.setUint16(pos + 20, 0, true); // Comment length

  return buffer;
}
