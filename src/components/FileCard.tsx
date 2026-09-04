'use client';

import React, { useState } from 'react';
import {
  Download,
  Share2,
  ArrowRightLeft,
  Info,
  Layers,
  Trash2,
  RotateCcw,
  AlertTriangle,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  FolderArchive,
  FileCode,
  File,
  CheckSquare,
  Square,
} from 'lucide-react';
import { FileMetadata } from '@/shared';
import { formatBytes, formatDate } from '../lib/utils';
import { motion } from 'framer-motion';

interface FileCardProps {
  file: FileMetadata;
  index: number;
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
}

export function FileCard({
  file,
  index,
  viewMode,
  isSelected = false,
  onToggleSelect,
  onDownload,
  onInfo,
  onPreview,
  onShare,
  onMove,
  onRedundancy,
  onDelete,
  onRestore,
  onPurge,
}: FileCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  // MIME Icon Selector
  const getFileIcon = (mime: string) => {
    if (mime.startsWith('image/')) return ImageIcon;
    if (mime.startsWith('video/')) return Film;
    if (mime.startsWith('audio/')) return Music;
    if (mime.includes('pdf') || mime.includes('word') || mime.includes('document')) return FileText;
    if (mime.includes('zip') || mime.includes('tar') || mime.includes('rar') || mime.includes('7z')) return FolderArchive;
    if (mime.includes('javascript') || mime.includes('typescript') || mime.includes('json') || mime.includes('html')) return FileCode;
    return File;
  };

  const IconComponent = getFileIcon(file.mimeType);
  const isDeleted = file.status === 'TRASHED';

  // ─── LIST VIEW MODE ───
  if (viewMode === 'list') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.15, delay: Math.min(index * 0.02, 0.2), ease: [0.23, 1, 0.32, 1] }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`group bg-[#121212] hover:bg-[#181818] border border-[#222] rounded-xl px-4 py-3 flex items-center justify-between gap-3 transition-colors ${
          isSelected ? 'bg-zinc-800/60 border-zinc-600' : ''
        }`}
      >
        {/* Left: Checkbox, Icon, Name */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {onToggleSelect && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(file.id);
              }}
              className="text-zinc-500 hover:text-white transition-colors p-1 rounded min-w-[28px] min-h-[28px] flex items-center justify-center"
              aria-label={`Select ${file.name}`}
            >
              {isSelected ? (
                <CheckSquare className="w-4 h-4 text-white" />
              ) : (
                <Square className="w-4 h-4" />
              )}
            </button>
          )}

          <div
            onClick={() => onPreview && onPreview(file)}
            className="cursor-pointer flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1"
          >
            <div className="w-8 h-8 rounded-lg bg-zinc-800/80 flex items-center justify-center shrink-0 text-zinc-400">
              <IconComponent className="w-4 h-4" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-medium text-zinc-100 truncate group-hover:text-white">
                {file.name}
              </span>
              <span className="sm:hidden text-[10px] text-zinc-500 font-mono mt-0.5">
                {formatBytes(file.size)} · {formatDate(file.createdAt)}
              </span>
            </div>
          </div>
        </div>

        {/* Middle: Size, Date, Chunks */}
        <div className="hidden sm:flex items-center gap-5 text-xs text-zinc-400 tabular-nums shrink-0 font-sans">
          <span>{formatBytes(file.size)}</span>
          <span className="text-zinc-500">{formatDate(file.createdAt)}</span>
          <span className="text-zinc-500">{file.chunks.length} {file.chunks.length === 1 ? 'part' : 'parts'}</span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          {!isDeleted ? (
            <>
              <button
                type="button"
                onClick={() => onDownload(file.id)}
                className="p-1.5 sm:p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors min-w-[32px] sm:min-w-[36px] min-h-[32px] sm:min-h-[36px] flex items-center justify-center"
                title="Download"
                aria-label={`Download ${file.name}`}
              >
                <Download className="w-4 h-4" />
              </button>
              {onShare && (
                <button
                  type="button"
                  onClick={() => onShare(file)}
                  className="p-1.5 sm:p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors min-w-[32px] sm:min-w-[36px] min-h-[32px] sm:min-h-[36px] flex items-center justify-center"
                  title="Share"
                  aria-label={`Share ${file.name}`}
                >
                  <Share2 className="w-4 h-4" />
                </button>
              )}
              {onMove && (
                <button
                  type="button"
                  onClick={() => onMove(file)}
                  className="hidden md:flex p-1.5 sm:p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors min-w-[32px] sm:min-w-[36px] min-h-[32px] sm:min-h-[36px] items-center justify-center"
                  title="Move"
                  aria-label={`Move ${file.name}`}
                >
                  <ArrowRightLeft className="w-4 h-4" />
                </button>
              )}
              {onRedundancy && (
                <button
                  type="button"
                  onClick={() => onRedundancy(file)}
                  className="hidden md:flex p-1.5 sm:p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors min-w-[32px] sm:min-w-[36px] min-h-[32px] sm:min-h-[36px] items-center justify-center"
                  title="Replicas"
                  aria-label={`Replicas for ${file.name}`}
                >
                  <Layers className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onInfo(file)}
                className="hidden sm:flex p-1.5 sm:p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors min-w-[32px] sm:min-w-[36px] min-h-[32px] sm:min-h-[36px] items-center justify-center"
                title="Details"
                aria-label={`Details for ${file.name}`}
              >
                <Info className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(file.id)}
                className="p-1.5 sm:p-2 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-rose-950/20 transition-colors min-w-[32px] sm:min-w-[36px] min-h-[32px] sm:min-h-[36px] flex items-center justify-center"
                title="Move to Trash"
                aria-label={`Delete ${file.name}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              {onRestore && (
                <button
                  type="button"
                  onClick={() => onRestore(file.id)}
                  className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                  title="Restore File"
                  aria-label={`Restore ${file.name}`}
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
              {onPurge && (
                <button
                  type="button"
                  onClick={() => onPurge(file.id)}
                  className="p-2 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-rose-950/20 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                  title="Delete Permanently"
                  aria-label={`Delete ${file.name} permanently`}
                >
                  <AlertTriangle className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      </motion.div>
    );
  }

  // ─── GRID VIEW MODE ───
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.15, delay: Math.min(index * 0.02, 0.2), ease: [0.23, 1, 0.32, 1] }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group bg-[#141414] hover:bg-[#1a1a1a] border border-[#222] hover:border-[#333] rounded-2xl p-4 flex flex-col justify-between h-48 relative transition-all shadow-sm ${
        isSelected ? 'bg-zinc-800/60 border-zinc-500' : ''
      }`}
    >
      {/* Top Header: Checkbox & Quick Actions */}
      <div className="flex items-start justify-between gap-2">
        {onToggleSelect ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(file.id);
            }}
            className="text-zinc-500 hover:text-white transition-colors p-1 rounded min-w-[28px] min-h-[28px] flex items-center justify-center"
            aria-label={`Select ${file.name}`}
          >
            {isSelected ? (
              <CheckSquare className="w-4 h-4 text-white" />
            ) : (
              <Square className="w-4 h-4 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" />
            )}
          </button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          {!isDeleted ? (
            <>
              <button
                type="button"
                onClick={() => onDownload(file.id)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                title="Download"
                aria-label={`Download ${file.name}`}
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              {onShare && (
                <button
                  type="button"
                  onClick={() => onShare(file)}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                  title="Share"
                  aria-label={`Share ${file.name}`}
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onInfo(file)}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                title="Details"
                aria-label={`Details for ${file.name}`}
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(file.id)}
                className="p-1.5 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-rose-950/20 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                title="Delete"
                aria-label={`Delete ${file.name}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              {onRestore && (
                <button
                  type="button"
                  onClick={() => onRestore(file.id)}
                  className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors min-w-[32px] min-h-[32px] flex items-center justify-center"
                  title="Restore"
                  aria-label={`Restore ${file.name}`}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Middle Body: MIME Icon & Preview trigger */}
      <div
        onClick={() => onPreview && onPreview(file)}
        className="cursor-pointer flex flex-col items-center justify-center my-2 space-y-1 text-center"
      >
        <div className="w-12 h-12 rounded-2xl bg-zinc-800/60 border border-zinc-700/50 flex items-center justify-center text-zinc-400 group-hover:text-zinc-100 group-hover:border-zinc-500 transition-all">
          <IconComponent className="w-6 h-6" />
        </div>
      </div>

      {/* Bottom Footer: Filename & Metadata */}
      <div className="space-y-1">
        <div
          onClick={() => onPreview && onPreview(file)}
          className="cursor-pointer text-xs font-medium text-zinc-200 truncate hover:text-white transition-colors"
          title={file.name}
        >
          {file.name}
        </div>
        <div className="flex items-center justify-between text-[11px] text-zinc-500 tabular-nums">
          <span>{formatBytes(file.size)}</span>
          <span>{file.chunks.length} {file.chunks.length === 1 ? 'part' : 'parts'}</span>
        </div>
      </div>
    </motion.div>
  );
}
