'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('BucketSpace Global Critical Error:', error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="bg-[#050505] text-[#e0e0e0] font-mono min-h-screen flex items-center justify-center p-6 select-none">
        <div className="max-w-md w-full border border-[#1e1e1e] bg-[#0a0a0a] rounded-lg p-6 space-y-6 shadow-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded bg-red-950/40 border border-red-900/50 text-red-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-wider uppercase text-white">Critical System Error</h1>
              <p className="text-[11px] text-[#777] font-mono">Root application tree failure</p>
            </div>
          </div>

          <div className="bg-[#111] border border-[#1e1e1e] rounded p-3 text-xs text-[#aaa] font-mono break-all max-h-32 overflow-y-auto">
            {error.message || 'A fatal system error occurred at the root layout.'}
            {error.digest && (
              <div className="mt-2 text-[10px] text-[#555]">Digest: {error.digest}</div>
            )}
          </div>

          <button
            onClick={() => reset()}
            className="w-full py-2.5 px-4 bg-white text-black hover:bg-[#e0e0e0] rounded text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors btn-press"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Restart Application</span>
          </button>
        </div>
      </body>
    </html>
  );
}
