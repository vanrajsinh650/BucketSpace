import { FastifyInstance } from 'fastify';
import { WebSocket } from 'ws';
import { resolveLWWConflict, MetadataMutationPayload, FieldState } from '@bucketspace/shared';

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
}

export interface WorkspaceChannel {
  workspaceId: string;
  clients: Map<string, ConnectedClient>;
  fieldStates: Map<string, FieldState>; // fileId:field -> FieldState
}

/* ------------------------------------------------------------------ */
/*  Workspace Pub/Sub Manager                                          */
/* ------------------------------------------------------------------ */

class WorkspaceSyncManager {
  private channels = new Map<string, WorkspaceChannel>();

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

  public removeClient(clientId: string, workspaceId: string): void {
    const channel = this.channels.get(workspaceId);
    if (!channel) return;

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

    const wins = resolveLWWConflict(existing, payload);
    if (wins) {
      channel.fieldStates.set(stateKey, {
        value: payload.newValue,
        timestamp: payload.clientTimestamp,
        updatedByUserId: client.userId,
      });

      // Broadcast resolved mutation to all workspace peers
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
    client.ws.send(JSON.stringify({
      type: 'FILE_MUTATION_REJECTED',
      fileId: payload.fileId,
      field: payload.field,
      reason: 'CONCURRENT_STALE_TIMESTAMP',
    }));
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
}

export const workspaceSyncManager = new WorkspaceSyncManager();

/* ------------------------------------------------------------------ */
/*  WebSocket Controller Route Registration                           */
/* ------------------------------------------------------------------ */

export function registerWebSocketRoutes(server: FastifyInstance): void {
  server.get(
    '/api/v1/ws/workspace/:workspaceId',
    { websocket: true },
    (connection, req) => {
      const socket = connection.socket;
      const workspaceId = (req.params as { workspaceId: string }).workspaceId || 'default-workspace';
      const clientId = `client-${Math.random().toString(36).substring(2, 9)}`;
      const userId = (req.query as { userId?: string }).userId || `user-${clientId}`;
      const userName = (req.query as { userName?: string }).userName || `Collaborator ${clientId.slice(-4)}`;

      const client: ConnectedClient = {
        id: clientId,
        userId,
        userName,
        workspaceId,
        ws: socket,
        joinedAt: new Date(),
      };

      workspaceSyncManager.addClient(client);

      socket.on('message', (raw: Buffer) => {
        try {
          const event = JSON.parse(raw.toString());
          if (event.type === 'PING') {
            socket.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          } else if (event.type === 'CURSOR_MOVE') {
            workspaceSyncManager.updateCursor(client, event.cursor);
          } else if (event.type === 'FILE_MUTATION') {
            workspaceSyncManager.handleMetadataMutation(client, event.payload);
          } else if (event.type === 'FILE_SELECTION') {
            client.activeFileId = event.fileId;
            workspaceSyncManager.broadcast(workspaceId, {
              type: 'USER_SELECTED_FILE',
              userId: client.userId,
              userName: client.userName,
              fileId: event.fileId,
            });
          }
        } catch {
          // Ignore malformed messages
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
