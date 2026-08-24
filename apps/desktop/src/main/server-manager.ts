import { ChildProcess, fork } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';

export interface ServerManagerOptions {
  apiPort?: number;
  dbPath?: string;
  isDev?: boolean;
}

export class ServerManager {
  private apiProcess: ChildProcess | null = null;
  private readonly port: number;
  private readonly isDev: boolean;
  private readonly dbPath?: string;

  constructor(options: ServerManagerOptions = {}) {
    this.port = options.apiPort ?? 4000;
    this.isDev = options.isDev ?? false;
    this.dbPath = options.dbPath;
  }

  public async start(): Promise<void> {
    // 1. Check if server is already running on this port
    const alreadyHealthy = await this.checkHealth();
    if (alreadyHealthy) {
      console.log(`[ServerManager] Fastify API already responsive on port ${this.port}`);
      return;
    }

    // 2. Locate API entrypoint
    let apiEntry: string;
    try {
      apiEntry = require.resolve('@bucketspace/api');
    } catch {
      apiEntry = path.resolve(__dirname, '../../../api/dist/server.js');
    }

    console.log(`[ServerManager] Spawning Fastify API supervisor: ${apiEntry}`);

    this.apiProcess = fork(apiEntry, [], {
      env: {
        ...process.env,
        PORT: String(this.port),
        BUCKETSPACE_DB_PATH: this.dbPath ?? process.env.BUCKETSPACE_DB_PATH,
        NODE_ENV: this.isDev ? 'development' : 'production',
      },
      stdio: 'pipe',
    });

    this.apiProcess.stdout?.on('data', (data) => {
      console.log(`[API stdout] ${data.toString().trim()}`);
    });

    this.apiProcess.stderr?.on('data', (data) => {
      console.error(`[API stderr] ${data.toString().trim()}`);
    });

    this.apiProcess.on('exit', (code, signal) => {
      console.log(`[ServerManager] API process exited with code ${code}, signal ${signal}`);
      this.apiProcess = null;
    });

    // 3. Poll health check until ready (up to 15 seconds)
    await this.waitForHealth(15000);
  }

  public async stop(): Promise<void> {
    if (!this.apiProcess) return;

    console.log('[ServerManager] Terminating Fastify API supervisor...');
    this.apiProcess.kill('SIGTERM');

    // Force kill if not exited after 3 seconds
    const proc = this.apiProcess;
    setTimeout(() => {
      if (proc && !proc.killed) {
        proc.kill('SIGKILL');
      }
    }, 3000);

    this.apiProcess = null;
  }

  public async checkHealth(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(`http://127.0.0.1:${this.port}/healthz`, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(1000, () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  private async waitForHealth(timeoutMs: number): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      const isHealthy = await this.checkHealth();
      if (isHealthy) {
        console.log(`[ServerManager] Fastify API is HEALTHY on port ${this.port}`);
        return;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    console.warn(`[ServerManager] API health check timed out after ${timeoutMs}ms; continuing...`);
  }
}
