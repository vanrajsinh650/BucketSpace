'use client';

import React from 'react';
import { LayoutGrid, List, FolderPlus, ArrowUpDown } from 'lucide-react';
import { FileMetadata } from '@bucketspace/shared';
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
      <div className="flex items-center justify-between gap-3 text-xs font-mono">
        <div className="text-[11px] text-[#666] uppercase tracking-wider">
          <span className="text-white font-bold tabular-nums">{files.length}</span> items
        </div>

        <div className="flex items-center gap-2">
          {/* Sort Selector */}
          <div className="flex items-center gap-1 bg-[#0a0a0a] border border-[#1e1e1e] rounded px-2 py-1 text-[#888]">
            <ArrowUpDown className="w-3 h-3 text-[#555]" />
            <select
              value={sortField}
              onChange={(e) => onSortChange(e.target.value as SortField)}
              className="bg-transparent text-white text-xs font-mono focus:outline-none cursor-pointer"
            >
              <option value="date" className="bg-black text-white">Date</option>
              <option value="name" className="bg-black text-white">Name</option>
              <option value="size" className="bg-black text-white">Size</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#0a0a0a] border border-[#1e1e1e] rounded p-0.5">
            <button
              onClick={() => onToggleViewMode('grid')}
              className={`p-1 rounded transition-colors btn-press ${
                viewMode === 'grid' ? 'bg-white text-black' : 'text-[#666] hover:text-white'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onToggleViewMode('list')}
              className={`p-1 rounded transition-colors btn-press ${
                viewMode === 'list' ? 'bg-white text-black' : 'text-[#666] hover:text-white'
              }`}
              title="List View"
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Files Display */}
      {files.length === 0 ? (
        <div className="border border-[#1e1e1e] bg-[#0a0a0a] rounded-lg p-12 text-center space-y-4">
          <div className="w-10 h-10 bg-[#121212] border border-[#222] rounded flex items-center justify-center mx-auto text-[#666]">
            <FolderPlus className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <div className="font-mono text-sm font-semibold text-white">No files found</div>
            <div className="font-mono text-xs text-[#666] max-w-sm mx-auto">
              Drop files here or click upload to store zero-knowledge encrypted chunks.
            </div>
          </div>
          {onOpenUpload && (
            <button
              onClick={onOpenUpload}
              className="bg-white text-black hover:bg-[#e0e0e0] px-4 py-2 rounded text-xs font-mono font-bold uppercase tracking-wider transition-colors btn-press inline-flex items-center gap-1.5"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>Upload First File</span>
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[1px] bg-[#1e1e1e] border border-[#1e1e1e] rounded-lg overflow-hidden">
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
        <div className="divide-y divide-[#1e1e1e] border border-[#1e1e1e] rounded-lg overflow-hidden bg-[#1e1e1e]">
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
