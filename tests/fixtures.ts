import { test as base, expect } from '@playwright/test';

// Reexporta tudo o que os specs já importavam (`request`, `Download`,
// `APIRequestContext`, tipos, etc.), mantendo-os a apontar para esta fixture.
export * from '@playwright/test';

/**
 * Fixture partilhada dos testes E2E.
 *
 * O guia de boas-vindas (WelcomeTour) abre automaticamente uma vez por conta e
 * usa um `div` modal de ecrã inteiro (`aria-modal="true"`, `z-[70]`). Num
 * contexto de browser novo o estado do guia está vazio, por isso o modal abre
 * em cada teste e intercepta todos os cliques, o que faz falhar os testes de
 * administração/empresa por timeout, não por defeito da aplicação.
 *
 * Em vez de repetir limpezas de localStorage em cada spec, esta fixture
 * instala um init script que faz o guia considerar-se já visto (skipped) para
 * qualquer conta: os testes nunca ficam bloqueados pelo overlay e o guia
 * continua a abrir normalmente em browsers reais.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      const prefix = 'guigui_onboarding_v1';
      const storageProto = Storage.prototype;
      const originalGetItem = storageProto.getItem;
      storageProto.getItem = function getItem(key: string) {
        if (typeof key === 'string' && key.startsWith(prefix)) {
          return JSON.stringify({ status: 'skipped', step: 0, updatedAt: new Date().toISOString() });
        }
        return originalGetItem.call(this, key);
      };
    });
    await use(page);
  },
});

export { expect };
