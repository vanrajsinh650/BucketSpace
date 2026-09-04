'use client';

import React from 'react';
import { LayoutGrid, List, FolderPlus, ArrowUpDown } from 'lucide-react';
import { FileMetadata } from '@/shared';
import { SortDirection, SortField } from '../lib/storage-store';
import { FileCard } from './FileCard';
import { motion, AnimatePresence } from 'framer-motion';

interface FileGridProps {
  files: FileMetadata[];
  viewMode: 'grid' | 'list';
  onToggleViewMode: (mode: 'grid' | 'list') => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField) => void;
  selectedFileIds?: Set<string>;
  onToggleSelectFile?: (fileId: string) => void;
  onDownload: (fileId: string) => void;
  onInfo: (file: FileMetadata) => void;
  onPreview?: (file: FileMetadata) => void;
  onShare?: (file: FileMetadata) => void;
  onMove?: (file: FileMetadata) => void;
  onRedundancy?: (file: FileMetadata) => void;
  onDelete: (fileId: string) => void;
  onRestore?: (fileId: string) => void;
  onPurge?: (fileId: string) => void;
  onOpenUpload?: () => void;
  onOpenOnboarding?: () => void;
}

export function FileGrid({
  files,
  viewMode,
  onToggleViewMode,
  sortField,
  sortDirection,
  onSortChange,
  selectedFileIds,
  onToggleSelectFile,
  onDownload,
  onInfo,
  onPreview,
  onShare,
  onMove,
  onRedundancy,
  onDelete,
  onRestore,
  onPurge,
  onOpenUpload,
  onOpenOnboarding,
}: FileGridProps) {
  return (
    <div className="space-y-4">
      {/* Control Bar: View Mode Toggle & Sort Selector */}
      <div className="flex items-center justify-between gap-2 sm:gap-3 text-xs">
        <div className="text-xs text-zinc-400 font-medium shrink-0">
          <span className="text-zinc-100 font-semibold tabular-nums">{files.length}</span> {files.length === 1 ? 'item' : 'items'}
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5">
          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 bg-[#141414] border border-[#262626] rounded-xl px-2.5 sm:px-3 py-1.5 text-zinc-300 min-h-[36px]">
            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <select
              aria-label="Sort files by"
              value={sortField}
              onChange={(e) => onSortChange(e.target.value as SortField)}
              className="bg-transparent text-zinc-200 text-xs focus:outline-none cursor-pointer font-medium"
            >
              <option value="date" className="bg-[#141414] text-zinc-200">Date Added</option>
              <option value="name" className="bg-[#141414] text-zinc-200">Name</option>
              <option value="size" className="bg-[#141414] text-zinc-200">File Size</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#141414] border border-[#262626] rounded-xl p-1 min-h-[36px]">
            <button
              type="button"
              onClick={() => onToggleViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors min-w-[30px] min-h-[30px] flex items-center justify-center ${
                viewMode === 'grid' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              aria-label="Grid view"
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onToggleViewMode('list')}
              className={`p-1.5 rounded-lg transition-colors min-w-[30px] min-h-[30px] flex items-center justify-center ${
                viewMode === 'list' ? 'bg-zinc-800 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-300'
              }`}
              aria-label="List view"
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Files Display */}
      {files.length === 0 ? (
        <div className="border border-[#222] bg-[#121212] rounded-2xl p-12 text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 bg-zinc-850 border border-zinc-700/60 rounded-2xl flex items-center justify-center mx-auto text-zinc-400">
            <FolderPlus className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <div className="text-sm font-semibold text-zinc-100">Your drive is empty</div>
            <div className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
              Upload photos, documents, and videos to store them encrypted in your private Telegram vault.
            </div>
          </div>
          {onOpenUpload && (
            <button
              type="button"
              onClick={onOpenUpload}
              className="bg-white text-zinc-950 hover:bg-zinc-200 px-4 py-2.5 rounded-xl text-xs font-semibold transition-colors inline-flex items-center gap-2 min-h-[44px] shadow-sm"
            >
              <FolderPlus className="w-4 h-4" />
              <span>Upload Files</span>
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          <AnimatePresence mode="popLayout">
            {files.map((file, idx) => (
              <FileCard
                key={file.id}
                file={file}
                index={idx}
                viewMode="grid"
                isSelected={selectedFileIds?.has(file.id)}
                onToggleSelect={onToggleSelectFile}
                onDownload={onDownload}
                onInfo={onInfo}
                onPreview={onPreview}
                onShare={onShare}
                onMove={onMove}
                onRedundancy={onRedundancy}
                onDelete={onDelete}
                onRestore={onRestore}
                onPurge={onPurge}
              />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {files.map((file, idx) => (
              <FileCard
                key={file.id}
                file={file}
                index={idx}
                viewMode="list"
                isSelected={selectedFileIds?.has(file.id)}
                onToggleSelect={onToggleSelectFile}
                onDownload={onDownload}
                onInfo={onInfo}
                onPreview={onPreview}
                onShare={onShare}
                onMove={onMove}
                onRedundancy={onRedundancy}
                onDelete={onDelete}
                onRestore={onRestore}
                onPurge={onPurge}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
