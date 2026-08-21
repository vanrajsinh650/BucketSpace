'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RootError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('BucketSpace Unhandled Runtime Error:', error);
  }, [error]);

  return (
    <div className="min-h-screen w-full bg-[#050505] text-[#e0e0e0] font-mono flex items-center justify-center p-6 select-none">
      <div className="max-w-md w-full border border-[#1e1e1e] bg-[#0a0a0a] rounded-lg p-6 space-y-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded bg-red-950/40 border border-red-900/50 text-red-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wider uppercase text-white">System Error Occurred</h1>
            <p className="text-[11px] text-[#777] font-mono">Workspace execution halted</p>
          </div>
        </div>

        <div className="bg-[#111] border border-[#1e1e1e] rounded p-3 text-xs text-[#aaa] font-mono break-all max-h-32 overflow-y-auto">
          {error.message || 'An unexpected runtime error occurred while rendering the workspace.'}
          {error.digest && (
            <div className="mt-2 text-[10px] text-[#555]">Digest: {error.digest}</div>
          )}
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            onClick={() => reset()}
            className="flex-1 py-2 px-3 bg-white text-black hover:bg-[#e0e0e0] rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors btn-press"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Operation</span>
          </button>
          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.location.href = '/';
              }
            }}
            className="py-2 px-3 border border-[#222] hover:border-[#444] text-[#888] hover:text-white rounded text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors btn-press"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Reload</span>
          </button>
        </div>
      </div>
    </div>
  );
}
