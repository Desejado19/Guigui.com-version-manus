import { describe, expect, it } from 'vitest';
import { ADMIN_NAVIGATION } from '../../src/config/navigation';
import { ADMIN_ACCESS_MODULES } from '../../src/config/teamAccess';

/**
 * A navegação administrativa e a matriz de permissões são catálogos separados:
 * um colaborador só vê um módulo que lhe foi concedido, mas conceder um módulo
 * que não existe na navegação deixa a permissão sem destino. Este teste fixa
 * essa correspondência (foi o que faltou ao acrescentar o Email externo).
 */
describe('admin navigation and permissions', () => {
  it('exposes every grantable admin module in ADMIN_NAVIGATION', () => {
    const navigationIds = new Set<string>(
      ADMIN_NAVIGATION.flatMap((group) => group.items.map((item) => item.id)),
    );

    const unreachable = ADMIN_ACCESS_MODULES.map((module) => module.id).filter(
      (id) => !navigationIds.has(id),
    );

    expect(unreachable).toEqual([]);
  });

  it('keeps external email reachable and grantable', () => {
    const item = ADMIN_NAVIGATION.flatMap((group) => group.items).find(
      (candidate) => candidate.id === 'external_email',
    );
    const module = ADMIN_ACCESS_MODULES.find((candidate) => candidate.id === 'external_email');

    expect(item?.label).toBe('Email externo');
    expect(module?.actions).toContain('view');
    expect(module?.actions).toContain('create');
  });
});
