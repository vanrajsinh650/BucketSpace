import fs from 'node:fs';
import path from 'node:path';

export interface ShareRecord {
  token: string;
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  chunks: any[];
  passcode?: string;
  expiresAt?: string;
  createdAt: string;
  ownerSessionString?: string;
  telegramSession?: string;
  wholeFileHash?: string;
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

function ensureLoaded(): Map<string, ShareRecord> {
  const container = getContainer();
  if (!container.loaded) {
    try {
      if (fs.existsSync(SHARES_FILE)) {
        const raw = fs.readFileSync(SHARES_FILE, 'utf8');
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          for (const item of data) {
            if (item && item.token) {
              container.map.set(item.token, item);
            }
          }
        }
      }
    } catch (e) {
      console.warn('[ShareStoreService] Could not load persisted shares from disk:', e);
    }
    container.loaded = true;
  }
  return container.map;
}

function persistToDisk(): void {
  const container = getContainer();
  try {
    const list = Array.from(container.map.values());
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
            for (const item of data) {
              if (item && item.token) {
                map.set(item.token, item);
              }
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
    map.set(record.token, record);
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
}
