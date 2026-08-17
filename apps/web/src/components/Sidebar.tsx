'use client';

import React from 'react';
import {
  FileText,
  FolderArchive,
  HardDrive,
  Film,
  Image as ImageIcon,
  Layers,
  Settings,
  Sliders,
  Trash2,
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
}

export function Sidebar({
  activeCategory,
  onSelectCategory,
  onOpenSettings,
  onOpenRules,
  categoryCounts,
  storageUsedBytes,
  providerName,
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
    <aside className="w-64 glass-panel border-r border-slate-800/80 flex flex-col justify-between p-4 select-none shrink-0 h-screen sticky top-0">
      <div>
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-3 py-4 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-white tracking-tight">BucketSpace</h1>
            <p className="text-xs text-slate-500">Personal Cloud</p>
          </div>
        </div>

        {/* Category Navigation */}
        <nav className="space-y-1">
          {categories.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.id;
            const count = categoryCounts[cat.id] ?? 0;

            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span>{cat.label}</span>
                </div>
                <span
                  className={`text-xs font-mono px-2 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-cyan-500/30 text-cyan-200'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Storage Used Indicator (Unlimited Free Cloud) */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-slate-300 font-medium truncate">{providerName || 'Telegram Cloud'}</span>
          </div>
          <span className="text-cyan-400 font-mono font-semibold shrink-0">{formattedUsed}</span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span>Capacity</span>
          <span className="text-emerald-400 font-mono font-semibold flex items-center gap-1">
            <span className="text-xs">∞</span> Unlimited
          </span>
        </div>
        <p className="text-[10px] text-slate-500 border-t border-slate-800/60 pt-2">
          Client-side encrypted • Zero storage caps
        </p>
      </div>

      {/* Action Buttons */}
      <div className="mt-3 space-y-1.5">
        <button
          onClick={onOpenRules}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20 transition-all"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Storage Policy Rules</span>
        </button>

        <button
          onClick={onOpenSettings}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 transition-all border border-slate-800/60"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Storage Providers</span>
        </button>
      </div>
    </aside>
  );
}
