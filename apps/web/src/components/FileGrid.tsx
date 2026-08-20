'use client';

import React from 'react';
import { LayoutGrid, List, FolderPlus } from 'lucide-react';
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
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-zinc-800/80">
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
          <span className="text-zinc-500 hidden sm:inline">Sort:</span>
          {(['name', 'size', 'date'] as SortField[]).map((field) => (
            <button
              key={field}
              onClick={() => onSortChange(field)}
              className={`px-2.5 py-1 rounded-lg capitalize transition-all text-xs ${
                sortField === field
                  ? 'bg-zinc-800 text-white font-semibold border border-zinc-700'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
              }`}
            >
              {field} {sortField === field && (sortDirection === 'asc' ? '↑' : '↓')}
            </button>
          ))}
        </div>

        {/* Grid vs List Toggle */}
        <div className="flex items-center gap-1 p-1 bg-zinc-950 rounded-xl border border-zinc-800">
          <button
            onClick={() => onToggleViewMode('grid')}
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'grid' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onToggleViewMode('list')}
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === 'list' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Grid or List Display */}
      {files.length === 0 ? (
        <div className="py-16 px-6 text-center space-y-5 rounded-3xl bg-zinc-950 border border-zinc-800/90 max-w-lg mx-auto my-8">
          <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 mx-auto">
            <FolderPlus className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-semibold text-white">No files found</h3>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto">
              Upload files or connect storage backends to start storing your files securely.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            {onOpenUpload && (
              <button
                onClick={onOpenUpload}
                className="px-4 py-2 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-all"
              >
                Upload File
              </button>
            )}
            {onOpenOnboarding && (
              <button
                onClick={onOpenOnboarding}
                className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white font-medium text-xs hover:bg-zinc-800 transition-all"
              >
                Connect Storage
              </button>
            )}
          </div>
        </div>
      ) : (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5'
              : 'space-y-2'
          }
        >
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
        </div>
      )}
    </div>
  );
}
