import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { resolveLWWConflict, MetadataMutationPayload, FieldState } from '@bucketspace/shared';
import type { SocketStream } from '@fastify/websocket';

/* ------------------------------------------------------------------ */
/*  Real-Time WebSocket Workspace Presence & Sync State               */
/* ------------------------------------------------------------------ */

export interface ConnectedClient {
  id: string;
  userId: string;
  userName: string;
  workspaceId: string;
  ws: WebSocket;
  cursor?: { x: number; y: number };
  activeFileId?: string;
  joinedAt: Date;
  isAlive: boolean;
}

export interface WorkspaceChannel {
  workspaceId: string;
  clients: Map<string, ConnectedClient>;
  fieldStates: Map<string, FieldState>; // fileId:field -> FieldState
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

/** Heartbeat interval in ms — pings every 30s to detect dead connections */
const HEARTBEAT_INTERVAL_MS = 30_000;

/* ------------------------------------------------------------------ */
/*  Workspace Pub/Sub Manager                                          */
/* ------------------------------------------------------------------ */

class WorkspaceSyncManager {
  private channels = new Map<string, WorkspaceChannel>();
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startHeartbeat();
  }

  public getOrCreateChannel(workspaceId: string): WorkspaceChannel {
    let channel = this.channels.get(workspaceId);
    if (!channel) {
      channel = {
        workspaceId,
        clients: new Map(),
        fieldStates: new Map(),
      };
      this.channels.set(workspaceId, channel);
    }
    return channel;
  }

  public addClient(client: ConnectedClient): void {
    const channel = this.getOrCreateChannel(client.workspaceId);
    channel.clients.set(client.id, client);

    // Broadcast presence update (user joined)
    this.broadcast(client.workspaceId, {
      type: 'PRESENCE_JOIN',
      client: {
        id: client.id,
        userId: client.userId,
        userName: client.userName,
        cursor: client.cursor,
      },
      activeUsers: Array.from(channel.clients.values()).map((c) => ({
        id: c.id,
        userId: c.userId,
        userName: c.userName,
        activeFileId: c.activeFileId,
      })),
    });
  }

  /**
   * Safely removes a client. Guarded against double-removal:
   * if the client is already gone from the Map, this is a no-op.
   */
  public removeClient(clientId: string, workspaceId: string): void {
    const channel = this.channels.get(workspaceId);
    if (!channel) return;

    // Guard: check if client actually exists before broadcasting
    if (!channel.clients.has(clientId)) return;

    channel.clients.delete(clientId);

    if (channel.clients.size === 0) {
      this.channels.delete(workspaceId);
    } else {
      this.broadcast(workspaceId, {
        type: 'PRESENCE_LEAVE',
        clientId,
        activeUsersCount: channel.clients.size,
      });
    }
  }

  public updateCursor(client: ConnectedClient, cursor: { x: number; y: number }): void {
    client.cursor = cursor;
    this.broadcast(client.workspaceId, {
      type: 'CURSOR_MOVE',
      clientId: client.id,
      userId: client.userId,
      cursor,
    }, client.id);
  }

  public handleMetadataMutation(client: ConnectedClient, payload: MetadataMutationPayload): boolean {
    const channel = this.getOrCreateChannel(client.workspaceId);
    const stateKey = `${payload.fileId}:${payload.field}`;
    const existing = channel.fieldStates.get(stateKey) ?? { value: null, timestamp: 0 };

    // Inject userId for deterministic tie-breaking
    const enrichedPayload: MetadataMutationPayload = {
      ...payload,
      userId: client.userId,
    };

    const wins = resolveLWWConflict(existing, enrichedPayload);
    if (wins) {
      channel.fieldStates.set(stateKey, {
        value: payload.newValue,
        timestamp: payload.clientTimestamp,
        updatedByUserId: client.userId,
      });

      this.broadcast(client.workspaceId, {
        type: 'FILE_MUTATION_ACCEPTED',
        fileId: payload.fileId,
        field: payload.field,
        newValue: payload.newValue,
        timestamp: payload.clientTimestamp,
        updatedBy: client.userName,
      });
      return true;
    }

    // Send rejection notice to sender if state was stale
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({
        type: 'FILE_MUTATION_REJECTED',
        fileId: payload.fileId,
        field: payload.field,
        reason: 'CONCURRENT_STALE_TIMESTAMP',
      }));
    }
    return false;
  }

  public broadcast(workspaceId: string, message: unknown, excludeClientId?: string): void {
    const channel = this.channels.get(workspaceId);
    if (!channel) return;

    const json = JSON.stringify(message);
    for (const [id, client] of channel.clients.entries()) {
      if (id !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(json);
      }
    }
  }

  /**
   * Server-side heartbeat: pings all connected clients every 30s.
   * If a client doesn't respond with pong before the next ping, it is terminated.
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      for (const [, channel] of this.channels) {
        for (const [clientId, client] of channel.clients) {
          if (!client.isAlive) {
            // Client did not respond to last ping — terminate
            client.ws.terminate();
            this.removeClient(clientId, channel.workspaceId);
            continue;
          }
          client.isAlive = false;
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.ping();
          }
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  /** Cleanup heartbeat timer (for graceful shutdown) */
  public destroy(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

export const workspaceSyncManager = new WorkspaceSyncManager();

/* ------------------------------------------------------------------ */
/*  WebSocket Controller Route Registration                           */
/* ------------------------------------------------------------------ */

export function registerWebSocketRoutes(server: FastifyInstance): void {
  server.get(
    '/api/v1/ws/workspace/:workspaceId',
    { websocket: true },
    (connection: SocketStream, req) => {
      const socket = connection.socket;
      // @fastify/websocket v8.x: connection is SocketStream, socket is at connection.socket
      const workspaceId = (req.params as { workspaceId: string }).workspaceId || 'default-workspace';
      const clientId = `client-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const userId = (req.query as { userId?: string }).userId || `user-${clientId}`;
      const userName = (req.query as { userName?: string }).userName || `Collaborator ${clientId.slice(-4)}`;

      const client: ConnectedClient = {
        id: clientId,
        userId,
        userName,
        workspaceId,
        ws: socket,
        joinedAt: new Date(),
        isAlive: true,
      };

      workspaceSyncManager.addClient(client);

      // Mark client alive on pong response (heartbeat mechanism)
      socket.on('pong', () => {
        client.isAlive = true;
      });

      socket.on('message', (raw: Buffer) => {
        try {
          const event = JSON.parse(raw.toString());

          switch (event.type) {
            case 'PING':
              socket.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
              break;

            case 'CURSOR_MOVE':
              if (event.cursor && typeof event.cursor.x === 'number' && typeof event.cursor.y === 'number') {
                workspaceSyncManager.updateCursor(client, event.cursor);
              }
              break;

            case 'FILE_MUTATION':
              if (event.payload) {
                workspaceSyncManager.handleMetadataMutation(client, event.payload);
              }
              break;

            case 'FILE_SELECTION':
              if (event.fileId) {
                client.activeFileId = event.fileId;
                workspaceSyncManager.broadcast(workspaceId, {
                  type: 'USER_SELECTED_FILE',
                  userId: client.userId,
                  userName: client.userName,
                  fileId: event.fileId,
                });
              }
              break;
          }
        } catch {
          // Ignore malformed JSON messages
        }
      });

      socket.on('close', () => {
        workspaceSyncManager.removeClient(clientId, workspaceId);
      });

      socket.on('error', () => {
        workspaceSyncManager.removeClient(clientId, workspaceId);
      });
    }
  );
}
