import { useEffect, useState } from 'react';
import { getHealth } from '../lib/api';

type Health = {
  status: string;
  time: string;
  db: 'up' | 'down';
  version: string;
  build?: string | null;
  uptimeSecs?: number;
};

export default function HealthBanner() {
  const [state, setState] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHealth().then(setState).catch((e) => setError(e?.message ?? 'Health check failed'));
  }, []);

  if (error) {
    return (
      <div className="p-2 bg-red-50 border border-red-200 text-red-700 text-sm">
        Health error: {error}
      </div>
    );
  }
  if (!state) return null;

  const dbUp = state.db === 'up';
  const uptime = typeof state.uptimeSecs === 'number'
    ? ` • Uptime: ${Math.floor((state.uptimeSecs || 0) / 60)}m`
    : '';

  return (
    <div
      className={`p-2 text-sm border ${
        dbUp ? 'bg-green-50 border-green-200 text-green-700' : 'bg-yellow-50 border-yellow-200 text-yellow-800'
      }`}
      style={{ marginBottom: 12 }}
    >
      Backend v{state.version} {state.build ? `(${state.build})` : ''} — DB: <b>{state.db}</b>{uptime}
    </div>
  );
}


