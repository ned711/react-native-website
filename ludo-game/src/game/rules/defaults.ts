import type {RuleConfig} from '../types.ts';
import {START_INDEX, ARM_LENGTH} from '../board/constants.ts';

/** Offset of the "star" safe cell inside each arm (see board/layout.ts GREEN_ARM[9]). */
export const STAR_OFFSET_IN_ARM = 9;

/** Starts + stars: 8 safe cells, one start and one star per quarter. */
export const DEFAULT_SAFE_TRACK_POSITIONS: readonly number[] = [
  START_INDEX.green,
  START_INDEX.green + STAR_OFFSET_IN_ARM,
  START_INDEX.yellow,
  START_INDEX.yellow + STAR_OFFSET_IN_ARM,
  START_INDEX.blue,
  START_INDEX.blue + STAR_OFFSET_IN_ARM,
  START_INDEX.red,
  START_INDEX.red + STAR_OFFSET_IN_ARM,
].sort((a, b) => a - b);

export const CLASSIC_RULES: RuleConfig = {
  spawnValues: [6],
  sixGrantsExtraTurn: true,
  captureGrantsExtraTurn: true,
  finishGrantsExtraTurn: true,
  maxConsecutiveSixes: 3,
  safeTrackPositions: DEFAULT_SAFE_TRACK_POSITIONS,
  teammateCaptureAllowed: false,
};

export function validateRules(rules: RuleConfig): string[] {
  const problems: string[] = [];
  if (rules.spawnValues.length === 0) problems.push('spawnValues is empty');
  if (
    rules.maxConsecutiveSixes !== null &&
    (!Number.isInteger(rules.maxConsecutiveSixes) ||
      rules.maxConsecutiveSixes < 1)
  ) {
    problems.push('maxConsecutiveSixes must be a positive integer or null');
  }
  for (const p of rules.safeTrackPositions) {
    if (!Number.isInteger(p) || p < 0 || p >= ARM_LENGTH * 4) {
      problems.push(`invalid safe track position ${p}`);
    }
  }
  return problems;
}
