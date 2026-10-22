import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const onVercel = Boolean(process.env.VERCEL);

if (onVercel) {
  process.env.NODE_ENV = 'production';
  if (!process.env.APP_URL?.trim() && process.env.VERCEL_URL) {
    process.env.APP_URL = `https://${process.env.VERCEL_URL}`;
  }
  if (!process.env.CORS_ALLOWED_ORIGINS?.trim() && process.env.APP_URL) {
    process.env.CORS_ALLOWED_ORIGINS = process.env.APP_URL;
  }

  const dest = process.env.GUIGUI_DATA_DIR?.trim() || '/tmp/guigui-data';
  process.env.GUIGUI_DATA_DIR = dest;
  fs.mkdirSync(dest, { recursive: true });

  const here = path.dirname(fileURLToPath(import.meta.url));
  const src = path.resolve(here, '..', 'data');
  if (fs.existsSync(src)) {
    for (const file of fs.readdirSync(src)) {
      if (!file.endsWith('.json')) continue;
      const from = path.join(src, file);
      const to = path.join(dest, file);
      if (!fs.existsSync(to)) {
        fs.copyFileSync(from, to);
      }
    }
  }
}
