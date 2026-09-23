import {writeFileSync} from 'node:fs';
import {
  CATALOG_MIGRATION,
  PROGRESSION_MIGRATION,
  catalogSeedSql,
  progressionSeedSql,
} from './catalogSql.ts';

writeFileSync(CATALOG_MIGRATION, catalogSeedSql());
writeFileSync(PROGRESSION_MIGRATION, progressionSeedSql());
console.log(`wrote ${CATALOG_MIGRATION} and ${PROGRESSION_MIGRATION}`);
