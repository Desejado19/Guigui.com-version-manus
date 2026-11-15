/**
 * Escritor ZIP mínimo (sem compressão, método "store").
 *
 * Usado para descarregar vários bilhetes numa única operação. Não há
 * dependências novas: o formato ZIP sem compressão cabe em poucas centenas de
 * linhas e os PDFs envolvidos já são pequenos e não comprimem bem.
 *
 * Referência: APPNOTE.TXT, secções 4.3.6 (local header), 4.3.12 (central
 * directory) e 4.3.16 (end of central directory).
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function encodeName(name: string): Uint8Array {
  return new TextEncoder().encode(name);
}

/** Data/hora no formato MS-DOS usado pelo ZIP (segundos com precisão de 2 s). */
function dosDateTime(date: Date): { time: number; date: number } {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, date: dosDate };
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

interface CentralRecord {
  name: Uint8Array;
  crc: number;
  size: number;
  offset: number;
}

export function createZip(entries: ZipEntry[], now: Date = new Date()): Uint8Array {
  const { time, date } = dosDateTime(now);
  const chunks: Uint8Array[] = [];
  const central: CentralRecord[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = encodeName(entry.name);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true); // assinatura
    localView.setUint16(4, 20, true); // versão necessária
    localView.setUint16(6, 0x0800, true); // nomes em UTF-8
    localView.setUint16(8, 0, true); // método: store
    localView.setUint16(10, time, true);
    localView.setUint16(12, date, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, size, true);
    localView.setUint32(22, size, true);
    localView.setUint16(26, name.length, true);
    localView.setUint16(28, 0, true);
    local.set(name, 30);

    chunks.push(local, entry.data);
    central.push({ name, crc, size, offset });
    offset += local.length + size;
  }

  const centralStart = offset;
  for (const record of central) {
    const header = new Uint8Array(46 + record.name.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x02014b50, true); // assinatura do diretório central
    view.setUint16(4, 20, true); // versão que criou
    view.setUint16(6, 20, true); // versão necessária
    view.setUint16(8, 0x0800, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, time, true);
    view.setUint16(14, date, true);
    view.setUint32(16, record.crc, true);
    view.setUint32(20, record.size, true);
    view.setUint32(24, record.size, true);
    view.setUint16(28, record.name.length, true);
    view.setUint16(30, 0, true); // extra
    view.setUint16(32, 0, true); // comentário
    view.setUint16(34, 0, true); // disco
    view.setUint16(36, 0, true); // atributos internos
    view.setUint32(38, 0, true); // atributos externos
    view.setUint32(42, record.offset, true);
    header.set(record.name, 46);
    chunks.push(header);
    offset += header.length;
  }

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, central.length, true);
  endView.setUint16(10, central.length, true);
  endView.setUint32(12, offset - centralStart, true);
  endView.setUint32(16, centralStart, true);
  endView.setUint16(20, 0, true);
  chunks.push(end);

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(total);
  let cursor = 0;
  for (const chunk of chunks) {
    output.set(chunk, cursor);
    cursor += chunk.length;
  }
  return output;
}
