'use client';

import React, { useEffect, useRef } from 'react';
import { AlertTriangle, HelpCircle, X } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Focus confirm button when opened
    const timer = setTimeout(() => {
      confirmButtonRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm transition-opacity"
    >
      <div
        className="w-full sm:max-w-md bg-[#121212] border border-[#222] rounded-t-2xl sm:rounded-2xl p-6 shadow-2xl shadow-black text-zinc-100 flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-150"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-xl border ${
                isDestructive
                  ? 'bg-rose-950/30 border-rose-900/40 text-rose-400'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300'
              }`}
            >
              {isDestructive ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <HelpCircle className="w-5 h-5" />
              )}
            </div>
            <h2 id="confirm-dialog-title" className="text-base font-semibold text-zinc-100 font-sans">
              {title}
            </h2>
          </div>

          <button
            type="button"
            onClick={onCancel}
            aria-label="Close dialog"
            className="p-1.5 text-zinc-500 hover:text-zinc-200 transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 min-w-[36px] min-h-[36px] flex items-center justify-center -mr-1.5 -mt-1.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p
          id="confirm-dialog-description"
          className="text-xs text-zinc-400 leading-relaxed font-sans"
        >
          {description}
        </p>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-medium text-zinc-300 bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 transition-colors min-h-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
          >
            {cancelLabel}
          </button>

          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            className={`flex-1 sm:flex-initial px-4 py-2.5 rounded-xl text-xs font-medium transition-colors min-h-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-500 text-white focus-visible:ring-rose-400 shadow-lg shadow-rose-950/40'
                : 'bg-zinc-100 hover:bg-white text-zinc-950 font-semibold focus-visible:ring-zinc-300'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

