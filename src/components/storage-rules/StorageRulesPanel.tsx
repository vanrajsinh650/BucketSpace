'use client';

import React, { useState } from 'react';
import { Plus, Sliders, Trash2, X, Eye } from 'lucide-react';
import { StorageRule } from '@/shared';
import { RuleEditor } from './RuleEditor';
import { RulePreview } from './RulePreview';

interface StorageRulesPanelProps {
  rules: StorageRule[];
  availableProviders: string[];
  defaultProviderId: string;
  onSaveRule: (rule: StorageRule) => void;
  onToggleRule: (ruleId: string, enabled: boolean) => void;
  onDeleteRule: (ruleId: string) => void;
  onClose: () => void;
}

export function StorageRulesPanel({
  rules,
  availableProviders,
  defaultProviderId,
  onSaveRule,
  onToggleRule,
  onDeleteRule,
  onClose,
}: StorageRulesPanelProps) {
  const [editingRule, setEditingRule] = useState<StorageRule | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-panel-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-sm font-sans"
    >
      <div className="bg-[#121212] border border-[#222] rounded-t-2xl sm:rounded-2xl w-full max-w-2xl max-h-[90vh] sm:max-h-[85vh] flex flex-col overflow-hidden shadow-2xl text-xs text-zinc-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#222] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Sliders className="w-4 h-4 text-zinc-300" />
            <h2 id="rules-panel-title" className="text-sm font-semibold tracking-wide text-zinc-100">
              Storage Routing Rules
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close rules panel"
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800/60 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center -mr-1.5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">
              Configured Rules ({rules.length})
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(true)}
                className="border border-[#333] hover:border-zinc-500 text-zinc-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors min-h-[36px]"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Test Rules</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="bg-white text-zinc-950 hover:bg-zinc-200 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors min-h-[36px]"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Rule</span>
              </button>
            </div>
          </div>

          {/* Rules List */}
          <div className="space-y-2.5">
            {sortedRules.length === 0 ? (
              <div className="p-8 text-center border border-[#262626] bg-[#161616] rounded-2xl text-zinc-500 text-xs">
                No custom routing rules defined. All files route to the default provider ("{defaultProviderId}").
              </div>
            ) : (
              sortedRules.map((rule) => (
                <div
                  key={rule.id}
                  className="bg-[#161616] border border-[#262626] p-3.5 rounded-xl flex items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-100 font-medium truncate text-xs">{rule.name}</span>
                      <span className="text-[10px] text-zinc-500">
                        Priority: {rule.priority}
                      </span>
                    </div>
                    <div className="text-xs text-zinc-400 truncate">
                      Routes to <span className="text-zinc-200 capitalize font-medium">{rule.action.providerId}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleRule(rule.id, !rule.enabled)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                        rule.enabled
                          ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-850'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                      }`}
                    >
                      {rule.enabled ? 'Active' : 'Disabled'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingRule(rule)}
                      className="border border-[#333] hover:border-zinc-500 text-zinc-300 hover:text-white px-2.5 py-1 rounded-lg text-xs transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteRule(rule.id)}
                      className="text-zinc-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-950/20 transition-colors"
                      title="Delete Rule"
                      aria-label={`Delete rule ${rule.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#222] bg-[#121212] flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-medium text-xs transition-colors min-h-[40px]"
          >
            Done
          </button>
        </div>

        {/* Rule Editor Modal */}
        {(isCreating || editingRule) && (
          <RuleEditor
            rule={editingRule}
            availableProviders={availableProviders}
            onSave={(rule) => {
              onSaveRule(rule);
              setIsCreating(false);
              setEditingRule(null);
            }}
            onClose={() => {
              setIsCreating(false);
              setEditingRule(null);
            }}
          />
        )}

        {/* Rule Preview Modal */}
        {isPreviewOpen && (
          <RulePreview
            rules={rules}
            defaultProviderId={defaultProviderId}
            onClose={() => setIsPreviewOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
