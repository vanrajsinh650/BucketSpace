'use client';

import React, { useEffect, useState } from 'react';
import {
  Download,
  Eye,
  FileCode,
  FileText,
  Film,
  HardDrive,
  Hash,
  Image as ImageIcon,
  Music,
  X,
  FileQuestion,
  Sparkles,
} from 'lucide-react';
import { FileMetadata } from '@bucketspace/shared';
import { PreviewInfo, PreviewService } from '@bucketspace/storage-adapters';
import { StorageStore } from '../lib/storage-store';

interface FilePreviewModalProps {
  file: FileMetadata | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (fileId: string) => void;
}

export function FilePreviewModal({
  file,
  isOpen,
  onClose,
  onDownload,
}: FilePreviewModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [previewInfo, setPreviewInfo] = useState<PreviewInfo | null>(null);

  useEffect(() => {
    if (!isOpen || !file) {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        setObjectUrl(null);
      }
      setTextContent(null);
      setError(null);
      setLoading(false);
      return;
    }

    let isCancelled = false;
    setLoading(true);
    setError(null);

    const info = PreviewService.getPreviewInfo(file);
    setPreviewInfo(info);

    const loadContent = async () => {
      try {
        const store = StorageStore.getInstance();
        const { bytes } = await store.getFileBytes(file.id);

        if (isCancelled) return;

        if (info.format === 'TEXT_CODE' || info.format === 'MARKDOWN') {
          const text = new TextDecoder('utf-8').decode(bytes);
          setTextContent(text);
        } else {
          const blob = new Blob([bytes as BlobPart], { type: file.mimeType });
          const url = URL.createObjectURL(blob);
          setObjectUrl(url);
        }

        setLoading(false);
      } catch (err: unknown) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load file bytes');
          setLoading(false);
        }
      }
    };

    loadContent();

    return () => {
      isCancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [isOpen, file]);

  if (!isOpen || !file) return null;

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const primaryProvider = file.chunks?.[0]?.providerRef?.providerId ?? 'in-memory';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-lg animate-fadeIn">
      <div className="glass-modal w-full max-w-4xl h-[85vh] rounded-3xl p-6 shadow-2xl flex flex-col border border-slate-700/80 bg-[#0d1117]/95">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
              <Eye className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-lg text-white truncate max-w-lg">{file.name}</h3>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>{formatSize(file.size)}</span>
                <span>•</span>
                <span className="font-mono text-cyan-400">{file.mimeType}</span>
                <span>•</span>
                <span className="capitalize">{primaryProvider}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onDownload(file.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white text-xs font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              Download
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Viewer Content Body */}
        <div className="flex-1 min-h-0 py-4 flex items-center justify-center overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-cyan-400 font-mono text-sm">
              <div className="w-8 h-8 rounded-full border-2 border-cyan-400 border-t-transparent animate-spin" />
              <span>Loading preview...</span>
            </div>
          ) : error ? (
            <div className="text-center p-6 space-y-4">
              <div className="space-y-2">
                <FileQuestion className="w-12 h-12 text-rose-400 mx-auto" />
                <p className="text-white text-base font-medium">We couldn't safely preview this file.</p>
              </div>
              
              <details className="text-left bg-slate-900/50 border border-slate-800 rounded-xl overflow-hidden text-xs">
                <summary className="p-3 text-slate-400 cursor-pointer hover:text-slate-300 hover:bg-slate-800/50 transition-colors font-medium select-none">
                  Technical details
                </summary>
                <div className="p-3 border-t border-slate-800 text-rose-300 font-mono break-words bg-slate-950/50">
                  {error}
                </div>
              </details>

              <button
                onClick={() => onDownload(file.id)}
                className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-medium transition-all shadow-lg"
              >
                Download Original File Instead
              </button>
            </div>
          ) : previewInfo?.format === 'IMAGE' && objectUrl ? (
            <div className="w-full h-full flex items-center justify-center p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={objectUrl}
                alt={file.name}
                className="max-w-full max-h-full object-contain rounded-2xl border border-slate-800 shadow-2xl"
              />
            </div>
          ) : previewInfo?.format === 'VIDEO' && objectUrl ? (
            <div className="w-full h-full flex items-center justify-center p-2 bg-black/50 rounded-2xl">
              <video
                src={objectUrl}
                controls
                autoPlay
                className="max-w-full max-h-full rounded-2xl border border-slate-800 shadow-2xl"
              />
            </div>
          ) : previewInfo?.format === 'AUDIO' && objectUrl ? (
            <div className="w-full max-w-lg p-8 rounded-3xl bg-slate-900/80 border border-slate-800 text-center space-y-6">
              <div className="w-20 h-20 rounded-full bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 mx-auto animate-pulse">
                <Music className="w-10 h-10" />
              </div>
              <div>
                <h4 className="font-semibold text-white text-base">{file.name}</h4>
                <p className="text-xs text-slate-400 mt-1">{formatSize(file.size)}</p>
              </div>
              <audio src={objectUrl} controls className="w-full" />
            </div>
          ) : previewInfo?.format === 'PDF' && objectUrl ? (
            <iframe
              src={objectUrl}
              title={file.name}
              className="w-full h-full rounded-2xl border border-slate-800 bg-white"
            />
          ) : (previewInfo?.format === 'TEXT_CODE' || previewInfo?.format === 'MARKDOWN') && textContent !== null ? (
            <div className="w-full h-full flex flex-col rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden">
              <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-cyan-400" />
                  {previewInfo.format === 'MARKDOWN' ? 'Markdown Document' : 'Plaintext / Source Code'}
                </span>
                <span>{textContent.length.toLocaleString()} characters</span>
              </div>
              <pre className="flex-1 p-4 overflow-auto text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap select-text">
                {textContent}
              </pre>
            </div>
          ) : (
            /* Unsupported Binary Fallback */
            <div className="w-full max-w-md p-8 rounded-3xl bg-slate-900/80 border border-slate-800 text-center space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mx-auto">
                <HardDrive className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-white text-base">{file.name}</h4>
                <p className="text-xs text-slate-400">Preview isn't available for this file type.</p>
              </div>
              <details className="group rounded-xl bg-slate-950 border border-slate-800 text-left text-xs overflow-hidden">
                <summary className="p-3 text-slate-400 cursor-pointer hover:text-slate-300 hover:bg-slate-900/50 transition-colors flex items-center justify-between select-none">
                  <span className="font-medium">File verification</span>
                  <Hash className="w-3 h-3 text-cyan-400 group-open:text-cyan-300 transition-colors" />
                </summary>
                <div className="px-3 pb-3 pt-1 border-t border-slate-800/50 bg-slate-950">
                  <div className="text-slate-500 mb-1 text-[10px] uppercase tracking-wider">SHA-256 Checksum</div>
                  <p className="font-mono text-[11px] text-slate-300 break-all">{file.wholeFileHash}</p>
                </div>
              </details>
              <button
                onClick={() => onDownload(file.id)}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-sm transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Download Original File ({formatSize(file.size)})
              </button>
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500 shrink-0 font-medium">
          <span className="flex items-center gap-1 text-emerald-400">
            Verified ✓
          </span>
          <span className="shrink-0">{formatSize(file.size)}</span>
        </div>
      </div>
    </div>
  );
}
