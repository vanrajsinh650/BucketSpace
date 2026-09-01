/* ─── Transfer Concurrency Worker Queue ─── */

export interface QueueOptions {
  concurrency?: number; // Max active parallel transfers (default 4)
}

interface QueueTask<T> {
  fn: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
}

/**
 * TransferQueue limits concurrent chunk transfers across providers.
 * Enforces a hard cap (default 4) on parallel streams to prevent socket starvation,
 * memory spikes, and rate-limiting during batch operations.
 */
export class TransferQueue {
  private readonly concurrency: number;
  private activeCount = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly queue: QueueTask<any>[] = [];

  constructor(options: QueueOptions = {}) {
    this.concurrency = options.concurrency ?? 4;
  }

  /** Number of currently executing tasks */
  public getActiveCount(): number {
    return this.activeCount;
  }

  /** Number of tasks waiting in queue */
  public getQueuedCount(): number {
    return this.queue.length;
  }

  /**
   * Enqueue a task for execution.
   * If activeCount < concurrency, runs immediately.
   * Otherwise, queues task and waits for a free slot.
   */
  public execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.processNext();
    });
  }

  private processNext(): void {
    if (this.activeCount >= this.concurrency || this.queue.length === 0) {
      return;
    }

    const task = this.queue.shift()!;
    this.activeCount++;

    task
      .fn()
      .then((val) => task.resolve(val))
      .catch((err) => task.reject(err))
      .finally(() => {
        this.activeCount--;
        this.processNext();
      });
  }
}
