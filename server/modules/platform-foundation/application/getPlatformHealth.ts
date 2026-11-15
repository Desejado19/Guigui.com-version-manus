export type DatabaseHealth = {
  configured: boolean;
  connected: boolean;
};

export type HealthStatus = 'ok' | 'degraded';

export type HealthDependencies = {
  databaseConfigured: boolean;
  checkDatabaseConnection: () => Promise<DatabaseHealth>;
  geminiActive: () => boolean;
  logger: Pick<Console, 'error'>;
  now: () => Date;
};

export type HealthResponse = {
  status: HealthStatus;
  app: 'Guigui.com Bissau';
  timestamp: string;
  geminiActive?: boolean;
  database?: DatabaseHealth;
  observability?: {
    inProcess: true;
    persistent: boolean;
  };
};

export function classifyHealth(database: DatabaseHealth): HealthStatus {
  return database.configured && !database.connected ? 'degraded' : 'ok';
}

export async function getPlatformHealth(
  dependencies: HealthDependencies,
  detailed = true,
): Promise<HealthResponse> {
  let database: DatabaseHealth = {
    configured: dependencies.databaseConfigured,
    connected: false,
  };

  if (dependencies.databaseConfigured) {
    try {
      database = await dependencies.checkDatabaseConnection();
    } catch (error) {
      dependencies.logger.error(
        '[Guigui.com] health database check failed:',
        error instanceof Error ? error.message : 'unknown_error',
      );
      database = { configured: true, connected: false };
    }
  }

  const base: HealthResponse = {
    status: classifyHealth(database),
    app: 'Guigui.com Bissau',
    timestamp: dependencies.now().toISOString(),
  };
  if (!detailed) return base;
  return {
    ...base,
    geminiActive: dependencies.geminiActive(),
    database,
    observability: { inProcess: true, persistent: Boolean(database.connected) },
  };
}
