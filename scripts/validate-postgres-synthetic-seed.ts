export const VALID_SYNTHETIC_TARGET_DATABASE = 'guigui_pg18_synthetic_target';

export function validateSyntheticSeedTarget(input: {
  databaseName?: string;
  serverVersionNum?: number;
  rowCounts?: Record<string, number>;
}): void {
  const databaseName = input.databaseName;
  const serverVersionNum = input.serverVersionNum;
  const rowCounts = input.rowCounts ?? {};

  if (typeof serverVersionNum !== 'number' || !Number.isInteger(serverVersionNum) || Math.floor(serverVersionNum / 10000) !== 18) {
    throw new Error('Synthetic seed requires PostgreSQL 18.');
  }

  if (databaseName !== VALID_SYNTHETIC_TARGET_DATABASE) {
    throw new Error(`Synthetic seed target must be ${VALID_SYNTHETIC_TARGET_DATABASE}.`);
  }

  const invalidCounts = Object.entries(rowCounts).filter(([, count]) => !Number.isInteger(count) || count < 0);
  if (invalidCounts.length > 0) {
    throw new Error(`Synthetic seed table counts must be non-negative integers: ${invalidCounts.map(([name]) => name).join(', ')}`);
  }

  const nonEmptyTables = Object.entries(rowCounts).filter(([, count]) => count > 0);
  if (nonEmptyTables.length > 0) {
    throw new Error(`Synthetic seed target must be empty before import. Found pre-existing rows in: ${nonEmptyTables.map(([name]) => name).join(', ')}`);
  }
}
