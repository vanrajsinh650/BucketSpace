'use client';

import React, { useState } from 'react';
import {
  Download,
  File,
  FileText,
  Film,
  Image as ImageIcon,
  Info,
  MoreVertical,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  FileArchive,
} from 'lucide-react';
import { FileMetadata } from '@bucketspace/shared';

interface FileCardProps {
  file: FileMetadata;
  viewMode: 'grid' | 'list';
  onDownload: (fileId: string) => void;
  onInfo: (file: FileMetadata) => void;
  onDelete: (fileId: string) => void;
  onRestore?: (fileId: string) => void;
  onPurge?: (fileId: string) => void;
  onVerify?: (fileId: string) => void;
}

export function FileCard({
  file,
  viewMode,
  onDownload,
  onInfo,
  onDelete,
  onRestore,
  onPurge,
  onVerify,
}: FileCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string, filename: string) => {
    if (mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(filename)) {
      return <ImageIcon className="w-6 h-6 text-cyan-400" />;
    }
    if (mimeType.startsWith('video/') || /\.(mp4|mkv|mov|avi|webm)$/i.test(filename)) {
      return <Film className="w-6 h-6 text-purple-400" />;
    }
    if (mimeType.startsWith('text/') || mimeType.includes('pdf') || /\.(pdf|doc|docx|txt|md|csv)$/i.test(filename)) {
      return <FileText className="w-6 h-6 text-emerald-400" />;
    }
    if (/\.(zip|tar|gz|rar|7z)$/i.test(filename)) {
      return <FileArchive className="w-6 h-6 text-amber-400" />;
    }
    return <File className="w-6 h-6 text-slate-400" />;
  };

  const isTrashed = file.status === 'TRASHED';

  if (viewMode === 'list') {
    return (
      <div className="glass-panel glass-panel-hover rounded-xl p-3.5 flex items-center justify-between gap-4 transition-all group">
        <div className="flex items-center gap-3.5 min-w-0 flex-1">
          <div className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 shrink-0">
            {getFileIcon(file.mimeType, file.name)}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-medium text-sm text-slate-200 truncate group-hover:text-white transition-colors">
              {file.name}
            </h4>
            <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
              <span>{formatSize(file.size)}</span>
              <span>•</span>
              <span>{new Date(file.createdAt).toLocaleDateString()}</span>
              <span>•</span>
              <span className="font-mono text-[10px] text-slate-500 truncate max-w-[120px]">
                {file.wholeFileHash.substring(0, 12)}...
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {!isTrashed ? (
            <>
              <button
                onClick={() => onDownload(file.id)}
                title="Download & Verify"
                className="p-2 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800/80 transition-colors"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => onInfo(file)}
                title="File Details & SHA-256 Digest"
                className="p-2 rounded-lg text-slate-400 hover:text-purple-400 hover:bg-slate-800/80 transition-colors"
              >
                <Info className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(file.id)}
                title="Move to Trash"
                className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              {onRestore && (
                <button
                  onClick={() => onRestore(file.id)}
                  title="Restore File"
                  className="p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800/80 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
              {onPurge && (
                <button
                  onClick={() => onPurge(file.id)}
                  title="Permanently Purge"
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel glass-panel-hover rounded-2xl p-4 flex flex-col justify-between h-48 transition-all group relative">
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800">
            {getFileIcon(file.mimeType, file.name)}
          </div>
          <button
            onClick={() => onInfo(file)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>

        <h4 className="font-semibold text-sm text-slate-200 truncate group-hover:text-white transition-colors">
          {file.name}
        </h4>
        <p className="text-xs text-slate-400 mt-1">{formatSize(file.size)}</p>
      </div>

      <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
        <span className="text-[11px] font-mono text-slate-500">
          {new Date(file.createdAt).toLocaleDateString()}
        </span>

        <div className="flex items-center gap-1">
          {!isTrashed ? (
            <>
              <button
                onClick={() => onDownload(file.id)}
                className="px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 text-xs font-medium flex items-center gap-1.5 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Get</span>
              </button>
              <button
                onClick={() => onDelete(file.id)}
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800/80 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              {onRestore && (
                <button
                  onClick={() => onRestore(file.id)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-xs font-medium flex items-center gap-1 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore</span>
                </button>
              )}
              {onPurge && (
                <button
                  onClick={() => onPurge(file.id)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800/80 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
