/**
 * CRDT Metadata Mutation Payload for Real-Time Workspace Synchronization
 */
export interface MetadataMutationPayload {
  fileId: string;
  field: string;
  newValue: unknown;
  clientTimestamp: number; // Unix Epoch UTC ms
  vectorClock: number;
  /** Used as deterministic tie-breaker when timestamps are equal */
  userId?: string;
}

/**
 * Existing field state wrapper for LWW comparison
 */
export interface FieldState<T = unknown> {
  value: T;
  timestamp: number;
  updatedByUserId?: string;
}

/**
 * Resolves concurrent field metadata mutations using Last-Write-Wins (LWW)
 * Element-Set CRDT logic with a deterministic tie-breaker.
 *
 * Resolution order:
 *  1. Higher clientTimestamp wins.
 *  2. On equal timestamps, higher vectorClock wins.
 *  3. On equal vectorClocks, lexicographically greater userId wins.
 *  4. If still tied, reject incoming (existing state is retained).
 *
 * @param existing - Currently persisted field state with timestamp
 * @param incoming - Incoming mutation payload from WebSocket or API client
 * @returns true if incoming mutation wins and should be applied; false otherwise.
 */
export function resolveLWWConflict(
  existing: FieldState,
  incoming: MetadataMutationPayload
): boolean {
  // Primary: timestamp comparison
  if (incoming.clientTimestamp > existing.timestamp) return true;
  if (incoming.clientTimestamp < existing.timestamp) return false;

  // Secondary: vectorClock comparison (same timestamp)
  const existingClock = 0; // Existing state doesn't carry vectorClock, assume 0
  if (incoming.vectorClock > existingClock) return true;
  if (incoming.vectorClock < existingClock) return false;

  // Tertiary: deterministic userId tie-breaker (lexicographic comparison)
  const incomingUserId = incoming.userId ?? '';
  const existingUserId = existing.updatedByUserId ?? '';
  if (incomingUserId > existingUserId) return true;

  // Default: reject incoming (existing state wins)
  return false;
}
