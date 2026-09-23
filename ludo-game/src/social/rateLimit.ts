/**
 * Sliding-window rate limiter (pure). Used client-side to give instant
 * feedback; the server enforces the same limits in SQL, which is what counts.
 */
export interface RateLimitRule {
  readonly max: number;
  readonly windowMs: number;
}

export const RATE_LIMITS = {
  chat: {max: 5, windowMs: 10_000},
  invitation: {max: 5, windowMs: 60_000},
  friendRequest: {max: 20, windowMs: 24 * 60 * 60 * 1000},
  gift: {max: 10, windowMs: 60_000},
} as const satisfies Record<string, RateLimitRule>;

export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly retryAfterMs: number;
  readonly history: readonly number[];
}

export function checkRateLimit(
  history: readonly number[],
  now: number,
  rule: RateLimitRule
): RateLimitDecision {
  const recent = history.filter(t => now - t < rule.windowMs);
  if (recent.length >= rule.max) {
    const oldest = Math.min(...recent);
    return {
      allowed: false,
      retryAfterMs: rule.windowMs - (now - oldest),
      history: recent,
    };
  }
  return {allowed: true, retryAfterMs: 0, history: [...recent, now]};
}
