'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { humanizeError } from '../lib/humanize-error';

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
      <body className="bg-[#0a0a0a] text-zinc-100 font-sans min-h-screen flex items-center justify-center p-6 select-none">
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
              <h1 className="text-sm font-semibold text-zinc-100">Application Error</h1>
              <p className="text-xs text-zinc-400 mt-0.5">BucketSpace encountered an issue</p>
            </div>
          </div>

          <div className="bg-[#161616] border border-[#262626] rounded-xl p-3.5 text-xs text-zinc-300 leading-relaxed break-words max-h-36 overflow-y-auto">
            {humanizeError(error)}
            {error.digest && (
              <div className="mt-2 text-[10px] font-mono text-zinc-500">Error ID: {error.digest}</div>
            )}
          </div>

          <button
            type="button"
            onClick={() => reset()}
            className="w-full py-2.5 px-4 bg-white text-zinc-950 hover:bg-zinc-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors min-h-[44px]"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Reload Application</span>
          </button>
        </div>
      </body>
    </html>
  );
}
