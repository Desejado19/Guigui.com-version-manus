import { describe, expect, it } from 'vitest';
import { createZip } from '../../src/utils/zip';

/** Lê o ZIP gerado sem bibliotecas externas: confirma assinaturas e conteúdo. */
function parseZip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const entries: Array<{ name: string; content: string }> = [];
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const name = new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + nameLength));
    const dataStart = offset + 30 + nameLength + extraLength;
    entries.push({ name, content: new TextDecoder().decode(bytes.slice(dataStart, dataStart + size)) });
    offset = dataStart + size;
  }
  const central = view.getUint32(offset, true);
  // O "end of central directory" fica sempre nos últimos 22 bytes (sem comentário).
  const endOffset = bytes.length - 22;
  const endSignature = view.getUint32(endOffset, true);
  const count = view.getUint16(endOffset + 10, true);
  return { entries, central, endSignature, count };
}

describe('createZip', () => {
  it('gera um ZIP sem compressão com todos os ficheiros', () => {
    const zip = createZip([
      { name: 'bilhete-1.pdf', data: new TextEncoder().encode('%PDF-1.4 primeiro') },
      { name: 'bilhete-2.pdf', data: new TextEncoder().encode('%PDF-1.4 segundo') },
    ]);
    const parsed = parseZip(zip);
    expect(parsed.count).toBe(2);
    expect(parsed.central).toBe(0x02014b50);
    expect(parsed.entries.map((entry) => entry.name)).toEqual(['bilhete-1.pdf', 'bilhete-2.pdf']);
    expect(parsed.entries[1].content).toBe('%PDF-1.4 segundo');
  });

  it('aceita nomes com acentos (UTF-8)', () => {
    const zip = createZip([{ name: 'bilhete-conclusão.pdf', data: new Uint8Array([1, 2, 3]) }]);
    expect(parseZip(zip).entries[0].name).toBe('bilhete-conclusão.pdf');
  });

  it('produz um ZIP vazio válido', () => {
    const zip = createZip([]);
    const view = new DataView(zip.buffer);
    expect(view.getUint32(0, true)).toBe(0x06054b50);
    expect(zip.length).toBe(22);
  });
});
