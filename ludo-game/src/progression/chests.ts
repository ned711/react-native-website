import {ECONOMY_CONFIG} from '../economy/config.ts';

export interface ChestAvailability {
  readonly available: boolean;
  readonly nextAvailableAt: number;
  readonly remainingMs: number;
}

/**
 * Display helper only. Opening a chest and drawing its rewards happens on the
 * server (`claim_chest` SQL function); the client never generates rewards.
 */
export function chestAvailability(
  lastClaimedAt: number | null,
  now: number,
  cooldownMs: number = ECONOMY_CONFIG.chestCooldownMs
): ChestAvailability {
  if (lastClaimedAt === null)
    return {available: true, nextAvailableAt: now, remainingMs: 0};
  const nextAvailableAt = lastClaimedAt + cooldownMs;
  const remainingMs = Math.max(0, nextAvailableAt - now);
  return {available: remainingMs === 0, nextAvailableAt, remainingMs};
}

export function formatDuration(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
