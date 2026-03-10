import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import client from '../../../api/client';
import type { PodEvent } from '../types';

interface Props {
  containerId: number;
  initialEvents?: PodEvent[];
}

export function ContainerEvents({ containerId, initialEvents = [] }: Props) {
  const [events, setEvents] = useState<PodEvent[]>(initialEvents);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await client.get(`/containers/${containerId}/events`);
      setEvents(r.data.events ?? []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-gray-600 dark:text-slate-400">Pod 事件</span>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 transition-colors"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} /> 刷新
        </button>
      </div>
      {events.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-slate-500 py-4 text-center">暂无事件</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {events.map((ev, i) => (
            <div
              key={i}
              className={`p-3 rounded-lg border text-xs ${
                ev.type === 'Warning'
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-800/50'
                  : 'bg-gray-50 dark:bg-slate-900/60 border-gray-200 dark:border-slate-700/40'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className={`px-1.5 py-0.5 rounded font-semibold ${
                        ev.type === 'Warning'
                          ? 'bg-yellow-200 dark:bg-yellow-800/60 text-yellow-900 dark:text-yellow-200'
                          : 'bg-blue-200 dark:bg-blue-800/60 text-blue-900 dark:text-blue-200'
                      }`}
                    >
                      {ev.reason}
                    </span>
                    {ev.count > 1 && (
                      <span className="text-gray-500 dark:text-slate-500">×{ev.count}</span>
                    )}
                  </div>
                  <p className="text-gray-800 dark:text-slate-300 break-words">{ev.message}</p>
                </div>
                {ev.last_timestamp && (
                  <span className="text-gray-500 dark:text-slate-500 whitespace-nowrap flex-shrink-0">
                    {new Date(ev.last_timestamp).toLocaleTimeString()}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
