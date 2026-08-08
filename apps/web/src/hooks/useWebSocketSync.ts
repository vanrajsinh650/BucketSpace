'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { MetadataMutationPayload } from '@bucketspace/shared';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */
/*  Reconnection Constants                                             */
/* ------------------------------------------------------------------ */

/** Initial reconnection delay in ms */
const INITIAL_RECONNECT_DELAY_MS = 1000;
/** Maximum reconnection delay cap in ms (30 seconds) */
const MAX_RECONNECT_DELAY_MS = 30_000;
/** Maximum consecutive reconnection attempts before giving up */
const MAX_RECONNECT_ATTEMPTS = 10;

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

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
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);

  /**
   * Builds the WebSocket URL for the given workspace.
   */
  const buildWsUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.hostname}:4000/api/v1/ws/workspace/${workspaceId}?userId=${encodeURIComponent(userId)}&userName=${encodeURIComponent(userName)}`;
  }, [workspaceId, userId, userName]);

  /**
   * Connect with exponential backoff reconnection.
   */
  const connect = useCallback(() => {
    if (unmountedRef.current) return;

    const ws = new WebSocket(buildWsUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      reconnectAttemptRef.current = 0; // Reset attempts on successful connection
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
      scheduleReconnect();
    };

    ws.onerror = () => {
      // onclose will fire after onerror, triggering reconnect
    };
  }, [buildWsUrl]);

  /**
   * Schedules a reconnection attempt with exponential backoff.
   */
  const scheduleReconnect = useCallback(() => {
    if (unmountedRef.current) return;
    if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.warn(`[useWebSocketSync] Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`);
      return;
    }

    const attempt = reconnectAttemptRef.current;
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY_MS * Math.pow(2, attempt),
      MAX_RECONNECT_DELAY_MS
    );

    reconnectAttemptRef.current += 1;

    reconnectTimerRef.current = setTimeout(() => {
      connect();
    }, delay);
  }, [connect]);

  useEffect(() => {
    unmountedRef.current = false;

    if (!enabled) return;

    connect();

    return () => {
      unmountedRef.current = true;

      // Clear any pending reconnection timer
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      // Close the active WebSocket
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled, connect]);

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
