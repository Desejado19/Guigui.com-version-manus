export type QaTarget = {
  appHost: '127.0.0.1';
  appPort: 4313;
  databaseName: 'guigui_pg18_synthetic_target';
};

const QA_DATABASE_NAME = 'guigui_pg18_synthetic_target';
const QA_APP_PORT = 4313;

function parseLoopbackPostgresUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('QA_ADMIN_DATABASE_URL must be a valid PostgreSQL URL on loopback.');
  }

  if (
    (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:')
    || (url.hostname !== '127.0.0.1' && url.hostname !== '[::1]' && url.hostname !== '::1')
  ) {
    throw new Error('QA_ADMIN_DATABASE_URL must use PostgreSQL on 127.0.0.1 or ::1.');
  }

  if ([...url.searchParams.keys()].some((name) => ['host', 'hostaddr', 'port'].includes(name.toLowerCase()))) {
    throw new Error('QA_ADMIN_DATABASE_URL must not override its PostgreSQL host or port.');
  }

  return url;
}

export function assertQaTarget(target: QaTarget): void {
  if (
    target.appHost !== '127.0.0.1'
    || target.appPort !== QA_APP_PORT
    || target.databaseName !== QA_DATABASE_NAME
  ) {
    throw new Error('QA target must use 127.0.0.1:4313 and guigui_pg18_synthetic_target.');
  }
}

export function parseQaTarget(env: NodeJS.ProcessEnv): QaTarget {
  const adminDatabaseUrl = env.QA_ADMIN_DATABASE_URL?.trim();
  if (!adminDatabaseUrl) {
    throw new Error('QA_ADMIN_DATABASE_URL is required for local QA provisioning.');
  }
  parseLoopbackPostgresUrl(adminDatabaseUrl);

  if (env.QA_DATABASE_NAME !== QA_DATABASE_NAME) {
    throw new Error(`QA_DATABASE_NAME must be ${QA_DATABASE_NAME}.`);
  }

  if (env.QA_PORT !== String(QA_APP_PORT)) {
    throw new Error(`QA_PORT must be ${QA_APP_PORT}.`);
  }

  return {
    appHost: '127.0.0.1',
    appPort: QA_APP_PORT,
    databaseName: QA_DATABASE_NAME,
  };
}

export function buildQaDatabaseUrl(
  adminConnectionString: string,
  databaseName: QaTarget['databaseName'],
): string {
  const url = parseLoopbackPostgresUrl(adminConnectionString);
  url.pathname = `/${databaseName}`;
  return url.toString();
}
