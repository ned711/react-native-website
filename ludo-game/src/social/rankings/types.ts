export type RankingScope = 'world' | 'continent' | 'country';

export interface RankingEntry {
  readonly rank: number;
  readonly userId: string;
  readonly username: string;
  readonly discriminator: string;
  readonly countryCode: string | null;
  readonly level: number;
  readonly score: number;
}

/** Ranking data always comes from server statistics (SQL `get_ranking`). */
export interface RankingService {
  getWorldRanking(limit: number): Promise<RankingEntry[]>;
  getContinentRanking(limit: number): Promise<RankingEntry[]>;
  getCountryRanking(limit: number): Promise<RankingEntry[]>;
  getMyRank(scope: RankingScope): Promise<RankingEntry | null>;
}
