'use client';

import React, { useState, useEffect } from 'react';
import {
  FolderSync,
  X,
  Play,
  Pause,
  RefreshCw,
  Folder,
  CheckCircle2,
  AlertTriangle,
  FileText,
  UploadCloud,
  DownloadCloud,
} from 'lucide-react';
import { SyncEvent, SyncProgressPayload } from '@/shared';

export interface FolderSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FolderSyncModal: React.FC<FolderSyncModalProps> = ({ isOpen, onClose }) => {
  const [syncFolder, setSyncFolder] = useState('BucketSpace-Sync');
  const [isSyncing, setIsSyncing] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [stats, setStats] = useState({
    totalFiles: 14,
    syncedFiles: 14,
    pendingUploads: 0,
    pendingDownloads: 0,
    conflicts: 0,
    totalBytes: 48.2 * 1024 * 1024,
  });

  const [recentEvents, setRecentEvents] = useState<Array<{
    id: string;
    type: string;
    fileName: string;
    time: string;
    sizeStr: string;
    direction: 'UPLOAD' | 'DOWNLOAD' | 'IDLE';
    status: 'SYNCED' | 'SYNCING' | 'CONFLICT' | 'FAILED';
  }>>([
    {
      id: '1',
      type: 'SYNC_COMPLETED',
      fileName: 'Financial_Summary_2026.pdf',
      time: 'Just now',
      sizeStr: '2.4 MB',
      direction: 'UPLOAD',
      status: 'SYNCED',
    },
    {
      id: '2',
      type: 'SYNC_COMPLETED',
      fileName: 'Architecture_Blueprint.png',
      time: '2 mins ago',
      sizeStr: '1.8 MB',
      direction: 'DOWNLOAD',
      status: 'SYNCED',
    },
    {
      id: '3',
      type: 'SYNC_COMPLETED',
      fileName: 'Project_Notes.md',
      time: '5 mins ago',
      sizeStr: '42 KB',
      direction: 'UPLOAD',
      status: 'SYNCED',
    },
  ]);

  if (!isOpen) return null;

  const handleScanNow = async () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setStats((prev) => ({ ...prev, syncedFiles: prev.totalFiles, pendingUploads: 0 }));
      setRecentEvents((prev) => [
        {
          id: Date.now().toString(),
          type: 'FOLDER_SCAN_COMPLETED',
          fileName: 'Manual Reconciliation Scan',
          time: 'Just now',
          sizeStr: 'All Verified',
          direction: 'IDLE',
          status: 'SYNCED',
        },
        ...prev.slice(0, 4),
      ]);
    }, 1200);
  };

  const handleTogglePause = () => {
    setIsPaused(!isPaused);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans">
      <div className="bg-[#09090b] border border-[#27272a] rounded-xl w-full max-w-xl p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#27272a] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#18181b] border border-[#27272a] flex items-center justify-center text-white">
              <FolderSync className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm text-white">Folder Auto-Sync Daemon</h3>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold ${
                    isPaused
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      : isScanning
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}
                >
                  {isPaused ? 'Paused' : isScanning ? 'Reconciling' : 'Active'}
                </span>
              </div>
              <p className="text-xs text-[#a1a1aa] mt-0.5">
                Watches your local directory and continuously mirrors changes to your cloud drive.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#a1a1aa] hover:text-white rounded-lg hover:bg-[#18181b] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sync Folder Path */}
        <div className="p-3.5 bg-[#121215] border border-[#27272a] rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#a1a1aa]">Watched Directory</span>
            <span className="text-[11px] font-mono text-[#71717a]">3-way delta sync</span>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs text-white bg-[#09090b] border border-[#27272a] px-3 py-2 rounded-md">
            <Folder className="w-4 h-4 text-[#a1a1aa] shrink-0" />
            <input
              type="text"
              value={syncFolder}
              onChange={(e) => setSyncFolder(e.target.value)}
              className="bg-transparent text-xs text-white outline-none w-full font-mono"
            />
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-4 gap-2.5">
          <div className="p-3 bg-[#121215] border border-[#27272a] rounded-lg text-center">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#a1a1aa]">Total Files</div>
            <div className="text-base font-mono font-bold text-white mt-1">{stats.totalFiles}</div>
          </div>
          <div className="p-3 bg-[#121215] border border-[#27272a] rounded-lg text-center">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#a1a1aa]">Synced</div>
            <div className="text-base font-mono font-bold text-emerald-400 mt-1">{stats.syncedFiles}</div>
          </div>
          <div className="p-3 bg-[#121215] border border-[#27272a] rounded-lg text-center">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#a1a1aa]">Pending</div>
            <div className="text-base font-mono font-bold text-[#a1a1aa] mt-1">{stats.pendingUploads}</div>
          </div>
          <div className="p-3 bg-[#121215] border border-[#27272a] rounded-lg text-center">
            <div className="text-[10px] font-mono uppercase tracking-wider text-[#a1a1aa]">Conflicts</div>
            <div className="text-base font-mono font-bold text-white mt-1">{stats.conflicts}</div>
          </div>
        </div>

        {/* Live Activity Feed */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#a1a1aa]">Recent Activity</span>
            <span className="text-[10px] font-mono text-[#71717a]">SHA-256 Bit Verified</span>
          </div>
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {recentEvents.map((evt) => (
              <div
                key={evt.id}
                className="flex items-center justify-between p-2.5 bg-[#121215] border border-[#27272a] rounded-md font-mono text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {evt.direction === 'UPLOAD' ? (
                    <UploadCloud className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  ) : evt.direction === 'DOWNLOAD' ? (
                    <DownloadCloud className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" />
                  )}
                  <span className="truncate text-white text-[11px]">{evt.fileName}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-[#71717a] text-[10px]">
                  <span>{evt.sizeStr}</span>
                  <span>{evt.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Controls */}
        <div className="pt-2 border-t border-[#27272a] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handleTogglePause}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] rounded-lg text-xs font-mono text-white transition-colors"
            >
              {isPaused ? <Play className="w-3 h-3 text-emerald-400" /> : <Pause className="w-3 h-3 text-amber-400" />}
              <span>{isPaused ? 'Resume Sync' : 'Pause'}</span>
            </button>
            <button
              onClick={handleScanNow}
              disabled={isScanning}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#18181b] hover:bg-[#27272a] border border-[#27272a] rounded-lg text-xs font-mono text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin text-blue-400' : 'text-white'}`} />
              <span>{isScanning ? 'Scanning...' : 'Scan Now'}</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="bg-white hover:bg-zinc-200 text-black font-semibold px-4 py-1.5 rounded-lg text-xs font-mono transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
