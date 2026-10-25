export type MigrationTarget = {
  connectionString: string;
  confirmTarget: string;
};

export function resolveMigrationTarget(
  env: NodeJS.ProcessEnv,
  args: string[],
): MigrationTarget {
  const connectionString = env.DB_MIGRATION_URL?.trim();
  if (!connectionString) {
    throw new Error('DB_MIGRATION_URL is required; DATABASE_URL is not used for migrations.');
  }

  let confirmTarget: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== '--confirm-target') {
      throw new Error('Unknown migration option.');
    }
    const nextTarget = args[index + 1]?.trim();
    if (confirmTarget || !nextTarget) {
      throw new Error('--confirm-target requires one database name.');
    }
    confirmTarget = nextTarget;
    index += 1;
  }

  if (!confirmTarget) {
    throw new Error('--confirm-target <database-name> is required for migrations.');
  }

  return { connectionString, confirmTarget };
}

export function assertMigrationTarget(
  connectedDatabase: string | undefined,
  confirmTarget: string,
): void {
  if (!connectedDatabase || connectedDatabase !== confirmTarget) {
    throw new Error('The confirmed migration target does not match the connected database.');
  }
}
