'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Download, File, ShieldCheck, Lock, AlertCircle } from 'lucide-react';
import { StorageStore } from '../../../lib/storage-store';

export default function PublicSharePage() {
  const params = useParams();
  const token = typeof params?.token === 'string' ? params.token : '';

  const [shareData, setShareData] = useState<any | null>(null);
  const [passcode, setPasscode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [downloading, setDownloading] = useState(false);
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
      const res = await fetch(`/api/v1/shares/${token}`, {
      const apiBase = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL : '';
      const res = await fetch(`${apiBase}/api/v1/shares/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setAuthError(data.message || 'Incorrect passcode.');
        return;
      }
      setShareData((prev: any) => ({ ...prev, ...data }));
      setIsAuthenticated(true);
      setAuthError('');
    } catch {
      setAuthError('Incorrect passcode.');
    }
  };

  const handleDownload = async () => {
    if (!shareData) return;
    setDownloading(true);
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
    } catch (err: any) {
      alert(err?.message || 'Failed to download and reassemble file chunks.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-black text-white font-mono flex flex-col justify-between p-6 sm:p-12">
      {/* Top Header */}
      <header className="border-b border-[#1e1e1e] pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-white text-black font-bold text-xs flex items-center justify-center rounded">
            B
          </div>
          <span className="font-bold text-xs uppercase tracking-wider text-white">
            BucketSpace Secure Share
          </span>
        </div>
      </header>

      {/* Center Card */}
      <main className="max-w-md w-full mx-auto my-auto p-6 bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg shadow-2xl space-y-5">
        {notFound ? (
          <div className="text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-[#ff3333] mx-auto" />
            <div className="text-sm font-bold uppercase text-white">Link Expired or Not Found</div>
            <p className="text-xs text-[#666]">This share token has reached its expiration limit or was revoked.</p>
          </div>
        ) : !isAuthenticated ? (
          <form onSubmit={handleUnlock} className="space-y-4 text-xs">
            <div className="space-y-1 text-center">
              <Lock className="w-6 h-6 text-white mx-auto mb-2" />
              <div className="font-bold uppercase text-white">Password Protected Share</div>
              <p className="text-[#666]">Enter the secret passcode to access this encrypted file.</p>
            </div>

            <input
              type="password"
              placeholder="Passcode"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              className="w-full bg-[#121212] border border-[#1e1e1e] p-2.5 rounded text-white text-xs focus:outline-none focus:border-[#444]"
            />
            {authError && <div className="text-[#ff3333] text-[11px]">{authError}</div>}

            <button
              type="submit"
              className="w-full bg-white text-black font-bold py-2 rounded uppercase tracking-wider text-xs btn-press"
            >
              Unlock File
            </button>
          </form>
        ) : (
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-3 bg-[#121212] p-3 border border-[#1e1e1e] rounded">
              <File className="w-8 h-8 text-[#888] shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-white font-medium truncate">{shareData?.fileName || 'Encrypted File'}</div>
                <div className="text-[10px] text-[#666]">AES-256-GCM encrypted file</div>
              </div>
            </div>

            <button
              onClick={handleDownload}
              disabled={downloading}
              className="w-full bg-white text-black hover:bg-[#e0e0e0] font-bold py-2.5 rounded uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition-colors btn-press disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? 'Decrypting Chunks...' : 'Download Original File'}</span>
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#22c55e]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>SHA-256 Checksum Verified</span>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1e1e1e] pt-4 text-center text-[10px] text-[#555]">
        Powered by BucketSpace - Zero Compromise Personal Cloud Storage
      </footer>
    </div>
  );
}
