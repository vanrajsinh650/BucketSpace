'use client';

import React, { useState } from 'react';
import { Eye, X, CheckCircle2 } from 'lucide-react';
import { StorageRule } from '@/shared';
import { StoragePolicyEngine } from '@/modules/storage';

interface RulePreviewProps {
  rules: StorageRule[];
  defaultProviderId: string;
  onClose: () => void;
}

export function RulePreview({ rules, defaultProviderId, onClose }: RulePreviewProps) {
  const [testName, setTestName] = useState('raw_footage.mp4');
  const [testMime, setTestMime] = useState('video/mp4');
  const [testSizeMb, setTestSizeMb] = useState('150');

  const engine = new StoragePolicyEngine();
  const sizeInBytes = Math.round((parseFloat(testSizeMb) || 0) * 1024 * 1024);

  const evaluation = engine.evaluate(
    rules,
    { name: testName, mimeType: testMime, size: sizeInBytes },
    defaultProviderId
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-mono text-xs">
      <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg w-full max-w-md p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1e1e1e] pb-3">
          <div className="flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 text-white" />
            <span className="font-bold uppercase tracking-wider text-white">Rule Tester</span>
          </div>
          <button onClick={onClose} className="p-1 text-[#666] hover:text-white rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] text-[#666] uppercase block">Filename</label>
            <input
              type="text"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              className="w-full bg-[#121212] border border-[#1e1e1e] rounded p-2 text-white text-xs"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-[#666] uppercase block">MIME Type</label>
              <input
                type="text"
                value={testMime}
                onChange={(e) => setTestMime(e.target.value)}
                className="w-full bg-[#121212] border border-[#1e1e1e] rounded p-2 text-white text-xs"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-[#666] uppercase block">Size (MB)</label>
              <input
                type="number"
                value={testSizeMb}
                onChange={(e) => setTestSizeMb(e.target.value)}
                className="w-full bg-[#121212] border border-[#1e1e1e] rounded p-2 text-white text-xs"
              />
            </div>
          </div>

          {/* Result Box */}
          <div className="bg-[#121212] border border-[#1e1e1e] p-3.5 rounded space-y-1.5 mt-2">
            <div className="text-[10px] text-[#666] uppercase">Routing Destination</div>
            <div className="text-sm font-bold text-white uppercase flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#22c55e]" />
              <span>{evaluation.providerId}</span>
            </div>
            <div className="text-[10px] text-[#888]">
              {evaluation.rule
                ? `Matched rule: "${evaluation.rule.name}"`
                : `No custom rule matched. Routed to default provider (${defaultProviderId}).`}
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="bg-white text-black font-bold px-4 py-1.5 rounded uppercase text-xs btn-press"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
