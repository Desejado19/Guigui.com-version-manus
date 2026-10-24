function validatedQaOrigin(baseUrl: string): string {
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error('QA target must be the approved local HTTP origin.');
  }

  if (url.protocol !== 'http:'
    || url.hostname !== '127.0.0.1'
    || url.port !== '4313'
    || url.username
    || url.password
    || url.pathname !== '/'
    || url.search
    || url.hash) {
    throw new Error('QA target must be the approved local HTTP origin.');
  }
  return url.origin;
}

export async function assertRunningTarget(baseUrl: string): Promise<void> {
  const origin = validatedQaOrigin(baseUrl);
  let response: Response;
  try {
    response = await fetch(`${origin}/api/health`, {
      method: 'GET',
      redirect: 'manual',
    });
  } catch {
    throw new Error('QA target health endpoint is unavailable.');
  }

  if (response.status >= 300 && response.status < 400) {
    throw new Error('QA target health endpoint must not redirect.');
  }
  if (!response.ok) {
    throw new Error(`QA target health endpoint returned HTTP ${response.status}.`);
  }
}
