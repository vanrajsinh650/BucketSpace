'use client';

import React from 'react';
import { Search, Upload, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenUpload: () => void;
  providerName: string;
}

export function Header({
  searchQuery,
  onSearchChange,
  onOpenUpload,
  providerName,
}: HeaderProps) {
  return (
    <header className="h-20 border-b border-slate-800/80 glass-panel sticky top-0 z-10 px-8 flex items-center justify-between gap-4">
      {/* Search Input */}
      <div className="relative flex-1 max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          placeholder="Search files by name..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full bg-slate-900/80 border border-slate-800 text-slate-200 placeholder-slate-500 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all"
        />
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-4">
        {/* Storage Provider Status Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 text-xs font-medium text-slate-300">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Provider:</span>
          <span className="text-cyan-400 font-mono">{providerName}</span>
        </div>

        {/* Upload Button */}
        <button
          onClick={onOpenUpload}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-sm shadow-lg shadow-cyan-500/20 hover:shadow-cyan-500/30 transition-all duration-200 active:scale-95"
        >
          <Upload className="w-4 h-4" />
          <span>Upload File</span>
        </button>
      </div>
    </header>
  );
}
