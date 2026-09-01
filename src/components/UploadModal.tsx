'use client';

import React, { useState, useRef } from 'react';
import { X, Upload, File, CheckCircle2, AlertCircle } from 'lucide-react';
import { UploadProgressState } from '../lib/storage-store';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadFile: (file: File) => Promise<void>;
  uploadState: UploadProgressState | null;
}

export function UploadModal({
  isOpen,
  onClose,
  onUploadFile,
  uploadState,
}: UploadModalProps) {
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onUploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      onUploadFile(e.target.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-mono text-xs">
      <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg w-full max-w-lg flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-[#1e1e1e] flex items-center justify-between bg-[#0a0a0a]">
          <span className="font-bold uppercase tracking-wider text-white">
            Upload File
          </span>
          <button
            onClick={onClose}
            className="p-1 text-[#666] hover:text-white rounded hover:bg-[#181818] transition-colors btn-press"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleChange}
            className="hidden"
          />

          {!uploadState ? (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border border-dashed p-10 text-center rounded-lg cursor-pointer transition-colors ${
                dragActive
                  ? 'border-white bg-[#181818]'
                  : 'border-[#333] hover:border-[#666] bg-[#121212]'
              }`}
            >
              <Upload className="w-8 h-8 text-[#888] mx-auto mb-3" />
              <div className="text-white font-medium mb-1">
                Drop file here or click to browse
              </div>
              <div className="text-[11px] text-[#666]">
                Chunked, encrypted, and distributed automatically
              </div>
            </div>
          ) : (
            <div className="bg-[#121212] border border-[#1e1e1e] p-4 rounded space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-white font-medium truncate max-w-[200px]">
                  {uploadState.fileName}
                </span>
                <span className="text-white font-bold tabular-nums">
                  {uploadState.percent}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="h-1.5 bg-[#222] rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-200"
                  style={{ width: `${uploadState.percent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-[#666]">
                <span>Stage: {uploadState.status}</span>
                <span>Chunk {uploadState.currentChunk} / {uploadState.totalChunks}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
