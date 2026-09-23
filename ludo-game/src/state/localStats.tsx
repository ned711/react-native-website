/**
 * Offline statistics kept on the device. They are NOT progression: XP, levels,
 * coins and rewards are only granted by the server for online matches.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {loadJson, saveJson} from '../services/storage.ts';

export interface LocalStats {
  readonly gamesPlayed: number;
  readonly wins: number;
  readonly captures: number;
  readonly pawnsFinished: number;
}

const EMPTY: LocalStats = {
  gamesPlayed: 0,
  wins: 0,
  captures: 0,
  pawnsFinished: 0,
};
const KEY = 'ludo.localStats.v1';

function isStats(value: unknown): value is LocalStats {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return ['gamesPlayed', 'wins', 'captures', 'pawnsFinished'].every(
    k => typeof v[k] === 'number'
  );
}

interface Ctx {
  readonly stats: LocalStats;
  record(delta: LocalStats): void;
}

const LocalStatsContext = createContext<Ctx | null>(null);

export function LocalStatsProvider({children}: {readonly children: ReactNode}) {
  const [stats, setStats] = useState<LocalStats>(EMPTY);
  useEffect(() => {
    loadJson(KEY, isStats).then(s => s && setStats(s));
  }, []);
  const record = useCallback((d: LocalStats) => {
    setStats(prev => {
      const next = {
        gamesPlayed: prev.gamesPlayed + d.gamesPlayed,
        wins: prev.wins + d.wins,
        captures: prev.captures + d.captures,
        pawnsFinished: prev.pawnsFinished + d.pawnsFinished,
      };
      void saveJson(KEY, next);
      return next;
    });
  }, []);
  const value = useMemo(() => ({stats, record}), [stats, record]);
  return (
    <LocalStatsContext.Provider value={value}>
      {children}
    </LocalStatsContext.Provider>
  );
}

export function useLocalStats(): Ctx {
  const ctx = useContext(LocalStatsContext);
  if (!ctx)
    throw new Error('useLocalStats must be used inside LocalStatsProvider');
  return ctx;
}
