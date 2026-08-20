'use client';

import React from 'react';
import { LayoutGrid, List, SlidersHorizontal } from 'lucide-react';
import { FileMetadata } from '@bucketspace/shared';
import { SortDirection, SortField } from '../lib/storage-store';
import { FileCard } from './FileCard';

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
      <div className="flex items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
          <span>Sort by:</span>
          {(['name', 'size', 'date'] as SortField[]).map((field) => (
            <button
              key={field}
              onClick={() => onSortChange(field)}
              className={`px-3 py-1.5 rounded-lg capitalize transition-all ${
                sortField === field
                  ? 'bg-slate-800 text-cyan-400 font-semibold border border-slate-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/60'
              }`}
            >
              {field} {sortField === field && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
          ))}
        </div>

        {/* Grid vs List Toggle */}
        <div className="flex items-center gap-1 p-1 bg-slate-900/90 rounded-xl border border-slate-800">
          <button
            onClick={() => onToggleViewMode('grid')}
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'grid' ? 'bg-slate-800 text-cyan-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            onClick={() => onToggleViewMode('list')}
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'list' ? 'bg-slate-800 text-cyan-400' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Grid or List Display */}
      {files.length === 0 ? (
        <div className="py-16 px-6 text-center space-y-6 glass-panel rounded-3xl border border-slate-800/80 max-w-xl mx-auto my-8">
          <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mx-auto">
            <SlidersHorizontal className="w-8 h-8" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-lg font-semibold text-white">No files in this view</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Upload files or connect your preferred storage backend to get started.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {onOpenUpload && (
              <button
                onClick={onOpenUpload}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-xs shadow-lg shadow-cyan-500/20 transition-all active:scale-95"
              >
                Upload File
              </button>
            )}
            {onOpenOnboarding && (
              <button
                onClick={onOpenOnboarding}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white font-medium text-xs transition-all"
              >
                + Connect Storage Provider
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
              : 'space-y-2'
          }
        >
          {files.map((file) => (
            <FileCard
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
        </div>
      )}
    </div>
  );
}
