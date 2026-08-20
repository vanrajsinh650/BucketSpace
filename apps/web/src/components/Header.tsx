'use client';

import React from 'react';
import { Search, Upload, ShieldCheck, LogOut, Menu } from 'lucide-react';
import { motion } from 'framer-motion';

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
    <header className="h-16 lg:h-18 border-b border-zinc-800/90 bg-black/90 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 flex items-center justify-between gap-3">
      {/* Left: Mobile Menu Trigger + Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white"
            aria-label="Open Navigation"
          >
            <Menu className="w-4 h-4" />
          </button>
        )}

        <div className="relative flex-1 group">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none group-focus-within:text-white transition-colors" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-800 text-zinc-200 placeholder-zinc-500 rounded-xl pl-9 pr-14 py-2 text-xs sm:text-sm focus:outline-none focus:border-zinc-500 focus:bg-zinc-800 transition-all"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none hidden sm:block">
            <kbd>⌘K</kbd>
          </div>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Storage Provider Status Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300">
          <ShieldCheck className="w-3.5 h-3.5 text-zinc-300" />
          <span className="font-mono text-white text-[11px]">{providerName}</span>
        </div>

        {/* Upload Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.96 }}
          onClick={onOpenUpload}
          className="flex items-center gap-1.5 px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-white text-black font-semibold text-xs sm:text-sm transition-colors shadow-sm"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Upload</span>
        </motion.button>

        {/* Disconnect/Logout Button */}
        {onDisconnect && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onDisconnect}
            title="Disconnect or switch storage account"
            className="flex items-center gap-1.5 px-2.5 py-2 sm:px-3 sm:py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 border border-zinc-800 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </motion.button>
        )}
      </div>
    </header>
  );
}
