import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {defaultInventory, type InventoryEntry} from '../inventory/inventory.ts';
import {
  equipOnServer,
  loadMyProfile,
  type ServerProfile,
} from '../services/profile.ts';
import {useAuth} from './auth.tsx';
import {useSettings} from './settings.tsx';

interface ProfileContextValue {
  /** null when signed out / backend not configured (guest). */
  readonly profile: ServerProfile | null;
  /** Server inventory when signed in, otherwise the default items only. */
  readonly inventory: readonly InventoryEntry[];
  readonly error: string | null;
  refresh(): Promise<void>;
  equip(
    slot: 'character' | 'dice' | 'board',
    itemId: string
  ): Promise<string | null>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({children}: {readonly children: ReactNode}) {
  const {session} = useAuth();
  const {update} = useSettings();
  const [profile, setProfile] = useState<ServerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const userId = session?.user.id ?? null;

  const refresh = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const r = await loadMyProfile(userId);
    if (r.ok) {
      setProfile(r.value);
      setError(null);
      // Server equipment is the reference; the local setting is a display cache.
      update({
        equippedCharacterId: r.value.equipped.character,
        equippedDiceId: r.value.equipped.dice,
      });
    } else setError(r.error);
  }, [userId, update]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const equip = useCallback(
    async (slot: 'character' | 'dice' | 'board', itemId: string) => {
      if (!profile) {
        // Guest: only default items exist locally; purely cosmetic.
        if (slot === 'character') update({equippedCharacterId: itemId});
        if (slot === 'dice') update({equippedDiceId: itemId});
        return null;
      }
      const r = await equipOnServer(slot, itemId);
      if (!r.ok) return r.error;
      await refresh();
      return null;
    },
    [profile, refresh, update]
  );

  const inventory = useMemo(() => {
    const defaults = defaultInventory();
    if (!profile) return defaults;
    return [
      ...defaults,
      ...profile.inventory.filter(
        e => !defaults.some(d => d.itemId === e.itemId)
      ),
    ];
  }, [profile]);

  const value = useMemo(
    () => ({profile, inventory, error, refresh, equip}),
    [profile, inventory, error, refresh, equip]
  );
  return (
    <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
  );
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside ProfileProvider');
  return ctx;
}
