'use client';

import React, { useState } from 'react';
import { Plus, Sliders, Trash2, X } from 'lucide-react';
import {
  ConditionField,
  ConditionOperator,
  RuleCondition,
  StorageRule,
} from '@bucketspace/shared';

interface RuleEditorProps {
  rule?: StorageRule | null;
  availableProviders: string[];
  onSave: (rule: StorageRule) => void;
  onClose: () => void;
}

export function RuleEditor({ rule, availableProviders, onSave, onClose }: RuleEditorProps) {
  const [name, setName] = useState(rule?.name ?? '');
  const [priority, setPriority] = useState(rule?.priority ?? 10);
  const [targetProviderId, setTargetProviderId] = useState(
    rule?.action.providerId ?? availableProviders[0] ?? 'local-disk'
  );
  const [conditions, setConditions] = useState<RuleCondition[]>(
    rule?.conditions ?? [{ field: 'mimeType', operator: 'startsWith', value: 'image/' }]
  );

  const handleAddCondition = () => {
    setConditions((prev) => [...prev, { field: 'mimeType', operator: 'startsWith', value: '' }]);
  };

  const handleRemoveCondition = (index: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConditionChange = (
    index: number,
    key: keyof RuleCondition,
    val: string
  ) => {
    setConditions((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [key]: val } : c))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newRule: StorageRule = {
      id: rule?.id ?? `rule_${Date.now()}`,
      name: name.trim(),
      enabled: rule?.enabled ?? true,
      priority: Number(priority),
      conditions,
      action: {
        type: 'STORE',
        providerId: targetProviderId,
      },
      createdAt: rule?.createdAt ?? new Date(),
      updatedAt: new Date(),
    };

    onSave(newRule);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-mono text-xs">
      <div className="bg-[#0a0a0a] border border-[#1e1e1e] rounded-lg w-full max-w-lg p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#1e1e1e] pb-3">
          <span className="font-bold uppercase tracking-wider text-white">
            {rule ? 'Edit Rule' : 'New Storage Rule'}
          </span>
          <button onClick={onClose} className="p-1 text-[#666] hover:text-white rounded">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] text-[#666] uppercase block">Rule Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Route Videos to S3"
              className="w-full bg-[#121212] border border-[#1e1e1e] rounded p-2 text-white font-mono text-xs focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-[#666] uppercase block">Target Provider</label>
              <select
                value={targetProviderId}
                onChange={(e) => setTargetProviderId(e.target.value)}
                className="w-full bg-[#121212] border border-[#1e1e1e] rounded p-2 text-white font-mono text-xs focus:outline-none"
              >
                {availableProviders.map((p) => (
                  <option key={p} value={p} className="bg-black text-white uppercase">
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-[#666] uppercase block">Priority (Higher = Evaluated First)</label>
              <input
                type="number"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="w-full bg-[#121212] border border-[#1e1e1e] rounded p-2 text-white font-mono text-xs focus:outline-none"
              />
            </div>
          </div>

          {/* Conditions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-[#666] uppercase">Conditions</label>
              <button
                type="button"
                onClick={handleAddCondition}
                className="text-white hover:underline text-[10px] flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add Condition</span>
              </button>
            </div>

            <div className="space-y-1.5">
              {conditions.map((cond, idx) => (
                <div key={idx} className="flex items-center gap-1.5 bg-[#121212] p-1.5 rounded border border-[#1e1e1e]">
                  <select
                    value={cond.field}
                    onChange={(e) => handleConditionChange(idx, 'field', e.target.value as ConditionField)}
                    className="bg-transparent text-white text-[11px] focus:outline-none"
                  >
                    <option value="mimeType" className="bg-black text-white">MIME</option>
                    <option value="extension" className="bg-black text-white">Extension</option>
                    <option value="size" className="bg-black text-white">Size</option>
                  </select>

                  <select
                    value={cond.operator}
                    onChange={(e) => handleConditionChange(idx, 'operator', e.target.value as ConditionOperator)}
                    className="bg-transparent text-white text-[11px] focus:outline-none"
                  >
                    <option value="startsWith" className="bg-black text-white">starts with</option>
                    <option value="endsWith" className="bg-black text-white">ends with</option>
                    <option value="equals" className="bg-black text-white">equals</option>
                    <option value="contains" className="bg-black text-white">contains</option>
                    <option value="gt" className="bg-black text-white">&gt;</option>
                    <option value="lt" className="bg-black text-white">&lt;</option>
                  </select>

                  <input
                    type="text"
                    value={String(cond.value)}
                    onChange={(e) => handleConditionChange(idx, 'value', e.target.value)}
                    className="flex-1 bg-transparent border-b border-[#333] text-white text-[11px] px-1 py-0.5 focus:outline-none"
                    placeholder="match pattern"
                  />

                  {conditions.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCondition(idx)}
                      className="text-[#ff3333] p-1 hover:bg-[#ff3333]/10 rounded"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2 border-t border-[#1e1e1e]">
            <button
              type="button"
              onClick={onClose}
              className="border border-[#333] text-white px-3 py-1.5 rounded uppercase text-[11px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="bg-white text-black font-bold px-4 py-1.5 rounded uppercase text-[11px] btn-press"
            >
              Save Rule
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
