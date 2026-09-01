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

  // Format file size
  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  // Format timestamp
  const formatDate = (timestamp: number | Date): string => {
    const d = new Date(timestamp);
    return d.toISOString().split('T')[0];
  };

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
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98 }}
        transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.3), ease: [0.23, 1, 0.32, 1] }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`group bg-black hover:bg-[#0a0a0a] px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors ${
          isSelected ? 'bg-[#121212]' : ''
        }`}
      >
        {/* Left: Checkbox, Icon, Name */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {onToggleSelect && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(file.id);
              }}
              className="text-[#555] hover:text-white transition-colors"
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
            className="cursor-pointer flex items-center gap-2.5 min-w-0 flex-1"
          >
            <IconComponent className="w-4 h-4 text-[#888] shrink-0" />
            <span className="font-mono text-xs text-white truncate group-hover:text-white">
              {file.name}
            </span>
          </div>
        </div>

        {/* Middle: Size, Date, Chunks */}
        <div className="hidden sm:flex items-center gap-4 text-[11px] font-mono text-[#666] tabular-nums shrink-0">
          <span>{formatSize(file.size)}</span>
          <span>{formatDate(file.createdAt)}</span>
          <span className="text-[#555]">{file.chunks.length} chunks</span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {!isDeleted ? (
            <>
              <button
                onClick={() => onDownload(file.id)}
                className="p-1.5 text-[#666] hover:text-white rounded hover:bg-[#181818] transition-colors btn-press"
                title="Download"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              {onShare && (
                <button
                  onClick={() => onShare(file)}
                  className="p-1.5 text-[#666] hover:text-white rounded hover:bg-[#181818] transition-colors btn-press"
                  title="Share"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              )}
              {onMove && (
                <button
                  onClick={() => onMove(file)}
                  className="p-1.5 text-[#666] hover:text-white rounded hover:bg-[#181818] transition-colors btn-press"
                  title="Move"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                </button>
              )}
              {onRedundancy && (
                <button
                  onClick={() => onRedundancy(file)}
                  className="p-1.5 text-[#666] hover:text-white rounded hover:bg-[#181818] transition-colors btn-press"
                  title="Replication"
                >
                  <Layers className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => onInfo(file)}
                className="p-1.5 text-[#666] hover:text-white rounded hover:bg-[#181818] transition-colors btn-press"
                title="Inspect Metadata"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDelete(file.id)}
                className="p-1.5 text-[#666] hover:text-[#ff3333] rounded hover:bg-[#181818] transition-colors btn-press"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              {onRestore && (
                <button
                  onClick={() => onRestore(file.id)}
                  className="p-1.5 text-[#666] hover:text-white rounded hover:bg-[#181818] transition-colors btn-press"
                  title="Restore File"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
              {onPurge && (
                <button
                  onClick={() => onPurge(file.id)}
                  className="p-1.5 text-[#666] hover:text-[#ff3333] rounded hover:bg-[#181818] transition-colors btn-press"
                  title="Purge Permanently"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
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
      transition={{ duration: 0.2, delay: Math.min(index * 0.03, 0.3), ease: [0.23, 1, 0.32, 1] }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`group bg-black hover:bg-[#0a0a0a] p-4 flex flex-col justify-between h-44 relative transition-colors ${
        isSelected ? 'bg-[#121212]' : ''
      }`}
    >
      {/* Top Header: Checkbox & Quick Actions */}
      <div className="flex items-start justify-between gap-2">
        {onToggleSelect ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect(file.id);
            }}
            className="text-[#555] hover:text-white transition-colors"
          >
            {isSelected ? (
              <CheckSquare className="w-4 h-4 text-white" />
            ) : (
              <Square className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </button>
        ) : (
          <div />
        )}

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {!isDeleted ? (
            <>
              <button
                onClick={() => onDownload(file.id)}
                className="p-1 text-[#666] hover:text-white rounded hover:bg-[#181818] transition-colors btn-press"
                title="Download"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              {onShare && (
                <button
                  onClick={() => onShare(file)}
                  className="p-1 text-[#666] hover:text-white rounded hover:bg-[#181818] transition-colors btn-press"
                  title="Share"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => onInfo(file)}
                className="p-1 text-[#666] hover:text-white rounded hover:bg-[#181818] transition-colors btn-press"
                title="Info"
              >
                <Info className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDelete(file.id)}
                className="p-1 text-[#666] hover:text-[#ff3333] rounded hover:bg-[#181818] transition-colors btn-press"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              {onRestore && (
                <button
                  onClick={() => onRestore(file.id)}
                  className="p-1 text-[#666] hover:text-white rounded hover:bg-[#181818] transition-colors btn-press"
                  title="Restore"
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
        <IconComponent className="w-8 h-8 text-[#666] group-hover:text-white transition-colors" />
      </div>

      {/* Bottom Footer: Filename & Metadata */}
      <div className="space-y-1">
        <div
          onClick={() => onPreview && onPreview(file)}
          className="cursor-pointer font-mono text-xs font-medium text-white truncate hover:underline"
          title={file.name}
        >
          {file.name}
        </div>
        <div className="flex items-center justify-between text-[10px] font-mono text-[#666] tabular-nums">
          <span>{formatSize(file.size)}</span>
          <span className="text-[#555]">{file.chunks.length} chunks</span>
        </div>
      </div>
    </motion.div>
  );
}
