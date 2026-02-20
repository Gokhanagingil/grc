import { useState, useEffect, useCallback, useRef } from 'react';
import { itsmApi, ItsmChoiceData } from '../services/grcClient';

export interface ChoiceOption {
  value: string;
  label: string;
}

interface UseItsmChoicesResult {
  choices: Record<string, ChoiceOption[]>;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const choiceCache: Record<string, { data: Record<string, ChoiceOption[]>; ts: number }> = {};
const CACHE_TTL = 60_000;

export function useItsmChoices(
  tableName: string,
  fallbacks?: Record<string, ChoiceOption[]>,
): UseItsmChoicesResult {
  const [choices, setChoices] = useState<Record<string, ChoiceOption[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchChoices = useCallback(async () => {
    const cached = choiceCache[tableName];
    if (cached && Date.now() - cached.ts < CACHE_TTL) {
      setChoices(cached.data);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await itsmApi.choices.list(tableName);
      const raw = response.data;
      let grouped: Record<string, ItsmChoiceData[]>;

      if (raw && typeof raw === 'object' && 'data' in raw) {
        grouped = raw.data as Record<string, ItsmChoiceData[]>;
      } else if (raw && typeof raw === 'object') {
        grouped = raw as Record<string, ItsmChoiceData[]>;
      } else {
        grouped = {};
      }

      const mapped: Record<string, ChoiceOption[]> = {};
      for (const [field, items] of Object.entries(grouped)) {
        if (Array.isArray(items)) {
          mapped[field] = items.map((c: ItsmChoiceData) => ({
            value: c.value,
            label: c.label,
          }));
        }
      }

      choiceCache[tableName] = { data: mapped, ts: Date.now() };
      if (mountedRef.current) {
        setChoices(mapped);
      }
    } catch (err) {
      console.error(`Failed to load choices for ${tableName}:`, err);
      if (mountedRef.current) {
        setError('Failed to load choices');
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [tableName]);

  useEffect(() => {
    mountedRef.current = true;
    fetchChoices();
    return () => {
      mountedRef.current = false;
    };
  }, [fetchChoices]);

  const merged: Record<string, ChoiceOption[]> = {};
  if (fallbacks) {
    for (const [field, opts] of Object.entries(fallbacks)) {
      merged[field] = choices[field] && choices[field].length > 0 ? choices[field] : opts;
    }
  }
  for (const [field, opts] of Object.entries(choices)) {
    if (!merged[field]) {
      merged[field] = opts;
    }
  }

  return {
    choices: merged,
    loading,
    error,
    refresh: fetchChoices,
  };
}

export function invalidateChoiceCache(tableName?: string): void {
  if (tableName) {
    delete choiceCache[tableName];
  } else {
    for (const key of Object.keys(choiceCache)) {
      delete choiceCache[key];
    }
  }
}
