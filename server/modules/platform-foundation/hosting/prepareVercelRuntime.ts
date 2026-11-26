import fs from 'fs';
import path from 'path';

export function prepareVercelRuntime(
  env: NodeJS.ProcessEnv,
  sourceDataDirectory: string,
): void {
  if (!env.VERCEL) return;

  env.NODE_ENV = 'production';
  if (!env.APP_URL?.trim() && env.VERCEL_URL) {
    env.APP_URL = `https://${env.VERCEL_URL}`;
  }
  if (!env.CORS_ALLOWED_ORIGINS?.trim() && env.APP_URL) {
    env.CORS_ALLOWED_ORIGINS = env.APP_URL;
  }

  const destinationDirectory = env.GUIGUI_DATA_DIR?.trim() || '/tmp/guigui-data';
  env.GUIGUI_DATA_DIR = destinationDirectory;
  fs.mkdirSync(destinationDirectory, { recursive: true });

  if (!fs.existsSync(sourceDataDirectory)) return;

  for (const file of fs.readdirSync(sourceDataDirectory)) {
    if (!file.endsWith('.json')) continue;

    const sourceFile = path.join(sourceDataDirectory, file);
    const destinationFile = path.join(destinationDirectory, file);
    if (!fs.existsSync(destinationFile)) {
      fs.copyFileSync(sourceFile, destinationFile);
    }
  }
}
