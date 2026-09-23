import type {GameConfig, PlayerColor, TeamConfig} from '../types.ts';

export function teamIndexOf(
  teams: TeamConfig | null,
  color: PlayerColor
): number | null {
  if (!teams) return null;
  const index = teams.teams.findIndex(team => team.includes(color));
  return index === -1 ? null : index;
}

export function areTeammates(
  config: Pick<GameConfig, 'teams'>,
  a: PlayerColor,
  b: PlayerColor
): boolean {
  if (a === b) return true;
  const ta = teamIndexOf(config.teams, a);
  return ta !== null && ta === teamIndexOf(config.teams, b);
}

/** Classic 2v2 pairing: players sitting opposite each other are partners. */
export const OPPOSITE_TEAMS: TeamConfig = {
  teams: [
    ['green', 'blue'],
    ['yellow', 'red'],
  ],
};
