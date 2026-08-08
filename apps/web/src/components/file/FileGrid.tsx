'use client';

import React, { useState } from 'react';
import { FileText, Image, Video, Music, HardDrive, Search, UploadCloud, CheckCircle2, Inbox, Users, Play, Shield, Cloud } from 'lucide-react';
import { HLSVideoPlayer } from '../media/HLSVideoPlayer';
import { useWebSocketSync } from '../../hooks/useWebSocketSync';
import { ProviderType } from '@bucketspace/shared';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface DriveFileItem {
  id: string;
  filename: string;
  sizeBytes: number;
  mimeType: string;
  provider: ProviderType;
  targetBucket: string;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/*  Mock Files (Telegram, GCP, Azure, S3)                             */
/* ------------------------------------------------------------------ */

const MOCK_FILES: DriveFileItem[] = [
  {
    id: 'f1-telegram-001',
    filename: 'architectural_render_4k.png',
    sizeBytes: 15_482_910,
    mimeType: 'image/png',
    provider: ProviderType.TELEGRAM_DRIVE,
    targetBucket: '@studio_asset_vault',
    createdAt: '2026-08-08T10:00:00Z',
  },
  {
    id: 'f2-telegram-002',
    filename: 'cinematic_trailer_final.mp4',
    sizeBytes: 450_920_104,
    mimeType: 'video/mp4',
    provider: ProviderType.TELEGRAM_DRIVE,
    targetBucket: '@studio_asset_vault',
    createdAt: '2026-08-08T09:30:00Z',
  },
  {
    id: 'f3-gcp-003',
    filename: 'bigdata_analytics_model.parquet',
    sizeBytes: 124_210_924,
    mimeType: 'application/octet-stream',
    provider: ProviderType.GCP_STORAGE,
    targetBucket: 'bucketspace-gcp-prod',
    createdAt: '2026-08-08T08:15:00Z',
  },
  {
    id: 'f4-azure-004',
    filename: 'enterprise_backup_archive.tar.gz',
    sizeBytes: 890_410_000,
    mimeType: 'application/x-tar',
    provider: ProviderType.AZURE_BLOB,
    targetBucket: 'bucketspace-azure-container',
    createdAt: '2026-08-08T07:45:00Z',
  },
  {
    id: 'f5-s3-005',
    filename: 'hls_nature_documentary.mp4',
    sizeBytes: 320_500_000,
    mimeType: 'video/mp4',
    provider: ProviderType.AWS_S3,
    targetBucket: 'bucketspace-s3-media',
    createdAt: '2026-08-08T06:20:00Z',
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  const KB = 1024;
  const MB = KB * 1024;
  const GB = MB * 1024;
  const TB = GB * 1024;

  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
  if (bytes < GB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes < TB) return `${(bytes / GB).toFixed(2)} GB`;
  return `${(bytes / TB).toFixed(2)} TB`;
}

function getFileIcon(mimeType: string): React.ReactNode {
  if (mimeType.startsWith('image/')) return <Image className="h-5 w-5 text-cyan-400" />;
  if (mimeType.startsWith('video/')) return <Video className="h-5 w-5 text-indigo-400" />;
  if (mimeType.startsWith('audio/')) return <Music className="h-5 w-5 text-emerald-400" />;
  return <FileText className="h-5 w-5 text-slate-400" />;
}

function getProviderBadge(provider: ProviderType): { label: string; color: string } {
  switch (provider) {
    case ProviderType.GCP_STORAGE:
      return { label: 'GCP Storage', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
    case ProviderType.AZURE_BLOB:
      return { label: 'Azure Blob', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' };
    case ProviderType.AWS_S3:
      return { label: 'AWS S3 / R2', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
    case ProviderType.TELEGRAM_DRIVE:
    default:
      return { label: 'Telegram Drive', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' };
  }
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const FileGrid: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [activeVideoFile, setActiveVideoFile] = useState<{ id: string; filename: string } | null>(null);

  // WebSocket sync hook for presence and real-time collaborative cursors
  const { isConnected, activeUsers, sendFileSelection } = useWebSocketSync({
    workspaceId: 'main-workspace',
  });

  const filteredFiles = MOCK_FILES.filter((file) =>
    file.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectFile = (fileId: string) => {
    setSelectedFileId(fileId);
    sendFileSelection(fileId);
  };

  return (
    <div className="flex flex-col gap-6 p-8 max-w-7xl mx-auto">
      {/* Workspace Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-indigo-400 shadow-inner">
            <HardDrive className="h-7 w-7" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-100">Multi-Cloud Storage Drive</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                Phase 2 Engine Active
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
              <span>Universal Workspace Bucket Drive</span>
              <span>•</span>
              <span className="flex items-center gap-1 text-slate-300">
                <Shield className="w-3.5 h-3.5 text-indigo-400" /> AES-256 Zero-Trust
              </span>
            </p>
          </div>
        </div>

        {/* Real-time Presence & Actions */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
            <Users className={`h-4 w-4 ${isConnected ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span className="text-slate-300 font-medium">{activeUsers.length + 1} Active</span>
            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          </div>

          <button
            onClick={() => alert('Initiating Multi-Cloud Chunk Stream Upload Session...')}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl shadow-lg shadow-indigo-600/25 transition-all duration-150 active:scale-95 text-sm"
          >
            <UploadCloud className="h-4 w-4" />
            Upload Asset
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search files across Telegram, GCP Storage, Azure Blob & AWS S3..."
          className="w-full pl-12 pr-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-150 text-sm"
        />
      </div>

      {/* File Grid */}
      {filteredFiles.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 glass-panel rounded-2xl border border-slate-800">
          <Inbox className="h-12 w-12 text-slate-600 mb-4" />
          <p className="text-slate-400 text-lg font-medium">No files found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-5">
          {filteredFiles.map((file) => {
            const isSelected = selectedFileId === file.id;
            const isVideo = file.mimeType.startsWith('video/');
            const providerBadge = getProviderBadge(file.provider);

            return (
              <div
                key={file.id}
                onClick={() => handleSelectFile(file.id)}
                className={`group glass-panel p-5 rounded-2xl cursor-pointer transition-all duration-200 relative border flex flex-col justify-between space-y-4 ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-500/10 ring-2 ring-indigo-500/40 shadow-xl'
                    : 'border-slate-800/80 bg-slate-900/40 hover:border-slate-700 hover:bg-slate-800/50'
                }`}
              >
                {/* Header Badge */}
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-mono px-2.5 py-0.5 rounded-full border ${providerBadge.color}`}>
                    {providerBadge.label}
                  </span>
                  {isSelected && <CheckCircle2 className="h-5 w-5 text-indigo-400" />}
                </div>

                {/* Content Icon & Name */}
                <div className="flex items-start gap-3">
                  <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 shrink-0">
                    {getFileIcon(file.mimeType)}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span
                      className="truncate text-sm font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors"
                      title={file.filename}
                    >
                      {file.filename}
                    </span>
                    <span className="text-xs text-slate-400 mt-1">
                      {formatFileSize(file.sizeBytes)} • {file.targetBucket}
                    </span>
                  </div>
                </div>

                {/* Action Footer (HLS Video Preview trigger if video) */}
                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    {new Date(file.createdAt).toLocaleDateString()}
                  </span>

                  {isVideo && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveVideoFile({ id: file.id, filename: file.filename });
                      }}
                      className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>HLS Stream</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* HLS Video Player Modal */}
      {activeVideoFile && (
        <HLSVideoPlayer
          fileId={activeVideoFile.id}
          filename={activeVideoFile.filename}
          onClose={() => setActiveVideoFile(null)}
        />
      )}
    </div>
  );
};
