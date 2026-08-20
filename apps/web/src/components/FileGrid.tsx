'use client';

import React from 'react';
import { LayoutGrid, List, FolderPlus } from 'lucide-react';
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
      {/* Controls Bar */}
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#222]">
        <div className="flex items-center gap-1.5 text-xs text-[#999] font-medium">
          <span className="text-[#666] hidden sm:inline">Sort:</span>
          {(['name', 'size', 'date'] as SortField[]).map((field) => (
            <button
              key={field}
              onClick={() => onSortChange(field)}
              className={`px-2.5 py-1 rounded-lg capitalize transition-all text-xs ${
                sortField === field
                  ? 'bg-[#222] text-white font-semibold border border-[#333]'
                  : 'text-[#666] hover:text-[#ccc] hover:bg-[#111]'
              }`}
            >
              {field} {sortField === field && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
          ))}
        </div>

        {/* Grid vs List Toggle */}
        <div className="flex items-center gap-1 p-1 bg-black rounded-xl border border-[#222]">
          <button
            onClick={() => onToggleViewMode('grid')}
            className={`relative p-1.5 rounded-lg transition-colors z-10 ${
              viewMode === 'grid' ? 'text-white' : 'text-[#666] hover:text-[#ccc]'
            }`}
          >
            {viewMode === 'grid' && (
              <motion.div
                layoutId="view-toggle-bg"
                className="absolute inset-0 bg-[#222] rounded-lg -z-10"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onToggleViewMode('list')}
            className={`relative p-1.5 rounded-lg transition-colors z-10 ${
              viewMode === 'list' ? 'text-white' : 'text-[#666] hover:text-[#ccc]'
            }`}
          >
            {viewMode === 'list' && (
              <motion.div
                layoutId="view-toggle-bg"
                className="absolute inset-0 bg-[#222] rounded-lg -z-10"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Grid or List Display */}
      {files.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="py-16 px-6 text-center space-y-5 rounded-3xl bg-black border border-[#222] max-w-lg mx-auto my-8"
        >
          <div className="w-12 h-12 rounded-2xl bg-[#111] border border-[#222] flex items-center justify-center text-[#ccc] mx-auto">
            <FolderPlus className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white">No files found</h3>
            <p className="text-xs text-[#999] max-w-xs mx-auto">
              Upload files or connect storage backends to start storing your files securely.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {onOpenUpload && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={onOpenUpload}
                className="px-4 py-2 rounded-xl bg-white text-black font-semibold text-xs transition-all"
              >
                Upload File
              </motion.button>
            )}
            {onOpenOnboarding && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={onOpenOnboarding}
                className="px-4 py-2 rounded-xl bg-[#111] border border-[#222] text-[#ccc] hover:text-white font-medium text-xs transition-all"
              >
                Connect Storage
              </motion.button>
            )}
          </div>
        </motion.div>
      ) : (
        <motion.div
          layout
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5'
              : 'space-y-2'
          }
        >
          <AnimatePresence mode="popLayout">
            {files.map((file, i) => (
              <FileCard
                index={i}
                key={file.id}
                file={file}
                viewMode={viewMode}
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
        </motion.div>
      )}
    </div>
  );
}
