'use client';

import React, { useEffect, useState } from 'react';
import { FileMetadata } from '@bucketspace/shared';
import { FileGrid } from '../components/FileGrid';
import { FileInfoModal } from '../components/FileInfoModal';
import { Header } from '../components/Header';
import { Sidebar } from '../components/Sidebar';
import { UploadModal } from '../components/UploadModal';
import {
  CategoryFilter,
  SortDirection,
  SortField,
  StorageStore,
  UploadProgressState,
} from '../lib/storage-store';

export default function BucketSpaceApp() {
  const [store, setStore] = useState<StorageStore | null>(null);
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadState, setUploadState] = useState<UploadProgressState | null>(null);
  const [selectedFileForInfo, setSelectedFileForInfo] = useState<FileMetadata | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    setStore(StorageStore.getInstance());
  }, []);

  if (!store) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center text-cyan-400 font-mono text-sm">
        Initializing BucketSpace Storage Engine...
      </div>
    );
  }

  const files = store.getFiles(activeCategory, searchQuery, sortField, sortDirection);
  const categoryCounts = store.getCategoryCounts();
  const storageUsedBytes = store.getTotalStorageBytes();
  const providerName = store.getActiveProviderName();

  const handleSortChange = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleUploadFile = async (file: File) => {
    try {
      await store.uploadFile(file, (progress) => {
        setUploadState({ ...progress });
      });
      setRefreshTrigger((prev) => prev + 1);
      setTimeout(() => {
        setUploadModalOpen(false);
        setUploadState(null);
      }, 800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setUploadState((prev) => (prev ? { ...prev, status: 'FAILED', errorMessage: msg } : null));
    }
  };

  const handleDownload = async (fileId: string) => {
    try {
      await store.downloadFile(fileId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      alert(`Download Error: ${msg}`);
    }
  };

  const handleDelete = (fileId: string) => {
    store.deleteFile(fileId);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleRestore = (fileId: string) => {
    store.restoreFile(fileId);
    setRefreshTrigger((prev) => prev + 1);
  };

  const handlePurge = async (fileId: string) => {
    if (confirm('Are you sure you want to permanently purge this file and delete all chunk storage?')) {
      await store.purgeFile(fileId);
      setRefreshTrigger((prev) => prev + 1);
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex">
      {/* Sidebar */}
      <Sidebar
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        categoryCounts={categoryCounts}
        storageUsedBytes={storageUsedBytes}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenUpload={() => setUploadModalOpen(true)}
          providerName={providerName}
        />

        <main className="p-8 flex-1">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white capitalize tracking-tight">
                {activeCategory === 'ALL' ? 'My Files' : activeCategory.toLowerCase()}
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Showing {files.length} {files.length === 1 ? 'file' : 'files'}
              </p>
            </div>
          </div>

          <FileGrid
            files={files}
            viewMode={viewMode}
            onToggleViewMode={setViewMode}
            sortField={sortField}
            sortDirection={sortDirection}
            onSortChange={handleSortChange}
            onDownload={handleDownload}
            onInfo={setSelectedFileForInfo}
            onDelete={handleDelete}
            onRestore={handleRestore}
            onPurge={handlePurge}
          />
        </main>
      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={uploadModalOpen}
        onClose={() => {
          setUploadModalOpen(false);
          setUploadState(null);
        }}
        onUploadFile={handleUploadFile}
        uploadState={uploadState}
      />

      {/* File Info Modal */}
      <FileInfoModal
        file={selectedFileForInfo}
        onClose={() => setSelectedFileForInfo(null)}
      />
    </div>
  );
}
