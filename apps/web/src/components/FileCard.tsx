'use client';

import React, { useState } from 'react';
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
import { motion } from 'framer-motion';

interface FileCardProps {
  file: FileMetadata;
  index?: number;
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
  index = 0,
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
  const [isHovered, setIsHovered] = useState(false);

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const getFileIcon = (mimeType: string, filename: string) => {
    if (mimeType.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(filename)) {
      return <ImageIcon className="w-5 h-5 text-[#ccc]" />;
    }
    if (mimeType.startsWith('video/') || /\.(mp4|mkv|mov|avi|webm)$/i.test(filename)) {
      return <Film className="w-5 h-5 text-[#ccc]" />;
    }
    if (mimeType.startsWith('text/') || mimeType.includes('pdf') || /\.(pdf|doc|docx|txt|md|csv)$/i.test(filename)) {
      return <FileText className="w-5 h-5 text-[#ccc]" />;
    }
    if (/\.(zip|tar|gz|rar|7z)$/i.test(filename)) {
      return <FileArchive className="w-5 h-5 text-[#ccc]" />;
    }
    return <File className="w-5 h-5 text-[#999]" />;
  };

  const isTrashed = file.status === 'TRASHED';

  // Stagger entrance based on index
  const animationVariants = {
    hidden: { opacity: 0, y: 12, scale: 0.98 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        delay: index * 0.04,
        duration: 0.4,
        ease: [0.23, 1, 0.32, 1] as const, // out-strong
      }
    },
    exit: { opacity: 0, scale: 0.95, transition: { duration: 0.2 } },
    hover: { scale: 0.99, transition: { duration: 0.15 } },
    tap: { scale: 0.97, transition: { duration: 0.1 } }
  };

  if (viewMode === 'list') {
    return (
      <motion.div
        layout
        initial="hidden"
        animate="visible"
        exit="exit"
        whileHover="hover"
        whileTap="tap"
        variants={animationVariants}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        className={`relative rounded-xl p-3 sm:p-3.5 flex items-center justify-between gap-3 border ${
          isSelected
            ? 'bg-[#111] border-white text-white z-10'
            : 'bg-black border-[#222] text-[#ccc]'
        }`}
      >
        {/* Animated background glow on hover */}
        {isHovered && !isSelected && (
          <motion.div
            layoutId="file-hover-bg"
            className="absolute inset-0 bg-[#111]/50 rounded-xl -z-10"
            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
          />
        )}
        
        <div className="flex items-center gap-3 min-w-0 flex-1 relative z-10">
          {onToggleSelect && !isTrashed && (
            <button
              onClick={(e) => { e.stopPropagation(); onToggleSelect(file.id); }}
              className="p-1 rounded text-[#666] hover:text-white focus:outline-none transition-colors"
              title={isSelected ? 'Deselect file' : 'Select file'}
            >
              {isSelected ? (
                <motion.div initial={{scale:0.5}} animate={{scale:1}}>
                  <CheckSquare className="w-4 h-4 text-white" />
                </motion.div>
              ) : (
                <Square className="w-4 h-4 text-[#444] hover:text-[#999]" />
              )}
            </button>
          )}
          <div className="p-2 rounded-lg bg-[#111] border border-[#222] shrink-0">
            {getFileIcon(file.mimeType, file.name)}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-medium text-xs sm:text-sm text-white truncate group-hover:text-white transition-colors">
              {file.name}
            </h4>
            <div className="flex items-center gap-2.5 text-[11px] text-[#666] mt-0.5 font-mono">
              <span>{formatSize(file.size)}</span>
              <span>•</span>
              <span>{new Date(file.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0 relative z-10">
          {!isTrashed ? (
            <>
              {onPreview && (
                <button
                  onClick={(e) => { e.stopPropagation(); onPreview(file); }}
                  title="View File"
                  className="p-2 rounded-lg text-[#999] hover:text-white hover:bg-[#222] transition-colors"
                >
                  <Eye className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onDownload(file.id); }}
                title="Download"
                className="p-2 rounded-lg text-[#999] hover:text-white hover:bg-[#222] transition-colors"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onInfo(file); }}
                title="Details"
                className="p-2 rounded-lg text-[#999] hover:text-white hover:bg-[#222] transition-colors hidden sm:block"
              >
                <Info className="w-4 h-4" />
              </button>
              {onShare && (
                <button
                  onClick={(e) => { e.stopPropagation(); onShare(file); }}
                  title="Share"
                  className="p-2 rounded-lg text-[#999] hover:text-white hover:bg-[#222] transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                </button>
              )}
              {onRedundancy && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRedundancy(file); }}
                  title="Redundancy"
                  className="p-2 rounded-lg text-[#999] hover:text-white hover:bg-[#222] transition-colors hidden sm:block"
                >
                  <ShieldCheck className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(file.id); }}
                title="Move to Trash"
                className="p-2 rounded-lg text-[#999] hover:text-white hover:text-white hover:bg-[#222] transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              {onRestore && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRestore(file.id); }}
                  title="Restore File"
                  className="p-2 rounded-lg text-[#999] hover:text-white hover:bg-[#222] transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
              {onPurge && (
                <button
                  onClick={(e) => { e.stopPropagation(); onPurge(file.id); }}
                  title="Permanently Purge"
                  className="p-2 rounded-lg text-[#999] hover:text-white hover:bg-[#222] transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial="hidden"
      animate="visible"
      exit="exit"
      whileHover="hover"
      whileTap="tap"
      variants={animationVariants}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={`relative rounded-2xl p-4 flex flex-col justify-between h-48 border ${
        isSelected
          ? 'bg-[#111] border-white text-white shadow-sm z-10'
          : 'bg-black border-[#222] text-[#ccc]'
      }`}
    >
      {/* Animated background glow on hover */}
      {isHovered && !isSelected && (
        <motion.div
          layoutId="file-hover-bg"
          className="absolute inset-0 bg-[#111]/40 rounded-2xl -z-10"
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            {onToggleSelect && !isTrashed && (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleSelect(file.id); }}
                className="p-1 rounded text-[#666] hover:text-white focus:outline-none transition-colors"
                title={isSelected ? 'Deselect file' : 'Select file'}
              >
                {isSelected ? (
                  <motion.div initial={{scale:0.5}} animate={{scale:1}}>
                    <CheckSquare className="w-4 h-4 text-white" />
                  </motion.div>
                ) : (
                  <Square className="w-4 h-4 text-[#444] hover:text-[#999]" />
                )}
              </button>
            )}
            <div className="p-2.5 rounded-xl bg-[#111] border border-[#222]">
              {getFileIcon(file.mimeType, file.name)}
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onInfo(file); }}
            className="p-1.5 rounded-lg text-[#666] hover:text-white hover:bg-[#222] transition-colors"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>

        <h4 className="font-medium text-xs sm:text-sm text-white truncate hover:text-white transition-colors">
          {file.name}
        </h4>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-[#666] font-mono">{formatSize(file.size)}</span>
          {getFileProviderId(file) && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#111] text-[#999] border border-[#222]">
              {getFileProviderId(file)}
            </span>
          )}
        </div>
      </div>

      <div className="pt-3 border-t border-[#222] flex items-center justify-between relative z-10">
        <span className="text-[10px] font-mono text-[#666]">
          {new Date(file.createdAt).toLocaleDateString()}
        </span>

        <div className="flex items-center gap-1">
          {!isTrashed ? (
            <>
              {onPreview && (
                <button
                  onClick={(e) => { e.stopPropagation(); onPreview(file); }}
                  className="px-2.5 py-1 rounded-lg bg-[#111] border border-[#222] text-[#ccc] hover:text-white hover:bg-[#222] text-xs font-medium flex items-center gap-1 transition-all"
                  title="View File"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">View</span>
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onDownload(file.id); }}
                className="px-2.5 py-1 rounded-lg bg-white text-black hover:bg-zinc-200 text-xs font-semibold flex items-center gap-1 transition-all shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Get</span>
              </button>
              {onRedundancy && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRedundancy(file); }}
                  title="Redundancy"
                  className="p-1.5 rounded-lg text-[#666] hover:text-white hover:bg-[#222] transition-colors"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                </button>
              )}
              {onMove && (
                <button
                  onClick={(e) => { e.stopPropagation(); onMove(file); }}
                  title="Move"
                  className="p-1.5 rounded-lg text-[#666] hover:text-white hover:bg-[#222] transition-colors"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(file.id); }}
                className="p-1.5 rounded-lg text-[#666] hover:text-white hover:text-white hover:bg-[#222] transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              {onRestore && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRestore(file.id); }}
                  className="px-2.5 py-1 rounded-lg bg-[#111] border border-[#222] text-[#ccc] hover:text-white text-xs font-medium flex items-center gap-1 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore</span>
                </button>
              )}
              {onPurge && (
                <button
                  onClick={(e) => { e.stopPropagation(); onPurge(file.id); }}
                  className="p-1.5 rounded-lg text-[#666] hover:text-white hover:text-white hover:bg-[#222] transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}
