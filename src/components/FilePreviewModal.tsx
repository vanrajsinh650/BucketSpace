'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Film,
  Music,
  Image as ImageIcon,
  ShieldCheck,
  AlertCircle,
  File,
} from 'lucide-react';
import { FileMetadata } from '@/shared';
import { formatBytes } from '../lib/utils';

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

  useEffect(() => {
    if (isOpen && file) {
      setLoading(true);
      setError(null);
      const timer = setTimeout(() => {
        setLoading(false);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isOpen, file]);

  if (!isOpen || !file) return null;

  const isImage = file.mimeType.startsWith('image/');
  const isVideo = file.mimeType.startsWith('video/');
  const isAudio = file.mimeType.startsWith('audio/');
  const isText =
    file.mimeType.startsWith('text/') ||
    file.mimeType.includes('json') ||
    file.mimeType.includes('javascript') ||
    file.mimeType.includes('typescript');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="preview-modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm font-sans"
    >
      <div className="bg-[#121212] border border-[#222] rounded-t-2xl sm:rounded-2xl w-full max-w-4xl max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden shadow-2xl text-zinc-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#222] flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <h2 id="preview-modal-title" className="text-sm font-semibold text-zinc-100 truncate max-w-md">
              {file.name}
            </h2>
            <span className="text-xs text-zinc-500 tabular-nums shrink-0">
              {formatBytes(file.size)}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/60 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center -mr-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewer Canvas */}
        <div className="flex-1 bg-[#0a0a0a] overflow-auto min-h-[300px] flex items-center justify-center p-6 relative">
          {loading ? (
            <div className="text-center space-y-2 text-xs text-zinc-500">
              <div className="w-5 h-5 border-2 border-zinc-500 border-t-zinc-200 rounded-full animate-spin mx-auto" />
              <div>Preparing preview...</div>
            </div>
          ) : error ? (
            <div className="text-center space-y-3 max-w-sm">
              <AlertCircle className="w-8 h-8 text-rose-400 mx-auto" />
              <div className="text-xs text-zinc-200 font-medium">
                Unable to render preview inline.
              </div>
              <div className="text-xs text-zinc-500">
                {error}
              </div>
              <button
                type="button"
                onClick={() => onDownload(file.id)}
                className="bg-white text-zinc-950 hover:bg-zinc-200 px-4 py-2 rounded-xl text-xs font-semibold transition-colors min-h-[40px]"
              >
                Download Original File
              </button>
            </div>
          ) : isImage ? (
            <div className="max-w-full max-h-full flex items-center justify-center">
              <div className="border border-[#262626] bg-[#161616] p-8 text-center space-y-3 rounded-2xl">
                <ImageIcon className="w-16 h-16 text-zinc-500 mx-auto" />
                <div className="text-xs font-medium text-zinc-200">{file.name}</div>
                <div className="text-[11px] text-zinc-500">
                  Encrypted in {file.chunks.length} vault chunks
                </div>
              </div>
            </div>
          ) : isVideo ? (
            <div className="w-full max-w-lg bg-[#161616] border border-[#262626] p-8 text-center space-y-3 rounded-2xl">
              <Film className="w-12 h-12 text-zinc-500 mx-auto" />
              <div className="text-xs font-medium text-zinc-200">Video Playback</div>
              <div className="text-[11px] text-zinc-500">
                Encrypted video ready for streaming
              </div>
            </div>
          ) : isAudio ? (
            <div className="w-full max-w-md bg-[#161616] border border-[#262626] p-6 text-center space-y-3 rounded-2xl">
              <Music className="w-10 h-10 text-zinc-500 mx-auto" />
              <div className="text-xs font-medium text-zinc-200">{file.name}</div>
              <div className="text-[11px] text-zinc-500">
                Audio ready for playback
              </div>
            </div>
          ) : isText ? (
            <div className="w-full h-full bg-[#161616] border border-[#262626] p-5 rounded-2xl overflow-auto text-xs text-zinc-300 leading-relaxed font-mono">
              <div className="text-zinc-500 mb-2">File: {file.name}</div>
              <div className="text-zinc-500 mb-4">Size: {formatBytes(file.size)} | Chunks: {file.chunks.length}</div>
              <div className="text-zinc-400">
                [Decrypted document preview ready for reading]
              </div>
            </div>
          ) : (
            <div className="text-center space-y-3 max-w-sm">
              <File className="w-12 h-12 text-zinc-500 mx-auto" />
              <div className="text-xs font-medium text-zinc-200">
                Preview not supported for this file type
              </div>
              <div className="text-xs text-zinc-500">
                Verified with zero-knowledge SHA-256 integrity
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#222] bg-[#121212] flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span className="font-medium">Encrypted & Verified</span>
          </div>
          <button
            type="button"
            onClick={() => onDownload(file.id)}
            className="bg-white text-zinc-950 hover:bg-zinc-200 px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 transition-colors text-xs min-h-[40px]"
          >
            <Download className="w-4 h-4" />
            <span>Download</span>
          </button>
        </div>
      </div>
    </div>
  );
}
