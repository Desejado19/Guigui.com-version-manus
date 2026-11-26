import express from 'express';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { latin1JsonBody } from '../../server/latin1Json';

let server: Server;
let baseUrl = '';

beforeAll(async () => {
  const app = express();
  app.use(latin1JsonBody);
  app.post('/echo', (req, res) => res.json({ body: req.body }));
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('endereço do servidor de teste indisponível');
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

async function postJsonBytes(bytes: Buffer, charset: string) {
  const response = await fetch(`${baseUrl}/echo`, {
    method: 'POST',
    headers: { 'Content-Type': `application/json; charset=${charset}` },
    body: new Uint8Array(bytes),
  });
  return { status: response.status, payload: await response.json() };
}

describe('corpo JSON em Latin-1/CP1252', () => {
  it('descodifica bytes Latin-1 verdadeiros', async () => {
    const bytes = Buffer.from(JSON.stringify({ name: 'João', city: 'Bissau' }), 'latin1');
    const { status, payload } = await postJsonBytes(bytes, 'iso-8859-1');
    expect(status).toBe(200);
    expect(payload.body).toEqual({ name: 'João', city: 'Bissau' });
  });

  it('aceita UTF-8 válido mesmo quando o cliente declara Latin-1', async () => {
    const bytes = Buffer.from(JSON.stringify({ name: 'João' }), 'utf8');
    const { status, payload } = await postJsonBytes(bytes, 'latin1');
    expect(status).toBe(200);
    expect(payload.body).toEqual({ name: 'João' });
  });

  it('descodifica pontuação CP1252 (aspas curvas)', async () => {
    const bytes = Buffer.from([
      0x7b, 0x22, 0x71, 0x22, 0x3a, 0x22, 0x93, 0x4a, 0x6f, 0xe3, 0x6f, 0x94, 0x22, 0x7d,
    ]);
    const { status, payload } = await postJsonBytes(bytes, 'windows-1252');
    expect(status).toBe(200);
    expect(payload.body).toEqual({ q: '“João”' });
  });

  it('rejeita JSON inválido com 400', async () => {
    const { status, payload } = await postJsonBytes(Buffer.from('{'), 'latin1');
    expect(status).toBe(400);
    expect(payload.code).toBe('INVALID_JSON');
  });
});
