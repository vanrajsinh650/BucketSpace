'use client';

import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  durationMs?: number;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastCard({
  toast,
  onDismiss,
}: {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    const duration = toast.durationMs ?? (toast.type === 'error' ? 6000 : 4000);
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, duration);
    return () => clearTimeout(timer);
  }, [toast, onDismiss]);

  const isError = toast.type === 'error';
  const isSuccess = toast.type === 'success';

  return (
    <div
      role={isError ? 'alert' : 'status'}
      className="pointer-events-auto flex items-start gap-3 p-3.5 bg-[#141414] border border-[#262626] text-zinc-100 rounded-xl shadow-2xl shadow-black/80 backdrop-blur-md transition-all animate-in fade-in slide-in-from-bottom-2"
    >
      <div className="shrink-0 mt-0.5">
        {isSuccess && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
        {isError && <AlertCircle className="w-4 h-4 text-rose-400" />}
        {!isSuccess && !isError && <Info className="w-4 h-4 text-zinc-400" />}
      </div>

      <div className="flex-1 text-xs text-zinc-200 leading-relaxed font-sans pr-1 select-none">
        {toast.message}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 p-1 text-zinc-500 hover:text-zinc-200 transition-colors rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 min-w-[28px] min-h-[28px] flex items-center justify-center -mr-1 -mt-1"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
