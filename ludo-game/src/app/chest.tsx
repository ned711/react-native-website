import {useCallback, useEffect, useState} from 'react';
import {AppText} from '../components/ui/AppText.tsx';
import {Button} from '../components/ui/Button.tsx';
import {Card} from '../components/ui/Card.tsx';
import {NotConfigured} from '../components/ui/NotConfigured.tsx';
import {Screen} from '../components/ui/Screen.tsx';
import {formatDuration} from '../progression/chests.ts';
import {backendStatus} from '../services/backend.ts';
import {chestStatus, claimChest, type ChestReward} from '../services/rpc.ts';

export default function ChestScreen() {
  const backend = backendStatus();
  const [offsetNext, setOffsetNext] = useState<number | null>(null);
  const [rewards, setRewards] = useState<ChestReward[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const refresh = useCallback(async () => {
    const r = await chestStatus();
    if (!r.ok) return setError(r.error.message);
    // Convert the server deadline to the device clock (server is authoritative).
    setOffsetNext(Date.now() + (r.value.nextAvailableAt - r.value.serverNow));
  }, []);

  useEffect(() => {
    if (!backend.configured) return undefined;
    void refresh();
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [backend.configured, refresh]);

  if (!backend.configured) {
    return (
      <Screen title="Coffre">
        <NotConfigured
          feature="Coffre (toutes les 3 heures)"
          reason={backend.reason}
        />
      </Screen>
    );
  }
  const availability =
    offsetNext === null
      ? null
      : {
          available: offsetNext <= now,
          remainingMs: Math.max(0, offsetNext - now),
        };
  return (
    <Screen title="Coffre">
      <Card>
        <AppText>
          {availability === null
            ? 'Chargement…'
            : availability.available
              ? 'Coffre disponible !'
              : `Prochain coffre dans ${formatDuration(availability.remainingMs)}`}
        </AppText>
        <Button
          label="Ouvrir"
          disabled={!availability?.available}
          onPress={async () => {
            const r = await claimChest();
            if (r.ok) setRewards(r.value);
            else setError(r.error.message);
            void refresh();
          }}
        />
        {rewards.map((rw, i) => (
          <AppText key={i}>
            {rw.type === 'fragments'
              ? `${rw.amount} fragment(s) : ${rw.itemId ?? ''}`
              : `${rw.amount} ${rw.type}`}
          </AppText>
        ))}
        {error ? <AppText variant="caption">{error}</AppText> : null}
      </Card>
    </Screen>
  );
}
