/**
 * CRDT Metadata Mutation Payload for Real-Time Workspace Synchronization
 */
export interface MetadataMutationPayload {
  fileId: string;
  field: string;
  newValue: unknown;
  clientTimestamp: number; // Unix Epoch UTC ms
  vectorClock: number;
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
 * Resolves concurrent field metadata mutations using Last-Write-Wins (LWW) Element-Set CRDT logic.
 * Accept mutation if incoming clientTimestamp is strictly greater than existing timestamp,
 * or if timestamps are equal, resolve deterministically using high-resolution comparison.
 *
 * @param existing - Currently persisted field state with timestamp
 * @param incoming - Incoming mutation payload from WebSocket or API client
 * @returns true if incoming mutation wins and should be applied; false otherwise.
 */
export function resolveLWWConflict(
  existing: FieldState,
  incoming: MetadataMutationPayload
): boolean {
  if (incoming.clientTimestamp > existing.timestamp) {
    return true;
  }
  if (incoming.clientTimestamp === existing.timestamp) {
    // Deterministic tie-breaker using vectorClock comparison
    return incoming.vectorClock > 0;
  }
  return false;
}
