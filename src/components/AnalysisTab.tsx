'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Layers,
  ShieldCheck,
  HardDrive,
  Send,
  Cloud,
  CheckCircle2,
  FileText,
  Play,
  RotateCw,
  Cpu,
  ArrowRight,
  Database,
  Lock,
  Zap,
} from 'lucide-react';
import { FileMetadata } from '@/shared';

interface AnalysisTabProps {
  files: FileMetadata[];
  activeProviderName: string;
}

export function AnalysisTab({ files, activeProviderName }: AnalysisTabProps) {
  const [selectedFileId, setSelectedFileId] = useState<string>(
    files.length > 0 ? files[0].id : ''
  );
  const [activeStep, setActiveStep] = useState<number>(1);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedChunkIndex, setSimulatedChunkIndex] = useState<number>(-1);
  const [simulationComplete, setSimulationComplete] = useState(false);
  const simIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (simIntervalRef.current) {
        clearInterval(simIntervalRef.current);
      }
    };
  }, []);

  const selectedFile = files.find((f) => f.id === selectedFileId) || files[0] || null;

  const handleRunSimulation = () => {
    if (!selectedFile || isSimulating) return;
    setIsSimulating(true);
    setSimulationComplete(false);
    setSimulatedChunkIndex(0);

    const totalChunks = selectedFile.chunks?.length || 3;
    let current = 0;

    if (simIntervalRef.current) {
      clearInterval(simIntervalRef.current);
    }

    simIntervalRef.current = setInterval(() => {
      current++;
      setSimulatedChunkIndex(current);
      if (current >= totalChunks) {
        if (simIntervalRef.current) {
          clearInterval(simIntervalRef.current);
        }
        setIsSimulating(false);
        setSimulationComplete(true);
      }
    }, 350);
  };

  const steps = [
    {
      num: 1,
      title: '5MB Adaptive Chunking',
      desc: 'Files are sliced into deterministic 5MB payloads to bypass single-file limits and enable parallel multi-part ingestion.',
    },
    {
      num: 2,
      title: 'SHA-256 Digest Hashing',
      desc: 'Each chunk is hashed via WebCrypto SHA-256 before transport. Checksums are verified before storing and upon reassembly.',
    },
    {
      num: 3,
      title: 'Telegram MTProto Dispatch',
      desc: 'Chunks are streamed to Telegram cloud storage via MTProto 2.0 with bounded memory slices and checksum verification.',
    },
    {
      num: 4,
      title: 'Zero-Knowledge Reassembly',
      desc: 'Chunks are pulled, verified against canonical digests, decrypted in-memory, and assembled into the original file buffer.',
    },
  ];

  return (
    <div className="space-y-6 font-mono text-xs max-w-5xl">
      {/* Top Header */}
      <div className="border border-[#1e1e1e] bg-[#0a0a0a] p-5 rounded-lg space-y-2">
        <div className="text-[10px] text-[#666] uppercase tracking-widest">
          Cryptographic & Storage Telemetry
        </div>
        <h2 className="text-xl font-bold uppercase tracking-tight text-white font-sans">
          Architecture Inspector
        </h2>
        <p className="text-[#888] text-xs leading-relaxed max-w-2xl font-mono">
          Zero-knowledge chunk verification, multi-datacenter routing topology, and dynamic digest verification workbench.
        </p>
      </div>

      {/* Pipeline Steps Selector */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {steps.map((step) => {
          const isActive = activeStep === step.num;
          return (
            <button
              key={step.num}
              onClick={() => setActiveStep(step.num)}
              className={`p-3 rounded border text-left space-y-1.5 transition-colors btn-press ${
                isActive
                  ? 'border-white bg-[#121212] text-white'
                  : 'border-[#1e1e1e] bg-[#0a0a0a] text-[#888] hover:text-white hover:border-[#333]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#555] uppercase">
                  Step 0{step.num}
                </span>
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
              </div>
              <div className="font-bold text-white uppercase text-[11px] truncate">{step.title}</div>
              <div className="text-[10px] text-[#666] leading-relaxed line-clamp-2">
                {step.desc}
              </div>
            </button>
          );
        })}
      </div>

      {/* Interactive Simulation Console */}
      <div className="border border-[#1e1e1e] bg-[#0a0a0a] rounded-lg p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1e1e1e] pb-3">
          <div className="space-y-0.5">
            <span className="text-[10px] text-[#666] uppercase tracking-wider block">
              Simulation Target
            </span>
            <select
              value={selectedFileId}
              onChange={(e) => setSelectedFileId(e.target.value)}
              className="bg-[#121212] border border-[#1e1e1e] text-white px-2 py-1 rounded text-xs font-mono focus:outline-none"
            >
              {files.map((f) => (
                <option key={f.id} value={f.id} className="bg-black text-white">
                  {f.name} ({f.chunks.length} chunks)
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleRunSimulation}
            disabled={!selectedFile || isSimulating}
            className="bg-white text-black hover:bg-[#e0e0e0] px-4 py-1.5 rounded font-mono font-bold uppercase tracking-wider text-xs transition-colors btn-press flex items-center gap-1.5 disabled:opacity-50"
          >
            <Play className="w-3 h-3" />
            <span>{isSimulating ? 'Verifying Hashes...' : 'Run Pipeline Check'}</span>
          </button>
        </div>

        {/* Selected File Chunks Visualizer */}
        {selectedFile ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px] text-[#888]">
              <span>File ID: {selectedFile.id}</span>
              <span>Total Chunks: {selectedFile.chunks.length}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {selectedFile.chunks.map((chunk, idx) => {
                const isVerifying = isSimulating && simulatedChunkIndex === idx;
                const isVerified = (isSimulating && simulatedChunkIndex > idx) || simulationComplete;
                return (
                  <div
                    key={chunk.id}
                    className={`p-3 rounded border transition-colors ${
                      isVerifying
                        ? 'border-white bg-[#1a1a1a]'
                        : isVerified
                        ? 'border-[#333] bg-[#121212]'
                        : 'border-[#1e1e1e] bg-[#0a0a0a]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-[#666] mb-1">
                      <span>Chunk #{chunk.index}</span>
                      <span className={isVerified ? 'text-[#22c55e]' : isVerifying ? 'text-white' : 'text-[#555]'}>
                        {isVerified ? 'VERIFIED' : isVerifying ? 'HASHING' : 'READY'}
                      </span>
                    </div>
                    <div className="text-white font-mono text-[11px] truncate">
                      {chunk.hash}
                    </div>
                    <div className="text-[10px] text-[#555] mt-1 flex justify-between">
                      <span>{chunk.size} bytes</span>
                      <span className="uppercase">{chunk.providerRef?.providerId || activeProviderName}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-[#555]">No files available for analysis.</div>
        )}
      </div>
    </div>
  );
}
