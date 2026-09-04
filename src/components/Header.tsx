import React from 'react';
import { Search, Upload, LogOut, Menu, RotateCw } from 'lucide-react';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenUpload: () => void;
  providerName: string;
  onDisconnect?: () => void;
  onOpenMobileMenu?: () => void;
  onSync?: () => void;
  isSyncing?: boolean;
}

export function Header({
  searchQuery,
  onSearchChange,
  onOpenUpload,
  providerName,
  onDisconnect,
  onOpenMobileMenu,
  onSync,
  isSyncing = false,
}: HeaderProps) {
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="h-16 border-b border-[#222] bg-[#0a0a0a]/90 sticky top-0 z-30 px-3 sm:px-6 flex items-center justify-between gap-2 sm:gap-3 backdrop-blur-md">
      {/* Search Input */}
      <div className="flex items-center gap-2 sm:gap-2.5 flex-1 max-w-md min-w-0">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white min-w-[38px] min-h-[38px] flex items-center justify-center shrink-0"
            aria-label="Open navigation menu"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <div className="relative flex-1 min-w-0">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search files..."
            aria-label="Search files"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#121212] border border-[#262626] text-zinc-100 placeholder-zinc-500 rounded-xl pl-9 pr-3 sm:pr-12 py-2 text-xs focus:outline-none focus:border-zinc-500 transition-colors min-h-[38px] sm:min-h-[40px]"
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 pointer-events-none hidden sm:inline bg-zinc-800/80 border border-zinc-700 px-1.5 py-0.5 rounded">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Right Actions: Upload & Active Provider */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Sync Button */}
        {onSync && (
          <button
            type="button"
            onClick={onSync}
            disabled={isSyncing}
            className="p-2 text-zinc-400 hover:text-white rounded-xl bg-[#121212] border border-[#262626] hover:border-zinc-700 transition-colors min-w-[38px] sm:min-w-[40px] min-h-[38px] sm:min-h-[40px] flex items-center justify-center disabled:opacity-50 shrink-0"
            aria-label="Sync files from Telegram vault"
            title={isSyncing ? "Syncing files..." : "Sync files from Telegram vault"}
          >
            <RotateCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-sky-400' : ''}`} />
          </button>
        )}

        {/* Upload Button */}
        <button
          type="button"
          onClick={onOpenUpload}
          className="bg-white text-black hover:bg-zinc-200 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 sm:gap-2 transition-colors shadow-sm min-h-[38px] sm:min-h-[40px] shrink-0"
        >
          <Upload className="w-4 h-4" />
          <span className="hidden sm:inline">Upload</span>
        </button>

        {/* Provider Tag & Disconnect */}
        <div className="hidden sm:flex items-center gap-2 pl-3 border-l border-[#222]">
          <span className="text-xs text-zinc-400 capitalize font-medium">
            {providerName}
          </span>
          {onDisconnect && (
            <button
              type="button"
              onClick={onDisconnect}
              className="p-2 text-zinc-500 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
              aria-label="Disconnect storage account"
              title="Disconnect storage account"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
