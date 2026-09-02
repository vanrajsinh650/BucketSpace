import React from 'react';
import { Search, Upload, LogOut, Menu } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenUpload: () => void;
  providerName: string;
  onDisconnect?: () => void;
  onOpenMobileMenu?: () => void;
}

export function Header({
  searchQuery,
  onSearchChange,
  onOpenUpload,
  providerName,
  onDisconnect,
  onOpenMobileMenu,
}: HeaderProps) {
  return (
    <header className="h-14 border-b border-[#1e1e1e] bg-[#0a0a0a]/90 sticky top-0 z-30 px-4 sm:px-6 flex items-center justify-between gap-3 backdrop-blur-md">
      {/* Search Input */}
      <div className="flex items-center gap-2.5 flex-1 max-w-md">
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            className="lg:hidden p-1.5 rounded bg-[#121212] border border-[#1e1e1e] text-[#888] hover:text-white btn-press"
            aria-label="Open Navigation"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-[#555] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search filenames or hashes..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#0a0a0a] border border-[#1e1e1e] text-white placeholder-[#555] rounded-lg pl-8 pr-12 py-1.5 text-xs font-mono focus:outline-none focus:border-[#444] transition-colors"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono text-[#555] pointer-events-none hidden sm:inline">
            ⌘K
          </span>
        </div>
      </div>

      {/* Right Actions: Upload & Active Provider */}
      <div className="flex items-center gap-2.5">
        {/* Upload Button */}
        <button
          onClick={onOpenUpload}
          className="bg-white text-black hover:bg-[#e0e0e0] px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors btn-press shadow-sm"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload</span>
        </button>

        {/* Provider Tag & Disconnect */}
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-[#1e1e1e]">
          <span className="text-[11px] font-mono text-[#888] uppercase">
            {providerName}
          </span>
          {onDisconnect && (
            <button
              onClick={onDisconnect}
              className="p-1.5 text-[#555] hover:text-white rounded hover:bg-[#121212] transition-colors btn-press"
              title="Disconnect Storage Provider"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
