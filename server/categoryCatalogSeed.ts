import type { PoolClient } from 'pg';
import { CATEGORY_GROUPS, MAIN_CATEGORIES } from '../src/data/categoryCatalog';

export interface CategorySeedRow {
  id: string;
  parentId: string | null;
  name: string;
  description: string;
  sortOrder: number;
  metadata?: Record<string, string>;
}

function normalizeSubcategoryId(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function buildCategorySeedRows(): CategorySeedRow[] {
  const groupRows = CATEGORY_GROUPS.map((group, sortOrder): CategorySeedRow => ({
    id: group.id,
    parentId: null,
    name: group.name,
    description: group.description,
    sortOrder,
  }));

  const categoryRows = MAIN_CATEGORIES.flatMap((category) => {
    const siblingCategories = MAIN_CATEGORIES.filter(({ groupId }) => groupId === category.groupId);
    const sortOrder = siblingCategories.findIndex(({ id }) => id === category.id);

    return [
      {
        id: category.id,
        parentId: category.groupId,
        name: category.name,
        description: '',
        sortOrder,
        metadata: { iconName: category.iconName },
      },
      ...category.subcategories.map((subcategory, subcategorySortOrder) => ({
        id: `${category.id}-${normalizeSubcategoryId(subcategory)}`,
        parentId: category.id,
        name: subcategory,
        description: '',
        sortOrder: subcategorySortOrder,
      })),
    ];
  });

  return [...groupRows, ...categoryRows];
}

export async function seedCategoryCatalog(client: Pick<PoolClient, 'query'>): Promise<void> {
  await client.query('BEGIN');

  try {
    for (const row of buildCategorySeedRows()) {
      await client.query(
        `INSERT INTO categories (id, parent_id, name, description, is_active, sort_order, metadata)
         VALUES ($1, $2, $3, $4, TRUE, $5, $6::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           parent_id = EXCLUDED.parent_id,
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           is_active = EXCLUDED.is_active,
           sort_order = EXCLUDED.sort_order,
           metadata = EXCLUDED.metadata`,
        [row.id, row.parentId, row.name, row.description, row.sortOrder, JSON.stringify(row.metadata ?? {})],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      throw new Error(
        `Category seed failed (${String(error)}) and transaction rollback failed (${String(rollbackError)}).`,
      );
    }
    throw error;
  }
}
