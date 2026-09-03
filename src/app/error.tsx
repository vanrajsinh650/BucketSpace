'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { humanizeError } from '../lib/humanize-error';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('BucketSpace Unhandled Runtime Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] text-zinc-100 font-sans flex items-center justify-center p-6">
      <div
        role="alert"
        aria-live="assertive"
        className="max-w-md w-full border border-[#262626] bg-[#121212] rounded-2xl p-6 space-y-6 shadow-2xl"
      >
        <div className="flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-900/50 text-rose-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-zinc-100">Something went wrong</h1>
            <p className="text-xs text-zinc-400 mt-0.5">The application encountered an unexpected error</p>
          </div>
        </div>

        <div className="bg-[#161616] border border-[#262626] rounded-xl p-3.5 text-xs text-zinc-300 leading-relaxed break-words max-h-36 overflow-y-auto">
          {humanizeError(error)}
          {error.digest && (
            <div className="mt-2 text-[10px] font-mono text-zinc-500">Error ID: {error.digest}</div>
          )}
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={() => reset()}
            className="flex-1 py-2.5 px-4 bg-white hover:bg-zinc-200 text-zinc-950 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors min-h-[44px]"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/';
              }
            }}
            className="py-2.5 px-4 border border-[#262626] hover:border-zinc-600 bg-zinc-900 text-zinc-300 hover:text-white rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-colors min-h-[44px]"
          >
            <Home className="w-4 h-4" />
            <span>Home</span>
          </button>
        </div>
      </div>
    </div>
  );
}
