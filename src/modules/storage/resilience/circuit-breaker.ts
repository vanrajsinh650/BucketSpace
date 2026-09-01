/* ─── Provider Circuit Breaker ─── */

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitOptions {
  failureThreshold?: number; // Failures before opening circuit (default 3)
  resetTimeoutMs?: number;   // Time in OPEN state before transitioning to HALF_OPEN (default 5000ms)
}

interface ProviderCircuit {
  state: CircuitState;
  failures: number;
  lastFailureTime?: number;
  lastError?: string;
}

/**
 * ProviderCircuitBreaker protects BucketSpace against failing or throttled providers
 * (e.g., Telegram 429 Too Many Requests, S3 network timeouts).
 *
 * State Machine:
 *   - CLOSED: Normal operation. Successes reset failure count.
 *   - OPEN: Provider failed threshold times. Rejects requests immediately.
 *   - HALF_OPEN: Probe state after resetTimeoutMs. One probe request is allowed.
 *                If probe succeeds → CLOSED. If probe fails → OPEN.
 */
export class ProviderCircuitBreaker {
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly circuits = new Map<string, ProviderCircuit>();

  constructor(options: CircuitOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 3;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 5000;
  }

  /** Get current state for a provider */
  public getState(providerId: string): CircuitState {
    const circuit = this.circuits.get(providerId);
    if (!circuit) return 'CLOSED';

    // Auto-transition from OPEN to HALF_OPEN if resetTimeoutMs has elapsed
    if (circuit.state === 'OPEN' && circuit.lastFailureTime) {
      if (Date.now() - circuit.lastFailureTime >= this.resetTimeoutMs) {
        circuit.state = 'HALF_OPEN';
        return 'HALF_OPEN';
      }
    }

    return circuit.state;
  }

  /** Returns true if provider can accept requests (CLOSED or HALF_OPEN) */
  public isAvailable(providerId: string): boolean {
    const state = this.getState(providerId);
    return state === 'CLOSED' || state === 'HALF_OPEN';
  }

  /** Manually trip a provider circuit into OPEN state */
  public trip(providerId: string, reason: string): void {
    const circuit = this.getOrCreateCircuit(providerId);
    circuit.state = 'OPEN';
    circuit.failures = this.failureThreshold;
    circuit.lastFailureTime = Date.now();
    circuit.lastError = reason;
  }

  /** Manually reset a provider circuit to CLOSED state */
  public reset(providerId: string): void {
    const circuit = this.getOrCreateCircuit(providerId);
    circuit.state = 'CLOSED';
    circuit.failures = 0;
    circuit.lastFailureTime = undefined;
    circuit.lastError = undefined;
  }

  /** Execute a function protected by the circuit breaker */
  public async execute<T>(providerId: string, fn: () => Promise<T>): Promise<T> {
    const state = this.getState(providerId);

    if (state === 'OPEN') {
      throw new Error(`Provider '${providerId}' circuit breaker is OPEN (${this.circuits.get(providerId)?.lastError ?? 'unhealthy'})`);
    }

    try {
      const result = await fn();
      this.onSuccess(providerId);
      return result;
    } catch (err: unknown) {
      this.onFailure(providerId, err);
      throw err;
    }
  }

  private onSuccess(providerId: string): void {
    const circuit = this.getOrCreateCircuit(providerId);
    if (circuit.state === 'HALF_OPEN') {
      // Successful probe transition back to CLOSED
      circuit.state = 'CLOSED';
      circuit.failures = 0;
      circuit.lastFailureTime = undefined;
      circuit.lastError = undefined;
    } else if (circuit.state === 'CLOSED') {
      circuit.failures = 0;
    }
  }

  private onFailure(providerId: string, err: unknown): void {
    const circuit = this.getOrCreateCircuit(providerId);
    const msg = err instanceof Error ? err.message : String(err);
    circuit.failures++;
    circuit.lastFailureTime = Date.now();
    circuit.lastError = msg;

    if (circuit.failures >= this.failureThreshold || circuit.state === 'HALF_OPEN') {
      circuit.state = 'OPEN';
    }
  }

  private getOrCreateCircuit(providerId: string): ProviderCircuit {
    let circuit = this.circuits.get(providerId);
    if (!circuit) {
      circuit = { state: 'CLOSED', failures: 0 };
      this.circuits.set(providerId, circuit);
    }
    return circuit;
  }
}
