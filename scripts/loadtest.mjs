import http from 'node:http';
import { setTimeout } from 'node:timers/promises';

const BASE = 'http://127.0.0.1:3000';

const DEFAULT = {
  total: 10000,
  concurrency: 50,
  timeoutMs: 10000,
  warmUp: 20,
  targets: ['/api/events', '/'],
  healthPath: '/api/events',
};

async function requestOnce(path, timeoutMs) {
  const url = new URL(path, BASE);
  const start = performance.now();
  const controller = new AbortController();
  const timerFuts = [];
  let timerHandle;
  try {
    timerHandle = setTimeout(timeoutMs, undefined);
    timerFuts.push(timerHandle);
    const res = await fetch(url.toString(), {
      method: 'GET',
      signal: controller.signal,
    });
    const ms = performance.now() - start;
    return { ok: res.ok, status: res.status, ms };
  } catch (e) {
    const ms = performance.now() - start;
    let status = -1;
    let error = e?.message ?? String(e);
    if (e?.name === 'AbortError') {
      status = 0;
      error = 'timeout/abort';
    }
    return { ok: false, status, ms, error };
  } finally {
    try {
      for (const h of timerFuts) {
        clearTimeout(h);
      }
    } catch {}
  }
}

async function burst(path, count, timeoutMs) {
  const jobs = Array.from({ length: count }, (_, i) => i);
  const started = jobs.map(() => performance.now());
  const results = await Promise.all(
    jobs.map(async (idx) => {
      const res = await requestOnce(path, timeoutMs);
      return { idx, ...res, started: started[idx] };
    })
  );
  return results;
}

async function isHealthy() {
  try {
    const r = await fetch(`${BASE}${DEFAULT.healthPath}`, { method: 'GET' });
    return r.ok;
  } catch {
    return false;
  }
}

async function main(opts = {}) {
  const cfg = { ...DEFAULT, ...opts };
  console.log(JSON.stringify({ target: cfg.targets, total: cfg.total, concurrency: cfg.concurrency, timeoutMs: cfg.timeoutMs }, null, 2));

  console.log('[health] before:', await isHealthy());

  const all = [];
  const totalJobs = cfg.total * cfg.targets.length;
  const batchSize = Math.max(1, cfg.concurrency);

  const t0 = performance.now();

  for (let tIdx = 0; tIdx < cfg.targets.length; tIdx++) {
    const path = cfg.targets[tIdx];
    const remainingForTarget = cfg.total;
    for (let start = 0; start < remainingForTarget; start += batchSize) {
      const chunk = Math.min(batchSize, remainingForTarget - start);
      if (chunk <= 0) break;
      const batchResults = await burst(path, chunk, cfg.timeoutMs);
      for (const r of batchResults) {
        all.push({
          target: path,
          idx: r.idx,
          status: r.status,
          ok: r.ok,
          ms: r.ms,
          error: r.error,
          started: r.started,
        });
      }
    }
  }

  const dt = (performance.now() - t0) / 1000;
  console.log(`[done] jobs=${all.length} duration_s=${dt.toFixed(2)}`);

  const ok = all.filter((r) => r.ok).length;
  const fail = all.filter((r) => !r.ok).length;
  const errorMsgs = all.filter((r) => r.ok === false).map((r) => r.error).filter(Boolean);
  const byStatus = {};
  for (const r of all) {
    const k = r.status ?? 'TIMEOUT/ABORT';
    byStatus[k] = (byStatus[k] || 0) + 1;
  }
  const sorted = all.map((r) => r.ms).sort((a, b) => a - b);
  const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
  const avg = sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0;

  console.log(`[summary]
 jobs=${all.length}
 ok=${ok}
 fail=${fail}
 duration_s=${dt.toFixed(2)}
 rps=${(all.length / dt).toFixed(2)}
 avg_ms=${avg.toFixed(1)}
 p50_ms=${pct(0.5).toFixed(1)}
 p95_ms=${pct(0.95).toFixed(1)}
 p99_ms=${pct(0.99).toFixed(1)}
 status_counts=${JSON.stringify(byStatus)}
 error_samples=${errorMsgs.slice(0, 8).join(' | ')}
`);
  console.log('[health] after:', await isHealthy());
}

const totalArg = Number(process.argv[2] ?? DEFAULT.total);
const concurrencyArg = Number(process.argv[3] ?? DEFAULT.concurrency);
const timeoutArg = Number(process.argv[4] ?? DEFAULT.timeoutMs);
main({ total: totalArg, concurrency: concurrencyArg, timeoutMs: timeoutArg }).catch((e) => {
  console.error('loadtest crashed:', e);
  process.exit(2);
});
