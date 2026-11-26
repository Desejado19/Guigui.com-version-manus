import { randomUUID } from 'crypto';
import type { QueryResultRow } from 'pg';
import {
  BISSAU_LOCATIONS,
  groupLocations,
  type BissauLocationCatalogResponse,
  type BissauLocationDto,
  type BissauLocationKind,
} from '../shared/bissauLocations';
import { databasePool } from './db';

interface LocationRow extends QueryResultRow {
  id: string;
  name: string;
  sector: string;
  sector_order: number;
  kind: BissauLocationKind;
  aliases: string[] | null;
  sort_order: number;
  is_active: boolean;
  updated_at: Date | string;
}

export class LocationCatalogError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'LocationCatalogError';
  }
}

let seedingPromise: Promise<void> | null = null;

function pool() {
  if (!databasePool) {
    throw new LocationCatalogError('A base de dados PostgreSQL é necessária para o catálogo de localidades.', 503, 'DATABASE_REQUIRED');
  }
  return databasePool;
}

/**
 * Garante que os registos oficiais existem sem sobrescrever alterações feitas
 * pelo administrador. Corre uma vez por processo e é idempotente.
 */
export async function ensureLocationCatalog(): Promise<void> {
  if (!databasePool) return;
  if (!seedingPromise) {
    seedingPromise = (async () => {
      const db = pool();
      const existing = await db.query<{ id: string }>('SELECT id FROM locations');
      const ids = new Set(existing.rows.map((row) => row.id));
      const missing = BISSAU_LOCATIONS.filter((entry) => !ids.has(entry.id));
      if (missing.length === 0) return;
      for (const entry of missing) {
        await db.query(
          `INSERT INTO locations (id, name, sector, sector_order, kind, aliases, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [entry.id, entry.name, entry.sector, entry.sectorOrder, entry.kind, entry.aliases, entry.sortOrder],
        );
      }
    })().catch((error) => {
      seedingPromise = null;
      throw error;
    });
  }
  return seedingPromise;
}

function toDto(row: LocationRow): BissauLocationDto {
  return {
    id: row.id,
    name: row.name,
    sector: row.sector,
    sectorOrder: Number(row.sector_order),
    kind: row.kind,
    aliases: Array.isArray(row.aliases) ? row.aliases : [],
    sortOrder: Number(row.sort_order),
    isActive: Boolean(row.is_active),
  };
}

export async function listLocationCatalog(options: { includeInactive?: boolean } = {}): Promise<BissauLocationCatalogResponse> {
  const db = pool();
  await ensureLocationCatalog();
  const result = await db.query<LocationRow>(
    `SELECT id, name, sector, sector_order, kind, aliases, sort_order, is_active, updated_at
       FROM locations
      ORDER BY sector_order ASC, sort_order ASC, name ASC`,
  );
  const all = result.rows.map(toDto);
  const locations = options.includeInactive ? all : all.filter((entry) => entry.isActive);
  return {
    locations,
    groups: groupLocations(locations),
    updatedAt: result.rows.reduce<string>((latest, row) => {
      const value = new Date(row.updated_at).toISOString();
      return value > latest ? value : latest;
    }, new Date(0).toISOString()),
  };
}

function text(value: unknown, field: string, max = 120): string {
  const parsed = typeof value === 'string' ? value.trim() : '';
  if (!parsed) throw new LocationCatalogError(`${field} é obrigatório.`, 400, 'LOCATION_INPUT_REQUIRED');
  if (parsed.length > max) throw new LocationCatalogError(`${field} é demasiado longo.`, 400, 'LOCATION_INPUT_TOO_LONG');
  return parsed;
}

function aliasesFrom(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)))
    .slice(0, 20);
}

function kindFrom(value: unknown): BissauLocationKind {
  return value === 'zona' ? 'zona' : 'bairro';
}

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || randomUUID().slice(0, 8);
}

function uniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code?: string }).code === '23505';
}

export async function createLocation(input: Record<string, unknown>): Promise<BissauLocationDto> {
  const db = pool();
  await ensureLocationCatalog();
  const name = text(input.name, 'Nome');
  const sector = text(input.sector, 'Sector');
  const id = `loc-admin-${slug(name)}-${randomUUID().slice(0, 6)}`;
  // Herda a ordem do sector existente para a localidade não cair no fim da lista.
  const sectorOrderInput = Number(input.sectorOrder);
  const sectorRow = Number.isFinite(sectorOrderInput) && sectorOrderInput > 0
    ? { rows: [{ sector_order: sectorOrderInput }] }
    : await db.query<{ sector_order: number }>(
      'SELECT sector_order FROM locations WHERE sector = $1 ORDER BY sector_order LIMIT 1',
      [sector],
    );
  const sectorOrder = Number(sectorRow.rows[0]?.sector_order) || 9;
  try {
    const result = await db.query<LocationRow>(
      `INSERT INTO locations (id, name, sector, sector_order, kind, aliases, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, name, sector, sector_order, kind, aliases, sort_order, is_active, updated_at`,
      [id, name, sector, sectorOrder, kindFrom(input.kind), aliasesFrom(input.aliases), Number(input.sortOrder) || 999],
    );
    return toDto(result.rows[0]);
  } catch (error) {
    if (uniqueViolation(error)) {
      throw new LocationCatalogError('Já existe uma localidade com esse nome.', 409, 'LOCATION_ALREADY_EXISTS');
    }
    throw error;
  }
}

export async function updateLocation(id: string, input: Record<string, unknown>): Promise<BissauLocationDto> {
  const db = pool();
  await ensureLocationCatalog();
  const current = await db.query<LocationRow>('SELECT * FROM locations WHERE id = $1', [id]);
  if (!current.rows[0]) {
    throw new LocationCatalogError('Localidade não encontrada.', 404, 'LOCATION_NOT_FOUND');
  }
  const row = current.rows[0];
  const name = input.name === undefined ? row.name : text(input.name, 'Nome');
  const sector = input.sector === undefined ? row.sector : text(input.sector, 'Sector');
  const sectorOrder = input.sectorOrder === undefined ? Number(row.sector_order) : Number(input.sectorOrder) || 9;
  const kind = input.kind === undefined ? row.kind : kindFrom(input.kind);
  const aliases = input.aliases === undefined ? (row.aliases || []) : aliasesFrom(input.aliases);
  const sortOrder = input.sortOrder === undefined ? Number(row.sort_order) : Number(input.sortOrder) || 999;
  const isActive = input.isActive === undefined ? Boolean(row.is_active) : Boolean(input.isActive);
  try {
    const result = await db.query<LocationRow>(
      `UPDATE locations
          SET name = $2, sector = $3, sector_order = $4, kind = $5, aliases = $6,
              sort_order = $7, is_active = $8, updated_at = NOW()
        WHERE id = $1
        RETURNING id, name, sector, sector_order, kind, aliases, sort_order, is_active, updated_at`,
      [id, name, sector, sectorOrder, kind, aliases, sortOrder, isActive],
    );
    return toDto(result.rows[0]);
  } catch (error) {
    if (uniqueViolation(error)) {
      throw new LocationCatalogError('Já existe uma localidade com esse nome.', 409, 'LOCATION_ALREADY_EXISTS');
    }
    throw error;
  }
}

export async function setLocationActive(id: string, isActive: boolean): Promise<BissauLocationDto> {
  return updateLocation(id, { isActive });
}
