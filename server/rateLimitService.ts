import { databasePool, withDbIdentity } from './db';

export async function consumeDistributedRateLimit(key: string, windowMs: number, maxRequests: number): Promise<boolean | null> {
  if (!databasePool) return null;
  // Infraestrutura de plataforma (balde de rate-limit): a escrita é uma trilha
  // de sistema, não uma operação do pedido — corre sem identidade, no padrão
  // de persistencia de auditoria (fase 1).
  const result = await withDbIdentity({ userId: '', role: 'anon', system: true }, () =>
    databasePool!.query(
    // A coluna `expires_at` da tabela viva é NOT NULL sem default, pelo que o
    // INSERT tem de a fornecer (fim da janela). Sem isto o Postgres devolve
    // 23502 e o processo morre por rejeição não tratada no middleware Express.
    `INSERT INTO rate_limit_buckets (bucket_key,window_started_at,request_count,updated_at,expires_at)
     VALUES ($1,NOW(),1,NOW(),NOW() + make_interval(secs => $2::double precision / 1000))
     ON CONFLICT (bucket_key) DO UPDATE SET
       window_started_at=CASE WHEN EXTRACT(EPOCH FROM (NOW()-rate_limit_buckets.window_started_at))*1000 >= $2 THEN NOW() ELSE rate_limit_buckets.window_started_at END,
       request_count=CASE WHEN EXTRACT(EPOCH FROM (NOW()-rate_limit_buckets.window_started_at))*1000 >= $2 THEN 1 ELSE rate_limit_buckets.request_count+1 END,
       expires_at=CASE WHEN EXTRACT(EPOCH FROM (NOW()-rate_limit_buckets.window_started_at))*1000 >= $2 THEN NOW() + make_interval(secs => $2::double precision / 1000) ELSE rate_limit_buckets.expires_at END,
       updated_at=NOW()
     RETURNING request_count`,
    [key, windowMs],
  ));
  return Number(result.rows[0]?.request_count || maxRequests + 1) <= maxRequests;
}
