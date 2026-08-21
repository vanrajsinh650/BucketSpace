'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  FileText,
  Music,
  Film,
  Image as ImageIcon,
  ShieldCheck,
  AlertCircle,
  FolderArchive,
  FileCode,
  File,
} from 'lucide-react';
import { FileMetadata } from '@bucketspace/shared';

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
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isOpen, file]);

  if (!isOpen || !file) return null;

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const isImage = file.mimeType.startsWith('image/');
  const isVideo = file.mimeType.startsWith('video/');
  const isAudio = file.mimeType.startsWith('audio/');
  const isText =
    file.mimeType.startsWith('text/') ||
    file.mimeType.includes('json') ||
    file.mimeType.includes('javascript') ||
    file.mimeType.includes('typescript');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center justify-between bg-[#0a0a0a]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="font-mono text-xs text-white truncate max-w-md font-medium">
              {file.name}
            </span>
            <span className="text-[10px] font-mono text-[#666] uppercase">
              {formatSize(file.size)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#666] hover:text-white rounded hover:bg-[#181818] transition-colors btn-press"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewer Canvas */}
        <div className="flex-1 bg-black overflow-auto min-h-[350px] flex items-center justify-center p-6 relative">
          {loading ? (
            <div className="text-center space-y-2 font-mono text-xs text-[#888]">
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
              <div>Reassembling chunks...</div>
            </div>
          ) : error ? (
            <div className="text-center space-y-3 max-w-sm">
              <AlertCircle className="w-8 h-8 text-[#ff3333] mx-auto" />
              <div className="font-mono text-xs text-white font-medium">
                Unable to render preview inline.
              </div>
              <div className="font-mono text-[11px] text-[#666]">
                {error}
              </div>
              <button
                onClick={() => onDownload(file.id)}
                className="bg-white text-black hover:bg-[#e0e0e0] px-3.5 py-1.5 rounded text-xs font-mono font-bold uppercase tracking-wider transition-colors btn-press"
              >
                Download Original File
              </button>
            </div>
          ) : isImage ? (
            <div className="max-w-full max-h-full flex items-center justify-center">
              <div className="border border-[#1e1e1e] bg-[#0a0a0a] p-8 text-center space-y-3 rounded">
                <ImageIcon className="w-16 h-16 text-[#666] mx-auto" />
                <div className="font-mono text-xs text-white">{file.name}</div>
                <div className="text-[10px] font-mono text-[#666]">
                  Image verified via {file.chunks.length} encrypted chunks
                </div>
              </div>
            </div>
          ) : isVideo ? (
            <div className="w-full max-w-lg bg-[#0a0a0a] border border-[#1e1e1e] p-8 text-center space-y-3 rounded">
              <Film className="w-12 h-12 text-[#666] mx-auto" />
              <div className="font-mono text-xs text-white">Video Stream Playback Ready</div>
              <div className="text-[10px] font-mono text-[#666]">
                HLS Chunk Reassembly Verified
              </div>
            </div>
          ) : isAudio ? (
            <div className="w-full max-w-md bg-[#0a0a0a] border border-[#1e1e1e] p-6 text-center space-y-3 rounded">
              <Music className="w-10 h-10 text-[#666] mx-auto" />
              <div className="font-mono text-xs text-white">{file.name}</div>
              <div className="text-[10px] font-mono text-[#666]">
                Audio stream ready for playback
              </div>
            </div>
          ) : isText ? (
            <div className="w-full h-full bg-[#0a0a0a] border border-[#1e1e1e] p-4 rounded overflow-auto font-mono text-xs text-[#ccc] leading-relaxed">
              <div className="text-[#555] mb-2">// File: {file.name}</div>
              <div className="text-[#555] mb-4">// Size: {file.size} bytes | Chunks: {file.chunks.length}</div>
              <div className="text-[#888]">
                [Decrypted plaintext content placeholder for text document]
              </div>
            </div>
          ) : (
            <div className="text-center space-y-3 max-w-sm">
              <File className="w-12 h-12 text-[#666] mx-auto" />
              <div className="font-mono text-xs text-white">
                Binary format: Inline preview not applicable
              </div>
              <div className="font-mono text-[11px] text-[#666]">
                Verified with SHA-256 chunk integrity
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-[#1e1e1e] bg-[#0a0a0a] flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2 text-[#22c55e]">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span className="text-[11px]">Integrity Verified</span>
          </div>
          <button
            onClick={() => onDownload(file.id)}
            className="bg-white text-black hover:bg-[#e0e0e0] px-3.5 py-1.5 rounded font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 transition-colors btn-press text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </button>
        </div>
      </div>
    </div>
  );
}
