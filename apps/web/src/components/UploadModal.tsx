'use client';

import React, { useRef, useState } from 'react';
import { CloudUpload, X } from 'lucide-react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onUploadFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-black border border-[#333] p-6 space-y-6 relative">
        <div className="flex items-center justify-between border-b border-[#222] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white text-black flex items-center justify-center font-bold">
              <CloudUpload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white uppercase tracking-wider font-mono">Upload File</h3>
              <p className="text-[11px] text-[#888] font-mono">Client-side chunked & SHA-256 verified</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#666] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!uploadState || uploadState.status === 'COMPLETE' ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border border-dashed p-10 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-white bg-[#151515]'
                : 'border-[#333] hover:border-[#666] bg-[#050505]'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <CloudUpload className="w-8 h-8 text-[#888] mx-auto mb-3" />
            <p className="text-xs font-mono uppercase tracking-wider text-white">
              Drag & Drop file here, or <span className="underline">Browse</span>
            </p>
            <p className="text-[11px] text-[#666] font-mono mt-2">
              Slices file into 5 MB chunks with SHA-256 verification
            </p>
          </div>
        ) : (
          <div className="p-6 bg-[#0a0a0a] border border-[#222] space-y-4">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="font-bold text-white truncate max-w-[240px]">
                {uploadState.fileName}
              </span>
              <span className="text-white font-bold">
                {uploadState.percent}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-[#222] h-2 overflow-hidden">
              <div
                className="bg-white h-full transition-all duration-200"
                style={{ width: `${uploadState.percent}%` }}
              />
            </div>

            {/* Status & Details */}
            <div className="flex items-center justify-between text-[11px] font-mono text-[#888]">
              <div>
                {uploadState.status === 'RESUMING' ? (
                  <span className="text-white">Resuming upload...</span>
                ) : uploadState.status === 'FAILED' ? (
                  <span className="text-red-400">Upload interrupted</span>
                ) : (
                  <span className="uppercase">
                    Status: {uploadState.status.toLowerCase()}
                  </span>
                )}
              </div>
              <span>
                Chunk {uploadState.currentChunk} of {uploadState.totalChunks}
              </span>
            </div>

            {uploadState.status === 'FAILED' && (
              <div className="p-3 border border-red-500/30 bg-red-500/10 text-red-400 text-xs font-mono space-y-2">
                <p>{uploadState.errorMessage || 'Network interrupted. Uploaded chunks are safely preserved.'}</p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2 bg-white text-black font-bold uppercase tracking-wider text-xs"
                >
                  Select File to Resume Upload
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
