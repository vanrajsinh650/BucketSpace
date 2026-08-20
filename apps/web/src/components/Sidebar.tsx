'use client';

import React from 'react';
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
    { id: 'OTHER', label: 'Other', icon: FolderArchive },
    { id: 'TRASH', label: 'Trash', icon: Trash2 },
  ];

  const formattedUsed =
    storageUsedBytes >= 1024 * 1024 * 1024
      ? `${(storageUsedBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
      : `${(storageUsedBytes / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/80 backdrop-blur-sm lg:hidden transition-opacity"
        />
      )}

      <aside
        className={`fixed lg:sticky top-0 left-0 z-50 lg:z-auto w-72 lg:w-64 h-screen bg-black border-r border-zinc-800/90 flex flex-col justify-between p-4 select-none shrink-0 transition-transform duration-200 ease-in-out ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="space-y-6">
          {/* Brand Header */}
          <div className="flex items-center justify-between px-2 pt-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700 flex items-center justify-center text-white">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h1 className="font-semibold text-white tracking-tight text-sm">BucketSpace</h1>
                <p className="text-[11px] text-zinc-500 font-mono">Personal Cloud</p>
              </div>
            </div>

            {/* Mobile Close Button */}
            {onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="lg:hidden p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Main Mode Switcher */}
          <div className="p-1 rounded-xl bg-zinc-900/80 border border-zinc-800 grid grid-cols-2 gap-1 text-xs">
            <button
              onClick={() => {
                onSelectTab('files');
                onCloseMobile?.();
              }}
              className={`py-1.5 px-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'files'
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Files</span>
            </button>

            <button
              onClick={() => {
                onSelectTab('analysis');
                onCloseMobile?.();
              }}
              className={`py-1.5 px-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'analysis'
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Analysis</span>
            </button>
          </div>

          {/* Category Navigation (Shown in Files mode) */}
          {activeTab === 'files' && (
            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-zinc-500 px-3 mb-1.5">
                Categories
              </div>
              <nav className="space-y-0.5">
                {categories.map((cat) => {
                  const Icon = cat.icon;
                  const isActive = activeCategory === cat.id;
                  const count = categoryCounts[cat.id] ?? 0;

                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        onSelectCategory(cat.id);
                        onCloseMobile?.();
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-zinc-900 text-white border border-zinc-700/80'
                          : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-zinc-500'}`} />
                        <span>{cat.label}</span>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                          isActive
                            ? 'bg-white text-black font-semibold'
                            : 'bg-zinc-900 text-zinc-500'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </nav>
            </div>
          )}
        </div>

        {/* Bottom Storage Status & Settings */}
        <div className="space-y-3 pt-4 border-t border-zinc-800/80">
          <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/90 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-zinc-300 font-medium truncate text-[11px]">
                  {providerName || 'Telegram Cloud'}
                </span>
              </div>
              <span className="text-white font-mono text-[11px] font-semibold shrink-0">
                {formattedUsed}
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
              <span>Capacity</span>
              <span className="text-zinc-200 font-semibold flex items-center gap-1">
                <span className="text-xs">∞</span> Unlimited
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-1">
            <button
              onClick={() => {
                onOpenRules();
                onCloseMobile?.();
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-zinc-300 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-all"
            >
              <Sliders className="w-3.5 h-3.5 text-zinc-400" />
              <span>Routing Rules</span>
            </button>

            <button
              onClick={() => {
                onOpenSettings();
                onCloseMobile?.();
              }}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 transition-all border border-transparent hover:border-zinc-800"
            >
              <Settings className="w-3.5 h-3.5 text-zinc-500" />
              <span>Storage Providers</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
