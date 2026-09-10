import fs from 'node:fs';
import path from 'node:path';
import { TelegramSessionRegistry } from './telegram-session-registry';

export type InMemoryChunkData =
  | Uint8Array
  | number[]
  | Record<string, number>;

export interface ShareChunkRef {
  id?: string;
  index?: number;
  sizeBytes?: number;
  size?: number;
  hash?: string;
  providerRef?: {
    providerId?: string;
    reference?: Record<string, unknown>;
  };
  [key: string]: unknown;
}

export interface ShareRecord {
  token: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  chunks: ShareChunkRef[];
  passcode?: string;
  expiresAt?: string;
  createdAt: string;
  ownerProviderRef?: string;
  wholeFileHash?: string;
  /** Test/mock fallback: pre-buffered ciphertext chunks for automated tests */
  inMemoryChunks?: InMemoryChunkData[] | Record<string, InMemoryChunkData>;
}

const DATA_DIR = process.env.DATA_DIR || (process.platform === 'win32' ? process.env.TEMP : '/tmp') || '/tmp';
const SHARES_FILE = path.join(DATA_DIR, 'bucketspace_shares.json');

interface GlobalShareContainer {
  map: Map<string, ShareRecord>;
  loaded: boolean;
}

const globalForShares = globalThis as unknown as {
  __bucketspace_persistent_share_store?: GlobalShareContainer;
};

function getContainer(): GlobalShareContainer {
  if (!globalForShares.__bucketspace_persistent_share_store) {
    globalForShares.__bucketspace_persistent_share_store = {
      map: new Map<string, ShareRecord>(),
      loaded: false,
    };
  }
  return globalForShares.__bucketspace_persistent_share_store;
}

/**
 * Sanitizes a ShareRecord by whitelisting only known safe, non-credential fields.
 * Guarantees that raw session strings, credentials, or arbitrary injected fields
 * can NEVER be persisted to disk or leaked in memory.
 */
export function sanitizeRecord(record: ShareRecord | (Partial<ShareRecord> & { [key: string]: unknown })): ShareRecord {
  const r = record as Record<string, unknown>;
  const sanitized: ShareRecord = {
    token: String(r.token || ''),
    fileId: String(r.fileId || ''),
    fileName: String(r.fileName || ''),
    fileSize: Number(r.fileSize || 0),
    mimeType: String(r.mimeType || 'application/octet-stream'),
    chunks: Array.isArray(r.chunks) ? (r.chunks as ShareChunkRef[]) : [],
    createdAt: String(r.createdAt || new Date().toISOString()),
  };

  if (r.passcode !== undefined && r.passcode !== null) {
    sanitized.passcode = String(r.passcode);
  }
  if (r.expiresAt) {
    sanitized.expiresAt = String(r.expiresAt);
  }
  if (r.wholeFileHash) {
    sanitized.wholeFileHash = String(r.wholeFileHash);
  }
  if (r.ownerProviderRef) {
    sanitized.ownerProviderRef = String(r.ownerProviderRef);
  }
  if (r.inMemoryChunks) {
    sanitized.inMemoryChunks = r.inMemoryChunks as InMemoryChunkData[] | Record<string, InMemoryChunkData>;
  }

  return sanitized;
}

/**
 * Processes a raw persisted item from disk.
 * Detects legacy records with raw session fields and safely migrates them
 * to the runtime TelegramSessionRegistry, or removes unsafe records.
 */
function processLoadedItem(rawItem: unknown, targetMap: Map<string, ShareRecord>): boolean {
  if (!rawItem || typeof rawItem !== 'object') {
    return false;
  }
  const item = rawItem as Record<string, unknown>;
  if (!item.token || typeof item.token !== 'string') {
    return false;
  }

  let hadLegacySession = false;
  const legacySession = item.ownerSessionString || item.telegramSession;

  if (legacySession) {
    if (typeof legacySession === 'string' && legacySession.trim().length > 0) {
      // Migrate to server runtime registry without persisting the raw credential
      if (!item.ownerProviderRef || typeof item.ownerProviderRef !== 'string') {
        item.ownerProviderRef = TelegramSessionRegistry.register(legacySession.trim());
      }
      hadLegacySession = true;
    } else {
      // Malformed or unusable legacy session — invalidate unsafe share rather than exposing it
      delete item.ownerSessionString;
      delete item.telegramSession;
      return true;
    }
  }

  // Strictly wipe any legacy credential fields from memory
  delete item.ownerSessionString;
  delete item.telegramSession;

  const cleanRecord = sanitizeRecord(item);
  targetMap.set(cleanRecord.token, cleanRecord);
  return hadLegacySession;
}

function ensureLoaded(): Map<string, ShareRecord> {
  const container = getContainer();
  if (!container.loaded) {
    let hadLegacySessions = false;
    try {
      if (fs.existsSync(SHARES_FILE)) {
        const raw = fs.readFileSync(SHARES_FILE, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          for (const item of data) {
            const migrated = processLoadedItem(item, container.map);
            if (migrated) {
              hadLegacySessions = true;
            }
          }
        }
      }
    } catch (e) {
      console.warn('[ShareStoreService] Could not load persisted shares from disk:', e);
    }
    container.loaded = true;

    // If legacy records containing raw sessions were found, immediately rewrite the file
    // so bucketspace_shares.json is cleansed of all raw credentials on disk.
    if (hadLegacySessions) {
      persistToDisk();
    }
  }
  return container.map;
}

function persistToDisk(): void {
  const container = getContainer();
  try {
    const list = Array.from(container.map.values()).map(sanitizeRecord);
    fs.writeFileSync(SHARES_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {
    console.warn('[ShareStoreService] Could not persist shares to disk:', e);
  }
}

export class ShareStoreService {
  public static get(token: string): ShareRecord | undefined {
    const map = ensureLoaded();
    let record = map.get(token);
    if (!record) {
      // Attempt re-read from disk in case another worker/process saved it
      try {
        if (fs.existsSync(SHARES_FILE)) {
          const raw = fs.readFileSync(SHARES_FILE, 'utf8');
          const data = JSON.parse(raw);
          if (Array.isArray(data)) {
            let hadLegacy = false;
            for (const item of data) {
              if (processLoadedItem(item, map)) {
                hadLegacy = true;
              }
            }
            if (hadLegacy) {
              persistToDisk();
            }
          }
        }
      } catch {
        // ignore
      }
      record = map.get(token);
    }

    if (record && record.expiresAt && new Date(record.expiresAt).getTime() <= Date.now()) {
      map.delete(token);
      persistToDisk();
      return undefined;
    }

    return record;
  }

  public static set(record: ShareRecord): void {
    const map = ensureLoaded();
    const rawRecord = record as unknown as Record<string, unknown>;

    // In case callers pass legacy fields at runtime:
    const legacySession = rawRecord.ownerSessionString || rawRecord.telegramSession;
    if (typeof legacySession === 'string' && legacySession.trim().length > 0) {
      if (!rawRecord.ownerProviderRef) {
        rawRecord.ownerProviderRef = TelegramSessionRegistry.register(legacySession.trim());
      }
      delete rawRecord.ownerSessionString;
      delete rawRecord.telegramSession;
    }

    const cleanRecord = sanitizeRecord(rawRecord);
    map.set(cleanRecord.token, cleanRecord);
    persistToDisk();
  }

  public static delete(token: string): boolean {
    const map = ensureLoaded();
    const deleted = map.delete(token);
    if (deleted) {
      persistToDisk();
    }
    return deleted;
  }

  /**
   * Clears all shares in memory and removes the persistence file from disk (for testing).
   */
  public static clear(): void {
    const container = getContainer();
    container.map.clear();
    container.loaded = true;
    try {
      if (fs.existsSync(SHARES_FILE)) {
        fs.unlinkSync(SHARES_FILE);
      }
    } catch {
      // ignore
    }
  }
}

