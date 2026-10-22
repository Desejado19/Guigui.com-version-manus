import fs from 'node:fs';

fs.rmSync('dist', { recursive: true, force: true });
fs.rmSync('server.cjs', { force: true });
