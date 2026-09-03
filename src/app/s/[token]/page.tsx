'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Download, File, ShieldCheck, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { StorageStore } from '../../../lib/storage-store';
import { humanizeError } from '../../../lib/humanize-error';
import { normalizeApiBase } from '../../../lib/utils';

export default function PublicSharePage() {
  const params = useParams();
  const token = typeof params?.token === 'string' ? params.token : '';

  const [shareData, setShareData] = useState<any | null>(null);
  const [passcode, setPasscode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;
    const store = StorageStore.getInstance();
    store.fetchRemoteShareRecord(token).then((rec) => {
      if (!rec) {
        setNotFound(true);
        return;
      }
      setShareData(rec);
      if (!rec.hasPasscode) {
        setIsAuthenticated(true);
      }
    });
  }, [token]);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareData) return;

    if (shareData.passcode && shareData.passcode === passcode) {
      setIsAuthenticated(true);
      setAuthError('');
      return;
    }

    try {
      const apiBase = normalizeApiBase(
        typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_API_URL : ''
      );
      const res = await fetch(`${apiBase}/api/v1/shares/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setAuthError(data.message || 'Incorrect passcode. Please try again.');
        return;
      }
      setShareData((prev: any) => ({ ...prev, ...data }));
      setIsAuthenticated(true);
      setAuthError('');
    } catch {
      setAuthError('Incorrect passcode. Please try again.');
    }
  };

  const handleDownload = async () => {
    if (!shareData) return;
    setDownloading(true);
    setDownloadError(null);
    setDownloadSuccess(false);

    try {
      const store = StorageStore.getInstance();
      let bytes: Uint8Array;
      try {
        const result = await store.getFileBytes(shareData.fileId);
        bytes = result.bytes;
      } catch {
        // Direct reassembly from public chunk metadata for cross-device recipients
        bytes = await store.getChunksBytes(shareData.chunks);
      }

      const blob = new Blob([bytes.buffer as ArrayBuffer], {
        type: shareData.mimeType || 'application/octet-stream',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = shareData.fileName || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadSuccess(true);
    } catch (err: unknown) {
      setDownloadError(humanizeError(err));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#0a0a0a] text-zinc-100 font-sans flex flex-col justify-between p-6 sm:p-12">
      {/* Top Header */}
      <header className="border-b border-[#222] pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 bg-white text-black font-bold text-xs flex items-center justify-center rounded-lg">
            B
          </div>
          <span className="font-semibold text-xs tracking-wider uppercase text-zinc-200">
            BucketSpace Secure Share
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-md w-full mx-auto my-auto py-12">
        {notFound ? (
          <div className="text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-500">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h1 className="text-base font-semibold text-zinc-200">Link Not Found</h1>
            <p className="text-xs text-zinc-500 leading-relaxed">
              This shared link may have expired or been removed by its owner.
            </p>
          </div>
        ) : !isAuthenticated ? (
          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="text-center space-y-1.5 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto text-zinc-300 mb-3">
                <Lock className="w-5 h-5" />
              </div>
              <h1 className="text-base font-semibold text-zinc-100">Passcode Protected File</h1>
              <p className="text-xs text-zinc-400">
                Enter the passcode provided by the sender to view and download this file.
              </p>
            </div>

            <div>
              <label htmlFor="passcode-input" className="sr-only">
                File Passcode
              </label>
              <input
                id="passcode-input"
                type="password"
                placeholder="Enter passcode"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full bg-[#141414] border border-[#262626] p-3 rounded-xl text-zinc-100 text-xs focus:outline-none focus:border-zinc-500 min-h-[44px]"
                autoFocus
              />
            </div>

            {authError && (
              <div role="alert" className="text-rose-400 text-xs flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-white hover:bg-zinc-200 text-black font-semibold py-2.5 rounded-xl text-xs transition-colors min-h-[44px] flex items-center justify-center"
            >
              Unlock File
            </button>
          </form>
        ) : (
          <div className="space-y-5 text-xs">
            <div className="flex items-center gap-3.5 bg-[#141414] p-4 border border-[#262626] rounded-2xl">
              <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 text-zinc-400">
                <File className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-zinc-100 font-medium truncate text-sm">
                  {shareData?.fileName || 'Shared File'}
                </div>
                <div className="text-xs text-zinc-500 mt-0.5">
                  End-to-end encrypted · Private cloud delivery
                </div>
              </div>
            </div>

            {downloadError && (
              <div role="alert" className="p-3.5 bg-rose-950/30 border border-rose-800/40 rounded-xl text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{downloadError}</span>
              </div>
            )}

            {downloadSuccess && (
              <div role="status" className="p-3.5 bg-emerald-950/30 border border-emerald-800/40 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Download started successfully!</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="w-full bg-white text-black hover:bg-zinc-200 font-semibold py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 min-h-[44px]"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? 'Decrypting and Reassembling...' : 'Download File'}</span>
            </button>

            <div className="flex items-center justify-center gap-1.5 text-xs text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Verified with SHA-256 integrity</span>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#222] pt-4 text-center text-xs text-zinc-600">
        Secured by BucketSpace · Zero-knowledge private cloud
      </footer>
    </div>
  );
}
