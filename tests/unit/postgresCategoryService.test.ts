import { beforeEach, describe, expect, it, vi } from 'vitest';

type CategoryRow = {
  id: string;
  parent_id: string | null;
  name: string;
  description: string;
  is_active: boolean;
  sort_order: number;
  metadata: unknown;
};

const databaseState = vi.hoisted(() => ({
  pool: null as null | { query: (text: string) => Promise<{ rows: CategoryRow[] }> },
}));

vi.mock('../../server/db', () => ({
  get databasePool() {
    return databaseState.pool;
  },
}));

import { categoryRowsToCatalog, listPostgresCategoryCatalog } from '../../server/postgresCategoryService';

function categoryRow(
  overrides: Partial<CategoryRow> & Pick<CategoryRow, 'id' | 'name'>,
): CategoryRow {
  return {
    id: overrides.id,
    parent_id: null,
    name: overrides.name,
    description: '',
    is_active: true,
    sort_order: 0,
    metadata: {},
    ...overrides,
  };
}

describe('PostgreSQL category catalog', () => {
  beforeEach(() => {
    databaseState.pool = null;
  });

  it('maps category rows independently of query order', () => {
    const catalog = categoryRowsToCatalog([
      categoryRow({
        id: 'sub-b',
        parent_id: 'cat-z',
        name: 'Latte',
        sort_order: 0,
      }),
      categoryRow({
        id: 'cat-h',
        parent_id: 'hotelaria_saude_educacao',
        name: 'Hotel',
        sort_order: 0,
        metadata: { iconName: 'Hotel' },
      }),
      categoryRow({
        id: 'restauracao',
        name: 'Restauração',
        description: 'Group A',
        sort_order: 0,
      }),
      categoryRow({
        id: 'cat-z',
        parent_id: 'restauracao',
        name: 'Café',
        sort_order: 0,
        metadata: { iconName: 'Coffee' },
      }),
      categoryRow({
        id: 'sub-a',
        parent_id: 'cat-z',
        name: 'Espresso',
        sort_order: 0,
      }),
      categoryRow({
        id: 'hotelaria_saude_educacao',
        name: 'Hotelaria',
        description: 'Group B',
        sort_order: 1,
      }),
      categoryRow({
        id: 'cat-a',
        parent_id: 'restauracao',
        name: 'Alpha',
        sort_order: 0,
        metadata: { iconName: 'Store' },
      }),
    ]);

    expect(catalog).toEqual({
      groups: [
        { id: 'restauracao', name: 'Restauração', description: 'Group A' },
        { id: 'hotelaria_saude_educacao', name: 'Hotelaria', description: 'Group B' },
      ],
      categories: [
        { id: 'cat-a', name: 'Alpha', iconName: 'Store', groupId: 'restauracao', subcategories: [] },
        { id: 'cat-z', name: 'Café', iconName: 'Coffee', groupId: 'restauracao', subcategories: ['Espresso', 'Latte'] },
        { id: 'cat-h', name: 'Hotel', iconName: 'Hotel', groupId: 'hotelaria_saude_educacao', subcategories: [] },
      ],
    });
  });

  it('excludes inactive category rows', () => {
    const catalog = categoryRowsToCatalog([
      categoryRow({ id: 'restauracao', name: 'Restauração' }),
      categoryRow({
        id: 'cat-active',
        parent_id: 'restauracao',
        name: 'Active',
        metadata: { iconName: 'Store' },
      }),
      categoryRow({
        id: 'cat-inactive',
        parent_id: 'restauracao',
        name: 'Inactive',
        is_active: false,
        metadata: { iconName: 'Store' },
      }),
    ]);

    expect(catalog.categories.map(({ id }) => id)).toEqual(['cat-active']);
  });

  it('rejects orphaned category rows', () => {
    expect(() => categoryRowsToCatalog([
      categoryRow({ id: 'restauracao', name: 'Restauração' }),
      categoryRow({ id: 'orphan', parent_id: 'missing-category', name: 'Orphan' }),
    ])).toThrow(/orphan/i);
  });

  it('rejects categories without a valid icon name', () => {
    expect(() => categoryRowsToCatalog([
      categoryRow({ id: 'restauracao', name: 'Restauração' }),
      categoryRow({ id: 'cat-invalid', parent_id: 'restauracao', name: 'Invalid', metadata: { iconName: '' } }),
    ])).toThrow(/icon/i);
  });

  it('returns local category definitions when PostgreSQL is not configured', async () => {
    const catalog = await listPostgresCategoryCatalog();

    expect(catalog.groups).toHaveLength(5);
    expect(catalog.categories).toHaveLength(16);
    expect(catalog.groups[0]).toEqual({
      id: 'restauracao',
      name: 'Restauração, Cafés & Pequeno Comércio',
      description: 'Restaurantes, lanchonetes, bares e pequenos comércios de Bissau.',
    });
  });

  it('returns an empty catalog when the configured database has no category rows', async () => {
    const query = vi.fn(async (_sql: string) => ({ rows: [] }));
    databaseState.pool = { query };

    await expect(listPostgresCategoryCatalog()).resolves.toEqual({ groups: [], categories: [] });
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0]?.[0]).toContain('ORDER BY sort_order, id');
  });

  it('rejects a failed category query instead of returning an empty catalog', async () => {
    const failure = new Error('database unavailable');
    databaseState.pool = {
      query: async () => {
        throw failure;
      },
    };

    await expect(listPostgresCategoryCatalog()).rejects.toBe(failure);
  });
});
