import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectDirectory = path.dirname(fileURLToPath(import.meta.url));
const { runPlatformEntrypoint } = await import('./dist/platform-preflight.mjs');
const { default: app } = await runPlatformEntrypoint(
  process.env,
  path.resolve(projectDirectory, 'data'),
  () => import('./dist/server.mjs'),
);

void express;
export default app;
