import {writeFileSync} from 'node:fs';
import {CATALOG_MIGRATION, catalogSeedSql} from './catalogSql.ts';

writeFileSync(CATALOG_MIGRATION, catalogSeedSql());
console.log(`wrote ${CATALOG_MIGRATION}`);
