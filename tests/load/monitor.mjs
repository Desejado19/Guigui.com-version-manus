/**
 * Amostrador de recursos durante os testes de carga.
 *
 * Lê dados reais do servidor local:
 * - `/api/metrics` (admin) — estado do pool PostgreSQL e contadores de pedidos;
 * - `/api/realtime/status` (admin) — ligações/erros do canal de tempo real;
 * - `Get-Process` — CPU acumulada e memória do processo do servidor.
 *
 * Uso: node tests/load/monitor.mjs [PID] [intervaloMs]
 * Escreve uma linha JSON por amostra em `tests/load/results/monitor.jsonl`.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';
import pg from 'pg';

const PID = Number(process.argv[2] || 0);
const INTERVAL_MS = Number(process.argv[3] || 2000);
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';
const OUT_DIR = path.join('tests', 'load', 'results');
const OUT_FILE = path.join(OUT_DIR, 'monitor.jsonl');

fs.mkdirSync(OUT_DIR, { recursive: true });

async function login() {
  const response = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin.teste@guigui.com', password: 'Guigui2026!' }),
  });
  if (!response.ok) throw new Error(`login admin falhou: ${response.status}`);
  const cookies = response.headers.getSetCookie?.() ?? [];
  return cookies.map((value) => value.split(';')[0]).join('; ');
}

function processSample() {
  if (!PID) return null;
  try {
    const raw = execFileSync('powershell', [
      '-NoProfile',
      '-Command',
      `Get-Process -Id ${PID} | Select-Object -Property CPU,WorkingSet64 | ConvertTo-Json -Compress`,
    ], { encoding: 'utf8' });
    const parsed = JSON.parse(raw.trim());
    return { cpuSeconds: parsed.CPU, workingSetMB: Math.round((parsed.WorkingSet64 / 1048576) * 10) / 10 };
  } catch {
    return null;
  }
}

// Uma única ligação de monitorização, para contar as ligações reais no PostgreSQL.
const monitorPool = process.env.DATABASE_URL
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
  : null;

async function pgSample() {
  if (!monitorPool) return null;
  try {
    const { rows } = await monitorPool.query(
      `select count(*)::int as total,
              count(*) filter (where state = 'active')::int as active
         from pg_stat_activity
        where datname = current_database() and pid <> pg_backend_pid()`,
    );
    return rows[0] ?? null;
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

async function main() {
  const cookie = await login();
  const stream = fs.createWriteStream(OUT_FILE, { flags: 'a' });
  console.log(`monitor a escrever em ${OUT_FILE} (PID ${PID || 'desconhecido'})`);

  let lastCpu = null;
  let lastAt = Date.now();

  const timer = setInterval(async () => {
    const sample = { at: new Date().toISOString() };
    try {
      const metrics = await fetch(`${BASE}/api/metrics`, { headers: { Cookie: cookie } });
      if (metrics.ok) {
        const body = await metrics.json();
        sample.apiTotalRequests = body.totalRequests ?? null;
        sample.apiErrors = body.errors ?? null;
        const slowest = Array.isArray(body.routes)
          ? [...body.routes].sort((a, b) => (b.averageMs || 0) - (a.averageMs || 0)).slice(0, 3)
          : [];
        sample.slowestRoutes = slowest.map((r) => ({ route: r.route, avgMs: r.averageMs, count: r.count }));
      }
      sample.pg = await pgSample();
      const realtime = await fetch(`${BASE}/api/realtime/status`, { headers: { Cookie: cookie } });
      if (realtime.ok) {
        const body = await realtime.json();
        sample.realtime = {
          connected: body.connected,
          received: body.received,
          published: body.published,
          duplicatesDropped: body.duplicatesDropped,
          lastLatencyMs: body.lastLatencyMs,
          publishErrors: body.publishErrors,
        };
      }
    } catch (error) {
      sample.error = error instanceof Error ? error.message : String(error);
    }

    const proc = processSample();
    if (proc) {
      const now = Date.now();
      if (lastCpu !== null) {
        const deltaCpu = proc.cpuSeconds - lastCpu;
        sample.cpuPercent = Math.round((deltaCpu / ((now - lastAt) / 1000)) * 1000) / 10;
      }
      lastCpu = proc.cpuSeconds;
      lastAt = now;
      sample.ramMB = proc.workingSetMB;
    }

    stream.write(`${JSON.stringify(sample)}\n`);
  }, INTERVAL_MS);

  const stop = () => {
    clearInterval(timer);
    stream.end();
    monitorPool?.end().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
  setTimeout(stop, Number(process.env.MONITOR_MS || 30 * 60 * 1000));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
