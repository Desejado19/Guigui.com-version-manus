import type { QueryResultRow } from 'pg';
import { CATEGORY_GROUPS, MAIN_CATEGORIES } from '../src/data/categoryCatalog';
import type { CategoryCatalogResponse, CategoryGroupId } from '../src/types';
import { databasePool } from './db';

export interface CategoryRow extends QueryResultRow {
  id: string;
  parent_id: string | null;
  name: string;
  description: string;
  is_active: boolean;
  sort_order: number;
  metadata: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rowHasIconName(row: CategoryRow): boolean {
  return isRecord(row.metadata) && Object.prototype.hasOwnProperty.call(row.metadata, 'iconName');
}

function iconNameForRow(row: CategoryRow): string {
  if (!isRecord(row.metadata)) {
    throw new Error(`Category ${row.id} has invalid metadata.`);
  }

  const iconName = row.metadata.iconName;
  if (typeof iconName !== 'string' || !iconName.trim()) {
    throw new Error(`Category ${row.id} has no valid iconName metadata.`);
  }

  return iconName;
}

function compareRows(left: CategoryRow, right: CategoryRow): number {
  return left.sort_order - right.sort_order
    || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
}

function isCategoryGroupId(value: string): value is CategoryGroupId {
  return CATEGORY_GROUPS.some((group) => group.id === value);
}

export function categoryRowsToCatalog(rows: CategoryRow[]): CategoryCatalogResponse {
  const activeRows = rows.filter((row) => row.is_active);
  const rowsById = new Map<string, CategoryRow>();

  for (const row of activeRows) {
    if (rowsById.has(row.id)) {
      throw new Error(`Category catalog contains duplicate ID ${row.id}.`);
    }
    if (!isRecord(row.metadata)) {
      throw new Error(`Category ${row.id} has invalid metadata.`);
    }
    rowsById.set(row.id, row);
  }

  const groupRows = activeRows
    .filter((row) => row.parent_id === null)
    .sort(compareRows);
  if (groupRows.some(rowHasIconName)) {
    throw new Error('Category catalog contains a root category with no group parent.');
  }

  const groupIds = new Set(groupRows.map(({ id }) => id));
  const categoryRows = activeRows
    .filter((row) => row.parent_id !== null && groupIds.has(row.parent_id))
    .sort(compareRows);
  for (const row of categoryRows) {
    if (!row.parent_id || !isCategoryGroupId(row.parent_id)) {
      throw new Error(`Category ${row.id} references an unsupported category group.`);
    }
    iconNameForRow(row);
  }

  const categoryIds = new Set(categoryRows.map(({ id }) => id));
  const subcategoryRows = activeRows
    .filter((row) => row.parent_id !== null && categoryIds.has(row.parent_id))
    .sort(compareRows);
  if (subcategoryRows.some(rowHasIconName)) {
    throw new Error('Category catalog contains a category nested below a subcategory.');
  }

  const handledIds = new Set([
    ...groupRows.map(({ id }) => id),
    ...categoryRows.map(({ id }) => id),
    ...subcategoryRows.map(({ id }) => id),
  ]);
  const orphan = activeRows.find(({ id }) => !handledIds.has(id));
  if (orphan) {
    throw new Error(`Category catalog contains orphaned row ${orphan.id}.`);
  }

  const subcategoriesByParent = new Map<string, string[]>();
  for (const row of subcategoryRows) {
    if (!row.parent_id) continue;
    const subcategories = subcategoriesByParent.get(row.parent_id) ?? [];
    subcategories.push(row.name);
    subcategoriesByParent.set(row.parent_id, subcategories);
  }

  const categories = groupRows.flatMap((groupRow) => categoryRows
    .filter(({ parent_id }) => parent_id === groupRow.id)
    .map((row) => ({
      id: row.id,
      name: row.name,
      iconName: iconNameForRow(row),
      groupId: groupRow.id as CategoryGroupId,
      subcategories: subcategoriesByParent.get(row.id) ?? [],
    })));

  return {
    groups: groupRows.map(({ id, name, description }) => ({ id, name, description })),
    categories,
  };
}

export async function listPostgresCategoryCatalog(): Promise<CategoryCatalogResponse> {
  if (!databasePool) {
    return {
      groups: CATEGORY_GROUPS.map(({ id, name, description }) => ({ id, name, description })),
      categories: MAIN_CATEGORIES,
    };
  }

  const result = await databasePool.query<CategoryRow>(
    `SELECT id, parent_id, name, description, is_active, sort_order, metadata
     FROM categories
     ORDER BY sort_order, id`,
  );
  return categoryRowsToCatalog(result.rows);
}
