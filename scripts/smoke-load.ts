const baseUrl = process.env.LOAD_BASE_URL || 'http://127.0.0.1:3013';
const requests = Number(process.env.LOAD_REQUESTS || 100);
const concurrency = Number(process.env.LOAD_CONCURRENCY || 10);

async function run(): Promise<void> {
  let next = 0;
  const durations: number[] = [];
  let errors = 0;
  async function worker(): Promise<void> {
    while (next < requests) {
      const index = next++;
      const started = performance.now();
      try {
        const response = await fetch(`${baseUrl}/api/health?load=${index}`);
        if (!response.ok) errors++;
      } catch {
        errors++;
      } finally {
        durations.push(performance.now() - started);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, requests) }, () => worker()));
  durations.sort((a, b) => a - b);
  const percentile = (value: number) => Math.round(durations[Math.min(durations.length - 1, Math.floor(durations.length * value))] * 100) / 100;
  console.log(JSON.stringify({ baseUrl, requests, concurrency, errors, p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99) }));
  if (errors > 0) {
    console.error(`smoke-load: ${errors}/${requests} pedidos falharam. Confirme que o servidor está a escutar em ${baseUrl} (npm run dev) ou defina LOAD_BASE_URL com o endereço a testar.`);
  }
  if (errors > 0) process.exitCode = 1;
}

await run();
