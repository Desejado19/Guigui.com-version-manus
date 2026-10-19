export type DatabaseHealth = {
  configured: boolean;
  connected: boolean;
};

export type HealthStatus = 'ok' | 'degraded';

export function classifyHealth(database: DatabaseHealth): HealthStatus {
  return database.configured && !database.connected ? 'degraded' : 'ok';
}
