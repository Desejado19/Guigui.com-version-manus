// Round-trip real no PostgreSQL: grava texto português (incluindo NFD),
// lê de volta e confirma que a base preserva os caracteres. Tudo corre numa
// transação com ROLLBACK — nenhum dado fica gravado.
import 'dotenv/config';
import { afterAll, describe, expect, it } from 'vitest';
import { Client } from 'pg';
import { normalizeUserText } from '../../shared/textNormalization';

const connectionString = (process.env.DATABASE_URL || process.env.DATABASE_POOLER_URL || '').trim();

const samples = [
  'Administração',
  'Configurações',
  'Cidadão',
  'Informação',
  'Notificações',
  'Organização',
  'Promoção',
  'Publicação',
  'Segurança',
  'Transações',
  'Acessibilidade',
  'Autenticação',
  'Comércio',
  'Gestão',
  'Preço',
  'Descrição',
  'Guiné-Bissau',
];

describe.skipIf(!connectionString)('PostgreSQL preserva texto português', () => {
  const client = new Client({
    connectionString,
    ssl: /supabase|pooler|amazonaws|neon/i.test(connectionString) ? { rejectUnauthorized: false } : undefined,
  });
  let connected = false;

  const connect = async () => {
    if (connected) return;
    await client.connect();
    connected = true;
  };

  afterAll(async () => {
    if (connected) await client.end().catch(() => undefined);
  });

  it('aceita a codificação UTF-8 na base e no cliente', async () => {
    await connect();
    const encoding = await client.query(`
      SELECT current_setting('server_encoding') AS server, current_setting('client_encoding') AS client
    `);
    expect(encoding.rows[0].server).toBe('UTF8');
    expect(encoding.rows[0].client).toBe('UTF8');
  });

  it('grava, lê, atualiza e pesquisa todas as palavras de teste (ROLLBACK)', async () => {
    await connect();
    await client.query('BEGIN');
    try {
      await client.query('CREATE TEMP TABLE encoding_probe (id serial primary key, text_value text) ON COMMIT DROP');
      for (const [index, sample] of samples.entries()) {
        const inserted = await client.query(
          'INSERT INTO encoding_probe (text_value) VALUES ($1) RETURNING text_value, octet_length(text_value) AS bytes',
          [sample],
        );
        expect(inserted.rows[0].text_value).toBe(sample);
        expect(inserted.rows[0].bytes).toBe(Buffer.byteLength(sample, 'utf8'));

        const read = await client.query('SELECT text_value FROM encoding_probe WHERE id = $1', [index + 1]);
        expect(read.rows[0].text_value).toBe(sample);
        expect(read.rows[0].text_value).not.toContain('\uFFFD');
      }

      // Pesquisa antes da atualização: `ilike` exato e comparação sem acentos.
      const exact = await client.query("SELECT count(*)::int AS n FROM encoding_probe WHERE text_value ILIKE '%administração%'");
      expect(exact.rows[0].n).toBe(1);
      const folded = await client.query(
        `SELECT count(*)::int AS n FROM encoding_probe
          WHERE translate(lower(text_value), 'áàâãäåéèêëíìîïóôòõöúùûüçñýÿ', 'aaaaaaeeeeiiiiooooouuuucnyy') LIKE '%administracao%'`,
      );
      expect(folded.rows[0].n).toBeGreaterThanOrEqual(1);

      // Atualização: NFD entra normalizado em NFC.
      const nfd = 'Cidada\u0303o';
      await client.query('UPDATE encoding_probe SET text_value = $1 WHERE id = 1', [normalizeUserText(nfd)]);
      const updated = await client.query('SELECT text_value FROM encoding_probe WHERE id = 1');
      expect(updated.rows[0].text_value).toBe('Cidadão');
      expect(updated.rows[0].text_value.length).toBe('Cidadão'.length);

      const updatedSearch = await client.query("SELECT count(*)::int AS n FROM encoding_probe WHERE id = 1 AND text_value ILIKE '%cidadão%'");
      expect(updatedSearch.rows[0].n).toBe(1);

      const corrupt = await client.query("SELECT count(*)::int AS n FROM encoding_probe WHERE text_value LIKE '%' || chr(65533) || '%'");
      expect(corrupt.rows[0].n).toBe(0);
    } finally {
      await client.query('ROLLBACK');
    }
  });
});
