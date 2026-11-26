import { Router } from 'express';
import type { CategoryCatalogResponse } from '../src/types';
import { listPostgresCategoryCatalog } from './postgresCategoryService';

export interface CategoryRouteDependencies {
  listCatalog: () => Promise<CategoryCatalogResponse>;
  logger: Pick<Console, 'error'>;
}

export function createCategoryRouter(
  dependencies: CategoryRouteDependencies = {
    listCatalog: listPostgresCategoryCatalog,
    logger: console,
  },
): Router {
  const router = Router();
  router.get('/', async (_request, response) => {
    try {
      response.json(await dependencies.listCatalog());
    } catch (error) {
      dependencies.logger.error('[Guigui.com] category catalog load failed:', error);
      response.status(500).json({
        error: 'Não foi possível carregar o catálogo de categorias.',
        code: 'CATEGORY_CATALOG_LOAD_FAILED',
      });
    }
  });

  return router;
}
