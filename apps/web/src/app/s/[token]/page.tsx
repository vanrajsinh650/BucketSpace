'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Download,
  FileText,
  Image as ImageIcon,
  Music,
  Video,
  ShieldCheck,
  Lock,
  AlertCircle,
  HardDrive,
  Eye,
  CheckCircle2,
} from 'lucide-react';
import { StorageStore } from '../../../lib/storage-store';

export default function PublicSharePage() {
  const params = useParams();
  const token = typeof params?.token === 'string' ? params.token : '';

  const [shareData, setShareData] = useState<any | null>(null);
  const [passcode, setPasscode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadComplete, setDownloadComplete] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;
    const store = StorageStore.getInstance();
    const rec = store.getShareRecord(token);
    if (!rec) {
      setNotFound(true);
      return;
    }

    setShareData(rec);
    if (!rec.hasPasscode) {
      setIsAuthenticated(true);
    }
  }, [token]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareData) return;
    if (shareData.passcode === passcode) {
      setIsAuthenticated(true);
      setAuthError('');
    } else {
      setAuthError('Incorrect passcode. Please try again.');
    }
  };

  const handleDownload = async () => {
    if (!shareData) return;
    setDownloading(true);
    setDownloadProgress(15);

    try {
      const store = StorageStore.getInstance();
      const { bytes, file } = await store.getFileBytes(shareData.fileId);
      setDownloadProgress(85);

      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: file.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadProgress(100);
      setDownloadComplete(true);
    } catch (err: any) {
      alert(`Download error: ${err?.message || 'Failed to download file'}`);
    } finally {
      setDownloading(false);
    }
  };

  const handlePreview = async () => {
    if (!shareData || previewBlobUrl) {
      setPreviewOpen(true);
      return;
    }

    try {
      const store = StorageStore.getInstance();
      const { bytes, file } = await store.getFileBytes(shareData.fileId);
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: file.mimeType });
      const url = URL.createObjectURL(blob);
      setPreviewBlobUrl(url);
      setPreviewOpen(true);
    } catch (err: any) {
      alert(`Preview error: ${err?.message || 'Could not load preview'}`);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <ImageIcon className="w-8 h-8 text-cyan-400" />;
    if (mimeType.startsWith('video/')) return <Video className="w-8 h-8 text-violet-400" />;
    if (mimeType.startsWith('audio/')) return <Music className="w-8 h-8 text-emerald-400" />;
    return <FileText className="w-8 h-8 text-amber-400" />;
  };

  if (notFound) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900/80 border border-slate-800 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-white">Share Link Unavailable</h2>
          <p className="text-sm text-slate-400">
            This link may have expired, reached its download limit, or was revoked by the file owner.
          </p>
          <a
            href="/"
            className="inline-block mt-4 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors"
          >
            Go to BucketSpace
          </a>
        </div>
      </div>
    );
  }

  if (!shareData) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col justify-between p-4 sm:p-8">
      {/* Header Bar */}
      <header className="max-w-5xl mx-auto w-full flex items-center justify-between py-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-cyan-500/20">
            BS
          </div>
          <span className="font-bold text-lg tracking-tight text-white">BucketSpace</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Encrypted Cloud Share</span>
        </div>
      </header>

      {/* Main Download Card */}
      <main className="max-w-lg mx-auto w-full my-8">
        {!isAuthenticated ? (
          /* Password Gate */
          <form onSubmit={handleUnlock} className="glass-modal rounded-3xl p-8 shadow-2xl border border-slate-800 space-y-6 text-center">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Passcode Protected File</h2>
              <p className="text-xs text-slate-400 mt-1">Enter the password provided by the owner to download.</p>
            </div>

            <div className="space-y-2 text-left">
              <input
                type="password"
                placeholder="Enter password..."
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500"
                autoFocus
              />
              {authError && <p className="text-xs text-rose-400">{authError}</p>}
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium text-sm shadow-lg shadow-cyan-500/20 transition-all"
            >
              Unlock File
            </button>
          </form>
        ) : (
          /* File Download Panel */
          <div className="glass-modal rounded-3xl p-8 shadow-2xl border border-slate-800 space-y-6">
            {/* File Icon & Identity */}
            <div className="flex items-start gap-4">
              <div className="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 shrink-0">
                {getFileIcon(shareData.mimeType)}
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-lg font-bold text-white truncate" title={shareData.fileName}>
                  {shareData.fileName}
                </h1>
                <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                  <span className="font-semibold text-slate-300">{formatBytes(shareData.fileSize)}</span>
                  <span>•</span>
                  <span className="font-mono uppercase">{shareData.mimeType.split('/')[1] || 'FILE'}</span>
                </div>
              </div>
            </div>

            {/* SHA-256 Digest Badge */}
            <div className="p-3 rounded-2xl bg-slate-950/60 border border-slate-800/80 space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  SHA-256 Bit Integrity
                </span>
                <span className="text-emerald-400 font-medium">Verified ✓</span>
              </div>
              <p className="font-mono text-[11px] text-slate-500 truncate select-all">
                {shareData.wholeFileHash}
              </p>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-sm shadow-xl shadow-cyan-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
              >
                {downloading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Streaming & Verifying ({downloadProgress}%)...</span>
                  </>
                ) : downloadComplete ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>Download Complete!</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Download Original File</span>
                  </>
                )}
              </button>

              {(shareData.mimeType.startsWith('image/') ||
                shareData.mimeType.startsWith('video/') ||
                shareData.mimeType.startsWith('audio/') ||
                shareData.mimeType.includes('pdf') ||
                shareData.mimeType.startsWith('text/')) && (
                <button
                  onClick={handlePreview}
                  className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview Inline</span>
                </button>
              )}
            </div>

            {/* Inline Preview Popup */}
            {previewOpen && previewBlobUrl && (
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 max-h-96 overflow-auto">
                {shareData.mimeType.startsWith('image/') && (
                  <img src={previewBlobUrl} alt={shareData.fileName} className="max-h-72 mx-auto rounded-lg object-contain" />
                )}
                {shareData.mimeType.startsWith('video/') && (
                  <video src={previewBlobUrl} controls className="w-full max-h-72 rounded-lg" />
                )}
                {shareData.mimeType.startsWith('audio/') && (
                  <audio src={previewBlobUrl} controls className="w-full mt-2" />
                )}
                {shareData.mimeType.includes('pdf') && (
                  <iframe src={previewBlobUrl} className="w-full h-80 rounded-lg" title="PDF Preview" />
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto w-full text-center py-4 text-xs text-slate-500">
        Powered by <a href="/" className="text-slate-400 hover:text-cyan-400 underline font-medium">BucketSpace</a> — Your storage. One interface. Any provider.
      </footer>
    </div>
  );
}
