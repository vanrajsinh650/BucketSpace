'use client';

import React from 'react';
import {
  ArrowRightLeft,
  CheckSquare,
  Download,
  Eye,
  File,
  FileText,
  Film,
  Image as ImageIcon,
  Info,
  RotateCcw,
  ShieldCheck,
  Square,
  Trash2,
  FileArchive,
  Share2,
} from 'lucide-react';
import { FileMetadata } from '@bucketspace/shared';

interface FileCardProps {
  file: FileMetadata;
  viewMode: 'grid' | 'list';
  isSelected?: boolean;
  onToggleSelect?: (fileId: string) => void;
  onDownload: (fileId: string) => void;
  onInfo: (file: FileMetadata) => void;
  onPreview?: (file: FileMetadata) => void;
  onShare?: (file: FileMetadata) => void;
  onMove?: (file: FileMetadata) => void;
  onRedundancy?: (file: FileMetadata) => void;
  onDelete: (fileId: string) => void;
  onRestore?: (fileId: string) => void;
  onPurge?: (fileId: string) => void;
  onVerify?: (fileId: string) => void;
}

/** Derive the primary provider ID from a file's first chunk */
const getFileProviderId = (file: FileMetadata): string | null => {
  return file.chunks?.[0]?.providerRef?.providerId ?? null;
};

export function FileCard({
  file,
  viewMode,
  isSelected = false,
  onToggleSelect,
  onMove,
  onDownload,
  onInfo,
  onPreview,
  onShare,
  onRedundancy,
  onDelete,
  onRestore,
  onPurge,
}: FileCardProps) {
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string, filename: string) => {
    if (mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(filename)) {
      return <ImageIcon className="w-5 h-5 text-zinc-300" />;
    }
    if (mimeType.startsWith('video/') || /\.(mp4|mkv|mov|avi|webm)$/i.test(filename)) {
      return <Film className="w-5 h-5 text-zinc-300" />;
    }
    if (mimeType.startsWith('text/') || mimeType.includes('pdf') || /\.(pdf|doc|docx|txt|md|csv)$/i.test(filename)) {
      return <FileText className="w-5 h-5 text-zinc-300" />;
    }
    if (/\.(zip|tar|gz|rar|7z)$/i.test(filename)) {
      return <FileArchive className="w-5 h-5 text-zinc-300" />;
    }
    return <File className="w-5 h-5 text-zinc-400" />;
  };

  const isTrashed = file.status === 'TRASHED';

  if (viewMode === 'list') {
    return (
      <div
        className={`rounded-xl p-3 sm:p-3.5 flex items-center justify-between gap-3 transition-all border ${
          isSelected
            ? 'bg-zinc-900 border-white text-white'
            : 'bg-zinc-950 border-zinc-850 hover:border-zinc-700 text-zinc-300'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {onToggleSelect && !isTrashed && (
            <button
              onClick={() => onToggleSelect(file.id)}
              className="p-1 rounded text-zinc-500 hover:text-white focus:outline-none transition-colors"
              title={isSelected ? 'Deselect file' : 'Select file'}
            >
              {isSelected ? (
                <CheckSquare className="w-4 h-4 text-white" />
              ) : (
                <Square className="w-4 h-4 text-zinc-600 hover:text-zinc-400" />
              )}
            </button>
          )}
          <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 shrink-0">
            {getFileIcon(file.mimeType, file.name)}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-medium text-xs sm:text-sm text-zinc-200 truncate group-hover:text-white transition-colors">
              {file.name}
            </h4>
            <div className="flex items-center gap-2.5 text-[11px] text-zinc-500 mt-0.5 font-mono">
              <span>{formatSize(file.size)}</span>
              <span>•</span>
              <span>{new Date(file.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {!isTrashed ? (
            <>
              {onPreview && (
                <button
                  onClick={() => onPreview(file)}
                  title="View File"
                  className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => onDownload(file.id)}
                title="Download"
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => onInfo(file)}
                title="Details"
                className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors hidden sm:block"
              >
                <Info className="w-4 h-4" />
              </button>
              {onShare && (
                <button
                  onClick={() => onShare(file)}
                  title="Share"
                  className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              )}
              {onRedundancy && (
                <button
                  onClick={() => onRedundancy(file)}
                  title="Redundancy"
                  className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors hidden sm:block"
                >
                  <ShieldCheck className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => onDelete(file.id)}
                title="Move to Trash"
                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors"
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
                  className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
              {onPurge && (
                <button
                  onClick={() => onPurge(file.id)}
                  title="Permanently Purge"
                  className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
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
    <div
      className={`rounded-2xl p-4 flex flex-col justify-between h-48 transition-all border relative ${
        isSelected
          ? 'bg-zinc-900 border-white text-white shadow-sm'
          : 'bg-zinc-950 border-zinc-800/90 hover:border-zinc-700 text-zinc-300'
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            {onToggleSelect && !isTrashed && (
              <button
                onClick={() => onToggleSelect(file.id)}
                className="p-1 rounded text-zinc-500 hover:text-white focus:outline-none transition-colors"
                title={isSelected ? 'Deselect file' : 'Select file'}
              >
                {isSelected ? (
                  <CheckSquare className="w-4 h-4 text-white" />
                ) : (
                  <Square className="w-4 h-4 text-zinc-600 hover:text-zinc-400" />
                )}
              </button>
            )}
            <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800">
              {getFileIcon(file.mimeType, file.name)}
            </div>
          </div>
          <button
            onClick={() => onInfo(file)}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition-colors"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>

        <h4 className="font-medium text-xs sm:text-sm text-zinc-200 truncate hover:text-white transition-colors">
          {file.name}
        </h4>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-zinc-500 font-mono">{formatSize(file.size)}</span>
          {getFileProviderId(file) && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
              {getFileProviderId(file)}
            </span>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between">
        <span className="text-[10px] font-mono text-zinc-500">
          {new Date(file.createdAt).toLocaleDateString()}
        </span>

        <div className="flex items-center gap-1">
          {!isTrashed ? (
            <>
              {onPreview && (
                <button
                  onClick={() => onPreview(file)}
                  className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-800 text-xs font-medium flex items-center gap-1 transition-all"
                  title="View File"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View</span>
                </button>
              )}
              <button
                onClick={() => onDownload(file.id)}
                className="px-2.5 py-1 rounded-lg bg-white text-black hover:bg-zinc-200 text-xs font-semibold flex items-center gap-1 transition-all"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Get</span>
              </button>
              {onRedundancy && (
                <button
                  onClick={() => onRedundancy(file)}
                  title="Redundancy"
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                </button>
              )}
              {onMove && (
                <button
                  onClick={() => onMove(file)}
                  title="Move"
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => onDelete(file.id)}
                className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              {onRestore && (
                <button
                  onClick={() => onRestore(file.id)}
                  className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white text-xs font-medium flex items-center gap-1 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore</span>
                </button>
              )}
              {onPurge && (
                <button
                  onClick={() => onPurge(file.id)}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors"
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
