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
  HardDrive,
  X,
} from 'lucide-react';
import { CategoryFilter } from '../lib/storage-store';

interface SidebarProps {
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

          {/* Category Navigation */}
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
                    type="button"
                    key={cat.id}
                    onClick={() => {
                      onSelectCategory(cat.id);
                      if (onCloseMobile) onCloseMobile();
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-colors min-h-[40px] ${
                      isActive
                        ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                        : 'text-zinc-400 hover:text-white hover:bg-zinc-900/80'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-zinc-500'}`} />
                      <span>{cat.label}</span>
                    </div>
                    <span
                      className={`text-xs tabular-nums ${
                        isActive ? 'text-white font-semibold' : 'text-zinc-500'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

        {/* Footer: Storage Quota & Settings */}
        <div className="p-4 border-t border-[#222] space-y-3 bg-[#0a0a0a]">
          {/* Storage Quota Bar */}
          <div className="p-3 bg-[#141414] border border-[#262626] rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="flex items-center gap-1.5 font-medium">
                <HardDrive className="w-3.5 h-3.5 text-zinc-500" />
                Vault Storage
              </span>
              <span className="text-zinc-200 font-semibold tabular-nums">{formatBytes(storageUsedBytes)}</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-300"
                style={{ width: `${Math.min(100, Math.max(2, (storageUsedBytes / (5 * 1024 * 1024 * 1024)) * 100))}%` }}
              />
            </div>
            <div className="text-[10px] text-zinc-500 flex justify-between">
              <span>Unlimited Telegram cloud</span>
              <span>Encrypted</span>
            </div>
          </div>

          {/* Action Triggers */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpenRules}
              className="py-2.5 px-3 bg-[#141414] hover:bg-[#1a1a1a] border border-[#262626] hover:border-[#333] rounded-xl text-xs text-zinc-300 hover:text-white flex items-center justify-center gap-2 transition-colors min-h-[40px]"
              title="Storage Routing Rules"
            >
              <Sliders className="w-3.5 h-3.5 text-zinc-400" />
              <span>Rules</span>
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="py-2.5 px-3 bg-[#141414] hover:bg-[#1a1a1a] border border-[#262626] hover:border-[#333] rounded-xl text-xs text-zinc-300 hover:text-white flex items-center justify-center gap-2 transition-colors min-h-[40px]"
              title="Storage Account Settings"
            >
              <Settings className="w-3.5 h-3.5 text-zinc-400" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
