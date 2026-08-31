import {
  IStorageProvider,
  TelegramStorageAdapter,
} from '@bucketspace/storage-adapters';

/* ------------------------------------------------------------------ */
/*  Storage Adapter Factory                                            */
/*  Creates the correct adapter for a given ProviderType enum value.   */
/*  Singletons are cached per provider to avoid re-instantiation.      */
/* ------------------------------------------------------------------ */

const adapterCache = new Map<string, IStorageProvider>();

export class StorageAdapterFactory {
  /**
   * Returns a cached adapter instance for Telegram.
   * Creates one on first call.
   */
  static create(provider: string = 'TELEGRAM_DRIVE'): IStorageProvider {
    const cached = adapterCache.get(provider);
    if (cached) return cached;

    const botToken = process.env.TELEGRAM_BOT_TOKEN ?? 'dummy_bot_token';
    const defaultChatId = process.env.TELEGRAM_STORAGE_CHAT_ID ?? '@bucketspace_channel';
    const adapter: IStorageProvider = new TelegramStorageAdapter({ botToken, defaultChatId });

    adapterCache.set(provider, adapter);
    return adapter;
  }

  /** Clear cached adapters (useful for testing or credential rotation) */
  static clearCache(): void {
    adapterCache.clear();
  }
}
