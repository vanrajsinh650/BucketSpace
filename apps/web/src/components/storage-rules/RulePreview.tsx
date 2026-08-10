'use client';

import React, { useState } from 'react';
import { CheckCircle2, Eye, HelpCircle, X, XCircle } from 'lucide-react';
import { ConditionField, ConditionOperator, RuleCondition, StorageRule } from '@bucketspace/shared';
import { StoragePolicyEngine } from '@bucketspace/storage-adapters';

interface RulePreviewProps {
  rules: StorageRule[];
  defaultProviderId: string;
  onClose: () => void;
}

export function RulePreview({ rules, defaultProviderId, onClose }: RulePreviewProps) {
  const [testName, setTestName] = useState('vacation.jpg');
  const [testMime, setTestMime] = useState('image/jpeg');
  const [testSizeMb, setTestSizeMb] = useState('2.5');

  const engine = new StoragePolicyEngine();
  const sizeInBytes = Math.round((parseFloat(testSizeMb) || 0) * 1024 * 1024);

  const evaluation = engine.evaluate(
    rules,
    { name: testName, mimeType: testMime, size: sizeInBytes },
    defaultProviderId
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fadeIn">
      <div
        className="w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 border border-slate-700/80"
        style={{ backgroundColor: '#0d1117' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-white">Rule Tester & Preview</h3>
              <p className="text-xs text-slate-400">Simulate routing before uploading</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1">File Name</label>
            <input
              type="text"
              value={testName}
              onChange={(e) => setTestName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1">MIME Type</label>
            <input
              type="text"
              value={testMime}
              onChange={(e) => setTestMime(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500/50"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 font-medium block mb-1">Size (MB)</label>
            <input
              type="number"
              value={testSizeMb}
              onChange={(e) => setTestSizeMb(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white focus:outline-none focus:border-cyan-500/50"
            />
          </div>
        </div>

        {/* Evaluation Output Result */}
        <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">
              Evaluation Result
            </span>
            <span className="text-xs font-mono text-cyan-400">
              Selected Storage: <strong className="text-white">{evaluation.providerId}</strong>
            </span>
          </div>

          {evaluation.matched ? (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Matched Rule: {evaluation.rule?.name}
                </span>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">
                  Priority {evaluation.rule?.priority}
                </span>
              </div>

              {/* Conditions Breakdown */}
              <div className="space-y-1 pt-1 border-t border-emerald-500/20 text-xs">
                {evaluation.matchedConditions?.map((mc, idx) => (
                  <div key={idx} className="flex items-center justify-between text-slate-300">
                    <span>
                      {mc.condition.field} {mc.condition.operator} &quot;{mc.condition.value}&quot;
                    </span>
                    {mc.passed ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Pass
                      </span>
                    ) : (
                      <span className="text-rose-400 font-semibold flex items-center gap-1">
                        <XCircle className="w-3 h-3" /> Fail
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center gap-2 text-xs text-slate-300">
              <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
              <span>No rule matched. Falling back to default provider ({defaultProviderId}).</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
