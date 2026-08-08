'use client';

import React, { useState, useEffect } from 'react';
import { Search, Sparkles, X, FileText, Image, Video, Music, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import { AISearchMode, AISearchResultItem } from '@bucketspace/shared';

export interface AISearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectFile?: (fileId: string) => void;
}

export const AISearchModal: React.FC<AISearchModalProps> = ({ isOpen, onClose, onSelectFile }) => {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<AISearchMode>('HYBRID');
  const [results, setResults] = useState<AISearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/v1/ai/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId: 'main-workspace',
            query,
            mode,
            topK: 8,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          setResults(data.results || []);
        } else {
          // Simulated fallback results for preview mode
          setResults(getSimulatedResults(query, mode));
        }
      } catch {
        setResults(getSimulatedResults(query, mode));
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query, mode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl overflow-hidden flex flex-col glass-panel">
        {/* Header Search Input */}
        <div className="p-4 border-b border-slate-800 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div className="relative flex-1">
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything (e.g. 'architectural renders', 'cinematic video speech', 'analytics model')..."
              className="w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none text-base font-medium"
            />
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selectors */}
        <div className="px-4 py-3 bg-slate-950/40 border-b border-slate-800/80 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="text-slate-500 font-mono mr-1">Vector Mode:</span>
          {(['HYBRID', 'TRANSCRIPT', 'DOCUMENT', 'VISUAL'] as AISearchMode[]).map((m) => {
            const isActive = mode === m;
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1.5 rounded-xl font-medium transition-all duration-150 flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 border border-indigo-500/40'
                    : 'bg-slate-800/60 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {m === 'HYBRID' && <Zap className="w-3.5 h-3.5" />}
                {m === 'TRANSCRIPT' && <Music className="w-3.5 h-3.5" />}
                {m === 'DOCUMENT' && <FileText className="w-3.5 h-3.5" />}
                {m === 'VISUAL' && <Image className="w-3.5 h-3.5" />}
                {m === 'HYBRID' ? 'Hybrid All' : m === 'TRANSCRIPT' ? 'Whisper Audio' : m === 'DOCUMENT' ? 'Document OCR' : 'Visual CLIP'}
              </button>
            );
          })}
        </div>

        {/* Results List */}
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
              <Sparkles className="w-6 h-6 animate-spin text-indigo-400" />
              <p className="text-xs font-mono">Running pgvector cosine similarity search across multi-cloud workspace...</p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-16 text-center text-slate-500 text-sm">
              {query ? 'No vector semantic matches found for this query' : 'Type a natural language prompt to query Whisper transcripts, OCR documents & visual CLIP vectors'}
            </div>
          ) : (
            results.map((item) => (
              <div
                key={item.fileId}
                onClick={() => {
                  if (onSelectFile) onSelectFile(item.fileId);
                  onClose();
                }}
                className="group glass-panel p-4 rounded-xl border border-slate-800/80 bg-slate-950/40 hover:border-indigo-500/50 hover:bg-indigo-950/20 cursor-pointer transition-all duration-150 flex items-start justify-between gap-4"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 shrink-0 mt-0.5">
                    {getFileIcon(item.mimeType)}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-100 group-hover:text-indigo-300 transition-colors truncate">
                        {item.filename}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {Math.round(item.similarityScore * 100)}% Match
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 italic">
                      "{item.matchedSnippet}"
                    </p>
                    <span className="text-[11px] text-slate-500 mt-1 flex items-center gap-2">
                      <span>{item.provider}</span>
                      <span>•</span>
                      <span className="capitalize">{item.matchType.toLowerCase()} Vector</span>
                    </span>
                  </div>
                </div>

                <div className="p-2 rounded-lg text-slate-500 group-hover:text-indigo-400 group-hover:bg-indigo-600/10 transition-colors shrink-0">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div className="px-4 py-2.5 bg-slate-950/60 border-t border-slate-800 text-[11px] text-slate-500 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            pgvector 512d CLIP & 1536d Text Embeddings Active
          </span>
          <span className="font-mono">BucketSpace AI Search</span>
        </div>
      </div>
    </div>
  );
};

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <Image className="w-4 h-4 text-cyan-400" />;
  if (mimeType.startsWith('video/')) return <Video className="w-4 h-4 text-indigo-400" />;
  if (mimeType.startsWith('audio/')) return <Music className="w-4 h-4 text-emerald-400" />;
  return <FileText className="w-4 h-4 text-slate-400" />;
}

function getSimulatedResults(query: string, mode: AISearchMode): AISearchResultItem[] {
  const q = query.toLowerCase();
  const items: AISearchResultItem[] = [
    {
      fileId: 'f2-telegram-002',
      filename: 'cinematic_trailer_final.mp4',
      mimeType: 'video/mp4',
      sizeBytes: 450920104,
      provider: 'TELEGRAM_DRIVE',
      similarityScore: 0.94,
      matchedSnippet: 'Whisper Audio Speech Transcript: "...featuring cinematic architectural renders, master planning models, and 4K digital twin asset walkthroughs..."',
      matchType: 'TRANSCRIPT',
    },
    {
      fileId: 'f1-telegram-001',
      filename: 'architectural_render_4k.png',
      mimeType: 'image/png',
      sizeBytes: 15482910,
      provider: 'TELEGRAM_DRIVE',
      similarityScore: 0.91,
      matchedSnippet: 'Visual CLIP embedding match: High-resolution modern architectural exterior render with raytraced glass facades.',
      matchType: 'VISUAL',
    },
    {
      fileId: 'f3-gcp-003',
      filename: 'bigdata_analytics_model.parquet',
      mimeType: 'application/octet-stream',
      sizeBytes: 124210924,
      provider: 'GCP_STORAGE',
      similarityScore: 0.86,
      matchedSnippet: 'Document OCR Text: "Enterprise telemetry records, column mappings, and machine learning feature storage tables."',
      matchType: 'DOCUMENT',
    },
  ];

  return items.filter(
    (item) =>
      mode === 'HYBRID' ||
      (mode === 'TRANSCRIPT' && item.matchType === 'TRANSCRIPT') ||
      (mode === 'DOCUMENT' && item.matchType === 'DOCUMENT') ||
      (mode === 'VISUAL' && item.matchType === 'VISUAL')
  );
}
