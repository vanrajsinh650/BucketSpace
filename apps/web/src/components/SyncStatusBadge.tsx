'use client';

import React from 'react';
import { FolderSync, RefreshCw } from 'lucide-react';

export interface SyncStatusBadgeProps {
  onClick: () => void;
  status?: 'SYNCED' | 'SYNCING' | 'PAUSED' | 'CONFLICT' | 'FAILED';
  pendingCount?: number;
}

export const SyncStatusBadge: React.FC<SyncStatusBadgeProps> = ({
  onClick,
  status = 'SYNCED',
  pendingCount = 0,
}) => {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 bg-[#121215] hover:bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] rounded-full text-xs font-mono transition-all duration-150 group"
      title="Local Folder Auto-Sync Status"
    >
      {status === 'SYNCING' ? (
        <RefreshCw className="w-3 h-3 text-blue-400 animate-spin" />
      ) : status === 'PAUSED' ? (
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
      ) : status === 'CONFLICT' ? (
        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
      )}
      <span className="text-[#a1a1aa] group-hover:text-white text-[11px]">
        {status === 'SYNCING'
          ? `Syncing (${pendingCount})`
          : status === 'PAUSED'
          ? 'Sync Paused'
          : status === 'CONFLICT'
          ? 'Sync Conflict'
          : 'Folder Synced'}
      </span>
    </button>
  );
};
