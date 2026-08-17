'use client';

import React, { useEffect, useState } from 'react';
import { DuplicateCheckResult, FileMetadata, StorageRule } from '@bucketspace/shared';
import { DuplicateConflictModal } from '../components/DuplicateConflictModal';
import { FileGrid } from '../components/FileGrid';
import { FileInfoModal } from '../components/FileInfoModal';
import { FilePreviewModal } from '../components/FilePreviewModal';
import { Header } from '../components/Header';
import { MoveFileModal } from '../components/MoveFileModal';
import { OnboardingLandingPage } from '../components/OnboardingLandingPage';
import { ProviderOnboardingModal } from '../components/ProviderOnboardingModal';
import { ProviderSettings, ProviderDisplayInfo } from '../components/ProviderSettings';
import { ShareModal } from '../components/ShareModal';
import { Sidebar } from '../components/Sidebar';
import { StorageRulesPanel } from '../components/storage-rules/StorageRulesPanel';
import { UploadModal } from '../components/UploadModal';
import {
  CategoryFilter,
  SortDirection,
  SortField,
  StorageStore,
  UploadProgressState,
} from '../lib/storage-store';

export default function BucketSpaceApp() {
  const [store, setStore] = useState<StorageStore>(() => StorageStore.getInstance());
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploadState, setUploadState] = useState<UploadProgressState | null>(null);
  const [selectedFileForPreview, setSelectedFileForPreview] = useState<FileMetadata | null>(null);
  const [selectedFileForInfo, setSelectedFileForInfo] = useState<FileMetadata | null>(null);
  const [selectedFileForShare, setSelectedFileForShare] = useState<FileMetadata | null>(null);
  const [selectedFileForMove, setSelectedFileForMove] = useState<FileMetadata | null>(null);
  const [duplicateConflict, setDuplicateConflict] = useState<{
    file: File;
    result: DuplicateCheckResult;
  } | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [providerList, setProviderList] = useState<ProviderDisplayInfo[]>([]);
  const [rulesList, setRulesList] = useState<StorageRule[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  /* ─── Provider Connection Handler (defined early for onboarding gate) ─── */
  const handleConnectProvider = async (
    providerId: string,
    config: Record<string, unknown>
  ): Promise<{ success: boolean; message?: string }> => {
    await new Promise((r) => setTimeout(r, 500));
    store.registerUserProvider(providerId, config);
    setRefreshTrigger((prev) => prev + 1);
    return { success: true, message: `${providerId} connected successfully.` };
  };

  /* ─── Onboarding Landing Gate ─── */
  /* New users with zero real providers see the modern landing page instead of an empty dashboard */
  const isFirstRun = !store.hasUserProvider();
  if (isFirstRun) {
    return (
      <OnboardingLandingPage
        onConnectProvider={handleConnectProvider}
        onFinishOnboarding={() => setRefreshTrigger((prev) => prev + 1)}
      />
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
      // Pre-check for duplicate or name collision
      const check = await store.checkDuplicate(file);
      if (check.scenario === 'SAME_NAME_IDENTICAL_CONTENT' || check.scenario === 'SAME_NAME_DIFFERENT_CONTENT') {
        setUploadModalOpen(false);
        setDuplicateConflict({ file, result: check });
        return;
      }

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

  /* ─── Duplicate Conflict Handlers ─── */

  const handleKeepBoth = async (suggestedName: string) => {
    if (!duplicateConflict) return;
    const { file } = duplicateConflict;
    setDuplicateConflict(null);
    setUploadModalOpen(true);

    try {
      await store.uploadFileWithCustomName(file, suggestedName, (progress) => {
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

  const handleReplaceExisting = async (existingFileId: string) => {
    if (!duplicateConflict) return;
    const { file } = duplicateConflict;
    setDuplicateConflict(null);
    setUploadModalOpen(true);

    try {
      await store.replaceFile(existingFileId, file, (progress) => {
        setUploadState({ ...progress });
      });
      setRefreshTrigger((prev) => prev + 1);
      setTimeout(() => {
        setUploadModalOpen(false);
        setUploadState(null);
      }, 800);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Replacement failed';
      setUploadState((prev) => (prev ? { ...prev, status: 'FAILED', errorMessage: msg } : null));
    }
  };

  const handleSkipDuplicate = () => {
    setDuplicateConflict(null);
  };

  const handleUploadAnyway = async () => {
    if (!duplicateConflict) return;
    const { file } = duplicateConflict;
    setDuplicateConflict(null);
    setUploadModalOpen(true);

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
      // Extract the user-friendly portion (before [Technical:]) if present
      const friendlyMsg = msg.includes('[Technical:') ? msg.split('[Technical:')[0].trim() : msg;
      alert(friendlyMsg);
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

  /* ─── Provider Management Handlers ─── */

  const handleOpenSettings = () => {
    const providers = store.getRegisteredProviders();
    setProviderList(providers);
    setSettingsOpen(true);
  };

  const handleTestConnection = async (providerId: string) => {
    const result = await store.testProviderHealth(providerId);
    setProviderList((prev) =>
      prev.map((p) =>
        p.providerId === providerId
          ? { ...p, status: result.status, latencyMs: result.latencyMs }
          : p
      )
    );
  };

  const handleRemoveProvider = (providerId: string) => {
    store.removeProvider(providerId);
    setProviderList((prev) => prev.filter((p) => p.providerId !== providerId));
  };

  const handleMoveFile = async (fileId: string, targetProviderId: string) => {
    try {
      await store.migrateFile(fileId, targetProviderId);
      setSelectedFileForMove(null);
      setRefreshTrigger((prev) => prev + 1);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Migration failed';
      alert(`Move Error: ${msg}`);
    }
  };

  const getMoveProviders = (file: FileMetadata) => {
    const currentProviderId = file.chunks?.[0]?.providerRef?.providerId ?? 'unknown';
    const allProviders = store.getRegisteredProviders();
    return allProviders.map((p) => ({
      providerId: p.providerId,
      current: p.providerId === currentProviderId,
    }));
  };

  /* ─── Storage Rules Handlers ─── */

  const handleOpenRules = () => {
    setRulesList(store.getRules());
    setRulesOpen(true);
  };

  const handleSaveRule = (rule: StorageRule) => {
    store.saveRule(rule);
    setRulesList(store.getRules());
  };

  const handleToggleRule = (ruleId: string, enabled: boolean) => {
    store.toggleRule(ruleId, enabled);
    setRulesList(store.getRules());
  };

  const handleDeleteRule = (ruleId: string) => {
    store.deleteRule(ruleId);
    setRulesList(store.getRules());
  };


  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex">
      {/* Sidebar */}
      <Sidebar
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        onOpenSettings={handleOpenSettings}
        onOpenRules={handleOpenRules}
        categoryCounts={categoryCounts}
        storageUsedBytes={storageUsedBytes}
        providerName={providerName}
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
            onPreview={setSelectedFileForPreview}
            onShare={setSelectedFileForShare}
            onMove={setSelectedFileForMove}
            onDelete={handleDelete}
            onRestore={handleRestore}
            onPurge={handlePurge}
            onOpenUpload={() => setUploadModalOpen(true)}
            onOpenOnboarding={() => setOnboardingOpen(true)}
          />
        </main>
      </div>

      {/* File Preview Modal */}
      <FilePreviewModal
        file={selectedFileForPreview}
        isOpen={selectedFileForPreview !== null}
        onClose={() => setSelectedFileForPreview(null)}
        onDownload={handleDownload}
      />

      {/* Duplicate / Name Conflict Modal */}
      <DuplicateConflictModal
        isOpen={duplicateConflict !== null}
        incomingFile={duplicateConflict?.file ?? null}
        checkResult={duplicateConflict?.result ?? null}
        onKeepBoth={handleKeepBoth}
        onReplaceExisting={handleReplaceExisting}
        onSkip={handleSkipDuplicate}
        onUploadAnyway={handleUploadAnyway}
        onClose={() => setDuplicateConflict(null)}
      />

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

      {/* Share Modal */}
      <ShareModal
        file={selectedFileForShare}
        onClose={() => setSelectedFileForShare(null)}
      />

      {/* Move File Modal */}
      {selectedFileForMove && (
        <MoveFileModal
          file={selectedFileForMove}
          availableProviders={getMoveProviders(selectedFileForMove)}
          onMove={handleMoveFile}
          onClose={() => setSelectedFileForMove(null)}
        />
      )}

      {/* Provider Settings Modal */}
      {settingsOpen && (
        <ProviderSettings
          providers={providerList}
          onTestConnection={handleTestConnection}
          onRemoveProvider={handleRemoveProvider}
          onOpenOnboarding={() => setOnboardingOpen(true)}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {/* Provider Onboarding & Connection Modal */}
      <ProviderOnboardingModal
        isOpen={onboardingOpen}
        onClose={() => setOnboardingOpen(false)}
        onConnectProvider={handleConnectProvider}
      />

      {/* Storage Policy Rules Modal */}
      {rulesOpen && (
        <StorageRulesPanel
          rules={rulesList}
          availableProviders={store.getRegisteredProviders().map((p) => p.providerId)}
          defaultProviderId={store.getDefaultProviderId()}
          onSaveRule={handleSaveRule}
          onToggleRule={handleToggleRule}
          onDeleteRule={handleDeleteRule}
          onClose={() => setRulesOpen(false)}
        />
      )}
    </div>
  );
}
