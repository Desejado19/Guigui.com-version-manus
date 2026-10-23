import { describe, expect, it } from 'vitest';
import { CATEGORY_GROUPS, MAIN_CATEGORIES } from '../../src/data/categoryCatalog';
import { buildCategorySeedRows } from '../../server/categoryCatalogSeed';

describe('category catalog', () => {
  it('defines five groups and sixteen main categories with unique IDs and valid group references', () => {
    expect(CATEGORY_GROUPS).toHaveLength(5);
    expect(MAIN_CATEGORIES).toHaveLength(16);

    const ids = [...CATEGORY_GROUPS, ...MAIN_CATEGORIES].map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);

    const groupIds = new Set(CATEGORY_GROUPS.map(({ id }) => id));
    expect(MAIN_CATEGORIES.every(({ groupId }) => groupIds.has(groupId))).toBe(true);
  });

  it('builds deterministic unique IDs for all subcategory rows', () => {
    const firstRows = buildCategorySeedRows();
    const secondRows = buildCategorySeedRows();
    const mainCategoryIds = new Set(MAIN_CATEGORIES.map(({ id }) => id));
    const subcategoryRows = firstRows.filter((row) => row.parentId && mainCategoryIds.has(row.parentId));
    const repeatedSubcategoryRows = secondRows.filter((row) => row.parentId && mainCategoryIds.has(row.parentId));

    expect(subcategoryRows.length).toBe(71);
    expect(new Set(subcategoryRows.map(({ id }) => id)).size).toBe(71);
    expect(subcategoryRows.map(({ id }) => id)).toEqual(repeatedSubcategoryRows.map(({ id }) => id));
    expect(subcategoryRows[0]).toMatchObject({
      id: 'cat-1-restaurantes',
      parentId: 'cat-1',
      name: 'Restaurantes',
    });
    expect(subcategoryRows.find(({ name }) => name === 'Cafés & Pastelarias')?.id).toBe('cat-1-cafes-pastelarias');
  });

  it('preserves icon metadata and explicit sort order within every parent', () => {
    const rows = buildCategorySeedRows();

    for (const [groupIndex, group] of CATEGORY_GROUPS.entries()) {
      expect(rows.find(({ id }) => id === group.id)?.sortOrder).toBe(groupIndex);

      const siblingCategories = MAIN_CATEGORIES.filter(({ groupId }) => groupId === group.id);
      siblingCategories.forEach((category, index) => {
        const categoryRow = rows.find(({ id }) => id === category.id);
        expect(categoryRow).toMatchObject({
          parentId: group.id,
          sortOrder: index,
          metadata: { iconName: category.iconName },
        });

        category.subcategories.forEach((subcategory, subcategoryIndex) => {
          expect(rows.find(({ parentId, name }) => parentId === category.id && name === subcategory)?.sortOrder)
            .toBe(subcategoryIndex);
        });
      });
    }
  });
});
