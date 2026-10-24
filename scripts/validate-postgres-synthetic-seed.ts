export const VALID_SYNTHETIC_TARGET_DATABASE = 'guigui_pg18_synthetic_target';

export function validateSyntheticSeedTarget(input: {
  databaseName?: string;
  serverVersionNum?: number;
  rowCounts?: Record<string, number>;
}): void {
  const databaseName = input.databaseName ?? VALID_SYNTHETIC_TARGET_DATABASE;
  const serverVersionNum = input.serverVersionNum ?? 180000;
  const rowCounts = input.rowCounts ?? {};

  if (serverVersionNum < 180000) {
    throw new Error('Synthetic seed requires PostgreSQL 18 or newer.');
  }

  if (!databaseName || databaseName === 'postgres' || databaseName.includes('prod')) {
    throw new Error('Synthetic seed target must be a dedicated disposable local PG18 database, not the default/postgres target.');
  }

  const nonEmptyTables = Object.entries(rowCounts).filter(([, count]) => Number(count) > 0);
  if (nonEmptyTables.length > 0) {
    throw new Error(`Synthetic seed target must be empty before import. Found pre-existing rows in: ${nonEmptyTables.map(([name]) => name).join(', ')}`);
  }
}
