'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MetadataMutationPayload } from '@bucketspace/shared';

export interface ActiveUserPresence {
  id: string;
  userId: string;
  userName: string;
  activeFileId?: string;
  cursor?: { x: number; y: number };
}

export interface UseWebSocketSyncOptions {
  workspaceId: string;
  userId?: string;
  userName?: string;
  enabled?: boolean;
}

export function useWebSocketSync({
  workspaceId,
  userId = 'user-current',
  userName = 'Current User',
  enabled = true,
}: UseWebSocketSyncOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [activeUsers, setActiveUsers] = useState<ActiveUserPresence[]>([]);
  const [lastMutation, setLastMutation] = useState<MetadataMutationPayload | null>(null);

  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.hostname}:4000/api/v1/ws/workspace/${workspaceId}?userId=${encodeURIComponent(userId)}&userName=${encodeURIComponent(userName)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'PRESENCE_JOIN') {
          if (data.activeUsers) {
            setActiveUsers(data.activeUsers);
          }
        } else if (data.type === 'PRESENCE_LEAVE') {
          setActiveUsers((prev) => prev.filter((u) => u.id !== data.clientId));
        } else if (data.type === 'FILE_MUTATION_ACCEPTED') {
          setLastMutation({
            fileId: data.fileId,
            field: data.field,
            newValue: data.newValue,
            clientTimestamp: data.timestamp,
            vectorClock: 1,
          });
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [workspaceId, userId, userName, enabled]);

  const sendMutation = useCallback(
    (payload: MetadataMutationPayload) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'FILE_MUTATION',
            payload,
          })
        );
      }
    },
    []
  );

  const sendFileSelection = useCallback(
    (fileId: string) => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'FILE_SELECTION',
            fileId,
          })
        );
      }
    },
    []
  );

  return {
    isConnected,
    activeUsers,
    lastMutation,
    sendMutation,
    sendFileSelection,
  };
}
