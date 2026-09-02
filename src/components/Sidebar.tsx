'use client';

import React from 'react';
import { formatBytes } from '../lib/utils';
import {
  FileText,
  FolderArchive,
  Film,
  Image as ImageIcon,
  Layers,
  Settings,
  Sliders,
  Trash2,
  Activity,
  X,
  HardDrive,
} from 'lucide-react';
import { CategoryFilter } from '../lib/storage-store';

export type MainTab = 'files' | 'analysis';

interface SidebarProps {
  activeTab: MainTab;
  onSelectTab: (tab: MainTab) => void;
  activeCategory: CategoryFilter;
  onSelectCategory: (cat: CategoryFilter) => void;
  onOpenSettings: () => void;
  onOpenRules: () => void;
  categoryCounts: Record<CategoryFilter, number>;
  storageUsedBytes: number;
  providerName?: string;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({
  activeTab,
  onSelectTab,
  activeCategory,
  onSelectCategory,
  onOpenSettings,
  onOpenRules,
  categoryCounts,
  storageUsedBytes,
  providerName,
  isMobileOpen = false,
  onCloseMobile,
}: SidebarProps) {
  const categories: { id: CategoryFilter; label: string; icon: React.ElementType }[] = [
    { id: 'ALL', label: 'All Files', icon: Layers },
    { id: 'PHOTOS', label: 'Photos', icon: ImageIcon },
    { id: 'VIDEOS', label: 'Videos', icon: Film },
    { id: 'DOCUMENTS', label: 'Documents', icon: FileText },
    { id: 'OTHER', label: 'Archives & Other', icon: FolderArchive },
    { id: 'TRASH', label: 'Trash', icon: Trash2 },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Main Sidebar Shell */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#0a0a0a] border-r border-[#1e1e1e] flex flex-col justify-between transition-transform duration-200 ease-out lg:translate-x-0 ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:sticky lg:h-screen`}
      >
        {/* Top Header & Navigation */}
        <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
          {/* Brand & Workspace */}
          <div className="p-4 border-b border-[#1e1e1e] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 bg-white text-black flex items-center justify-center font-mono font-bold text-xs rounded">
                B
              </div>
              <div>
                <div className="font-semibold text-xs tracking-tight text-white uppercase font-mono">
                  BucketSpace
                </div>
                <div className="text-[10px] text-[#888] font-mono truncate max-w-[130px]">
                  {providerName || 'Local Vault'}
                </div>
              </div>
            </div>
            {onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="lg:hidden p-1 text-[#888] hover:text-white rounded"
                aria-label="Close Sidebar"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Mode Switcher: Files vs Architecture */}
          <div className="p-3 border-b border-[#1e1e1e]">
            <div className="grid grid-cols-2 gap-1 bg-[#121212] p-0.5 border border-[#1e1e1e] rounded">
              <button
                onClick={() => onSelectTab('files')}
                className={`py-1.5 px-2 text-[11px] font-mono uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1.5 ${
                  activeTab === 'files'
                    ? 'bg-white text-black font-semibold'
                    : 'text-[#888] hover:text-white'
                }`}
              >
                <Layers className="w-3 h-3" />
                Files
              </button>
              <button
                onClick={() => onSelectTab('analysis')}
                className={`py-1.5 px-2 text-[11px] font-mono uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-1.5 ${
                  activeTab === 'analysis'
                    ? 'bg-white text-black font-semibold'
                    : 'text-[#888] hover:text-white'
                }`}
              >
                <Activity className="w-3 h-3" />
                Inspect
              </button>
            </div>
          </div>

          {/* Category Navigation (Shown when activeTab === 'files') */}
          {activeTab === 'files' ? (
            <div className="p-3 space-y-0.5 flex-1">
              <div className="px-2 py-1.5 text-[10px] font-mono uppercase tracking-widest text-[#555]">
                Categories
              </div>
              {categories.map((cat) => {
                const Icon = cat.icon;
                const isActive = activeCategory === cat.id;
                const count = categoryCounts[cat.id] || 0;
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      onSelectCategory(cat.id);
                      if (onCloseMobile) onCloseMobile();
                    }}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded text-xs font-mono transition-colors btn-press ${
                      isActive
                        ? 'bg-[#1a1a1a] text-white border border-[#333]'
                        : 'text-[#888] hover:text-white hover:bg-[#121212]'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-[#666]'}`} />
                      <span>{cat.label}</span>
                    </div>
                    <span
                      className={`text-[10px] tabular-nums ${
                        isActive ? 'text-white font-bold' : 'text-[#555]'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="p-4 text-xs font-mono text-[#888] space-y-2 flex-1">
              <div className="text-[10px] uppercase tracking-widest text-[#555]">
                System Architecture
              </div>
              <p className="text-[11px] leading-relaxed text-[#777]">
                Live telemetry, chunk verification graphs, and multi-provider data routing workbench.
              </p>
            </div>
          )}
        </div>

        {/* Footer: Storage Quota & Settings */}
        <div className="p-3 border-t border-[#1e1e1e] space-y-3 bg-[#0a0a0a]">
          {/* Storage Quota Bar */}
          <div className="p-2.5 bg-[#121212] border border-[#1e1e1e] rounded space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase text-[#888]">
              <span className="flex items-center gap-1">
                <HardDrive className="w-3 h-3 text-[#666]" />
                Usage
              </span>
              <span className="text-white tabular-nums">{formatBytes(storageUsedBytes)}</span>
            </div>
            <div className="h-1 bg-[#222] rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(2, (storageUsedBytes / (5 * 1024 * 1024 * 1024)) * 100))}%` }}
              />
            </div>
            <div className="text-[9px] font-mono text-[#555] flex justify-between">
              <span>Unlimited Cluster</span>
              <span>Encrypted</span>
            </div>
          </div>

          {/* Action Triggers */}
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={onOpenRules}
              className="py-1.5 px-2 bg-[#121212] hover:bg-[#181818] border border-[#1e1e1e] hover:border-[#333] rounded text-[10px] font-mono text-[#888] hover:text-white flex items-center justify-center gap-1.5 transition-colors btn-press"
              title="Storage Routing Rules"
            >
              <Sliders className="w-3 h-3" />
              <span>Rules</span>
            </button>
            <button
              onClick={onOpenSettings}
              className="py-1.5 px-2 bg-[#121212] hover:bg-[#181818] border border-[#1e1e1e] hover:border-[#333] rounded text-[10px] font-mono text-[#888] hover:text-white flex items-center justify-center gap-1.5 transition-colors btn-press"
              title="Storage Provider Settings"
            >
              <Settings className="w-3 h-3" />
              <span>Config</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
