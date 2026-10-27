'use client';

import { useEffect, useState } from 'react';
import type { ToolStat } from '@/lib/usage';

export default function ToolStats({ refreshKey }: { refreshKey: number }) {
  const [stats, setStats] = useState<ToolStat[]>([]);

  useEffect(() => {
    fetch('/api/stats')
      .then(response => (response.ok ? response.json() : []))
      .then(setStats)
      .catch(() => setStats([]));
  }, [refreshKey]);

  if (stats.length === 0) return null;

  return (
    <div className="border-b bg-gray-50 px-4 py-2">
      <div className="mx-auto flex max-w-4xl items-center gap-2 overflow-x-auto whitespace-nowrap text-xs text-gray-600">
        <span className="font-semibold text-gray-700">Tool usage:</span>
        {stats.map(stat => (
          <span key={stat.tool} className="shrink-0 rounded-full border border-gray-200 bg-white px-2 py-0.5">
            {stat.tool}: {stat.calls} calls, avg {stat.averageMs} ms, slowest {stat.slowestMs} ms, {stat.errors} errors
          </span>
        ))}
      </div>
    </div>
  );
}
