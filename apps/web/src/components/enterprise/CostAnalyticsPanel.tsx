'use client';

import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingDown, Server, Sparkles, RefreshCw } from 'lucide-react';
import { MultiCloudCostAnalyticsResponse } from '@bucketspace/shared';

export interface CostAnalyticsPanelProps {
  workspaceId: string;
}

export const CostAnalyticsPanel: React.FC<CostAnalyticsPanelProps> = ({ workspaceId }) => {
  const [data, setData] = useState<MultiCloudCostAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="border border-[#1e1e1e] bg-[#0a0a0a] rounded-lg p-5 space-y-4 font-mono text-xs">
      <div className="flex items-center justify-between border-b border-[#1e1e1e] pb-3">
        <div>
          <h3 className="font-bold text-sm text-white uppercase">Cloud Cost & Storage Telemetry</h3>
          <p className="text-[10px] text-[#666]">Real-time usage and tiering optimization</p>
        </div>
        <span className="text-[10px] text-[#22c55e] border border-[#22c55e]/30 px-2 py-0.5 rounded">
          LIVE
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="bg-[#121212] p-3 border border-[#1e1e1e] rounded space-y-1">
          <div className="text-[10px] text-[#666] uppercase">Telegram Cloud</div>
          <div className="text-base font-bold text-white">$0.00 / mo</div>
          <div className="text-[10px] text-[#555]">Unlimited Zero-Cost</div>
        </div>
        <div className="bg-[#121212] p-3 border border-[#1e1e1e] rounded space-y-1">
          <div className="text-[10px] text-[#666] uppercase">Local Disk</div>
          <div className="text-base font-bold text-white">$0.00 / mo</div>
          <div className="text-[10px] text-[#555]">Offline Hardware</div>
        </div>
        <div className="bg-[#121212] p-3 border border-[#1e1e1e] rounded space-y-1">
          <div className="text-[10px] text-[#666] uppercase">S3 / R2 Cluster</div>
          <div className="text-base font-bold text-white">$0.015 / GB</div>
          <div className="text-[10px] text-[#555]">Zero Egress Fee</div>
        </div>
      </div>
    </div>
  );
};
