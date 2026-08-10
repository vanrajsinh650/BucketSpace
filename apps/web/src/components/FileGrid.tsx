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
  onDownload: (fileId: string) => void;
  onInfo: (file: FileMetadata) => void;
  onDelete: (fileId: string) => void;
  onRestore?: (fileId: string) => void;
  onPurge?: (fileId: string) => void;
}

export function FileGrid({
  files,
  viewMode,
  onToggleViewMode,
  sortField,
  sortDirection,
  onSortChange,
  onDownload,
  onInfo,
  onDelete,
  onRestore,
  onPurge,
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
              className={`px-2.5 py-1 rounded-lg transition-colors capitalize ${
                sortField === field
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30'
                  : 'hover:text-slate-200 hover:bg-slate-800/50'
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
        <div className="py-20 text-center space-y-3 glass-panel rounded-2xl">
          <SlidersHorizontal className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-slate-400 text-sm font-medium">No files found in this view</p>
          <p className="text-xs text-slate-500">Upload a file or change your filter to get started.</p>
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
              onDownload={onDownload}
              onInfo={onInfo}
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
