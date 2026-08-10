import {
  IStorageProvider,
  TelegramStorageAdapter,
  S3StorageAdapter,
} from '@bucketspace/storage-adapters';

/* ------------------------------------------------------------------ */
/*  Storage Adapter Factory                                            */
/*  Creates the correct adapter for a given ProviderType enum value.   */
/*  Singletons are cached per provider to avoid re-instantiation.      */
/* ------------------------------------------------------------------ */

const adapterCache = new Map<string, IStorageProvider>();

export class StorageAdapterFactory {
  /**
   * Returns a cached adapter instance for the given provider type.
   * Creates one on first call for each provider.
   */
  static create(provider: string): IStorageProvider {
    const cached = adapterCache.get(provider);
    if (cached) return cached;

    let adapter: IStorageProvider;

    switch (provider) {
      case 'AWS_S3':
      case 'CLOUDFLARE_R2':
      case 'MINIO':
        adapter = new S3StorageAdapter({
          bucket: process.env.S3_BUCKET ?? 'bucketspace-storage',
          endpoint: process.env.MINIO_ENDPOINT ?? 'http://localhost:9000',
        });
        break;

      case 'TELEGRAM_DRIVE':
      default: {
        const botToken = process.env.TELEGRAM_BOT_TOKEN ?? 'dummy_bot_token';
        const defaultChatId = process.env.TELEGRAM_STORAGE_CHAT_ID ?? '@bucketspace_channel';
        adapter = new TelegramStorageAdapter({ botToken, defaultChatId });
        break;
      }
    }

    adapterCache.set(provider, adapter);
    return adapter;
  }

  /** Clear cached adapters (useful for testing or credential rotation) */
  static clearCache(): void {
    adapterCache.clear();
  }
}
