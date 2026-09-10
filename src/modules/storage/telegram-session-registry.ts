import crypto from 'node:crypto';

interface GlobalSessionRegistryContainer {
  refToSession: Map<string, string>;
  sessionToRef: Map<string, string>;
}

const globalForRegistry = globalThis as unknown as {
  __bucketspace_telegram_session_registry?: GlobalSessionRegistryContainer;
};

function getRegistryContainer(): GlobalSessionRegistryContainer {
  if (!globalForRegistry.__bucketspace_telegram_session_registry) {
    globalForRegistry.__bucketspace_telegram_session_registry = {
      refToSession: new Map<string, string>(),
      sessionToRef: new Map<string, string>(),
    };
  }
  return globalForRegistry.__bucketspace_telegram_session_registry;
}

/**
 * TelegramSessionRegistry
 *
 * Dedicated server-side runtime-only registry for Telegram session strings.
 *
 * Security Invariants:
 * 1. Raw Telegram sessions are stored strictly in server volatile memory (Map) and
 *    are NEVER serialized to disk, database, logs, share records, or API responses.
 * 2. Share records store only opaque reference identifiers (e.g. `tgsref_<random>`)
 *    which are non-secret and cannot be used by clients as Telegram authentication.
 * 3. Session lifecycle: sessions can be invalidated, removed on logout, or evicted
 *    without touching share records on disk.
 */
export class TelegramSessionRegistry {
  /**
   * Registers an active Telegram session string in server runtime memory.
   * Returns an opaque, non-secret reference string (`tgsref_<hex>`).
   * If the session string is already registered, returns its existing reference.
   */
  public static register(sessionString: string, preferredRef?: string): string {
    if (!sessionString || typeof sessionString !== 'string' || sessionString.trim() === '') {
      throw new Error('[TelegramSessionRegistry] Cannot register an empty or invalid session string');
    }
    const container = getRegistryContainer();
    const cleanSession = sessionString.trim();

    // Deduplicate: if this exact session string was already registered, reuse the existing ref
    const existingRef = container.sessionToRef.get(cleanSession);
    if (existingRef) {
      return existingRef;
    }

    const ref = preferredRef && !container.refToSession.has(preferredRef)
      ? preferredRef
      : `tgsref_${crypto.randomBytes(16).toString('hex')}`;

    container.refToSession.set(ref, cleanSession);
    container.sessionToRef.set(cleanSession, ref);
    return ref;
  }

  /**
   * Resolves a raw Telegram session string using an opaque reference.
   * Returns undefined if the reference is not found or has been invalidated.
   */
  public static resolve(ref: string | undefined | null): string | undefined {
    if (!ref || typeof ref !== 'string') {
      return undefined;
    }
    const container = getRegistryContainer();
    return container.refToSession.get(ref);
  }

  /**
   * Removes a session mapping by its opaque reference.
   * Returns true if a mapping was removed, false otherwise.
   */
  public static remove(ref: string): boolean {
    if (!ref || typeof ref !== 'string') {
      return false;
    }
    const container = getRegistryContainer();
    const session = container.refToSession.get(ref);
    if (session) {
      container.sessionToRef.delete(session);
      return container.refToSession.delete(ref);
    }
    return false;
  }

  /**
   * Removes a session mapping by the raw session string (e.g. on logout or disconnect).
   * Returns true if a mapping was removed, false otherwise.
   */
  public static removeBySession(sessionString: string): boolean {
    if (!sessionString || typeof sessionString !== 'string') {
      return false;
    }
    const container = getRegistryContainer();
    const cleanSession = sessionString.trim();
    const ref = container.sessionToRef.get(cleanSession);
    if (ref) {
      container.sessionToRef.delete(cleanSession);
      return container.refToSession.delete(ref);
    }
    return false;
  }

  /**
   * Checks whether an opaque reference is currently active in the registry.
   */
  public static has(ref: string): boolean {
    if (!ref || typeof ref !== 'string') {
      return false;
    }
    const container = getRegistryContainer();
    return container.refToSession.has(ref);
  }

  /**
   * Clears all session mappings from runtime memory (e.g. during test teardown).
   */
  public static clear(): void {
    const container = getRegistryContainer();
    container.refToSession.clear();
    container.sessionToRef.clear();
  }

  /**
   * Number of active registered sessions in server memory.
   */
  public static get size(): number {
    return getRegistryContainer().refToSession.size;
  }
}
