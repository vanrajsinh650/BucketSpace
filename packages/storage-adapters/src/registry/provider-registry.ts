import { IStorageProvider } from '@bucketspace/shared';

/**
 * ProviderRegistry manages registered IStorageProvider instances by provider ID.
 * Decouples application UI and core services from specific provider implementations.
 */
export class ProviderRegistry {
  private static readonly providers = new Map<string, IStorageProvider>();

  /** Register an IStorageProvider instance */
  public static register(provider: IStorageProvider): void {
    if (!provider.providerId) {
      throw new Error('Cannot register provider with invalid or empty providerId');
    }
    this.providers.set(provider.providerId, provider);
  }

  /** Retrieve a registered IStorageProvider instance by provider ID */
  public static get(providerId: string): IStorageProvider {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Storage provider '${providerId}' is not registered in ProviderRegistry`);
    }
    return provider;
  }

  /** Check if a provider ID is registered */
  public static has(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  /** Clear all registered providers (useful for tests or runtime re-configuration) */
  public static clear(): void {
    this.providers.clear();
  }
}
