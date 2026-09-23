import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {DEFAULT_AUDIO_SETTINGS, type AudioSettings} from '../audio/types.ts';
import type {GraphicsQuality} from '../environment/types.ts';
import {loadJson, saveJson} from '../services/storage.ts';
import {DEFAULT_THEME_ID, THEMES} from '../themes/themes.ts';
import type {ThemeId} from '../themes/types.ts';

export interface AppSettings {
  readonly audio: AudioSettings;
  readonly graphics: GraphicsQuality;
  readonly reduceMotion: boolean;
  readonly largeText: boolean;
  readonly themeId: ThemeId;
  readonly equippedDiceId: string;
  readonly equippedCharacterId: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  audio: DEFAULT_AUDIO_SETTINGS,
  graphics: 'NORMAL',
  reduceMotion: false,
  largeText: false,
  themeId: DEFAULT_THEME_ID,
  equippedDiceId: 'classic_dice',
  equippedCharacterId: 'classic_pawn',
};

const KEY = 'ludo.settings.v1';

function isSettings(value: unknown): value is AppSettings {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['audio'] === 'object' &&
    (v['graphics'] === 'LOW' ||
      v['graphics'] === 'NORMAL' ||
      v['graphics'] === 'HIGH') &&
    typeof v['reduceMotion'] === 'boolean' &&
    typeof v['largeText'] === 'boolean' &&
    typeof v['themeId'] === 'string' &&
    THEMES.some(t => t.id === v['themeId'])
  );
}

interface SettingsContextValue {
  readonly settings: AppSettings;
  update(patch: Partial<AppSettings>): void;
  updateAudio(patch: Partial<AudioSettings>): void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({children}: {readonly children: ReactNode}) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;
    loadJson(KEY, isSettings).then(stored => {
      if (stored && !cancelled)
        setSettings({
          ...DEFAULT_SETTINGS,
          ...stored,
          audio: {...DEFAULT_AUDIO_SETTINGS, ...stored.audio},
        });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = {...prev, ...patch};
      void saveJson(KEY, next);
      return next;
    });
  }, []);

  const updateAudio = useCallback((patch: Partial<AudioSettings>) => {
    setSettings(prev => {
      const next = {...prev, audio: {...prev.audio, ...patch}};
      void saveJson(KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({settings, update, updateAudio}),
    [settings, update, updateAudio]
  );
  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
