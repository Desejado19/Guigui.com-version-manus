import { describe, expect, it } from 'vitest';
import {
  ADMIN_ONLY_STATE_KEYS,
  PLATFORM_STATE_KEYS,
  PUBLIC_STATE_KEYS,
  isPublicAppStateKey,
  readAppStateForSession,
  resolveAppStateValue,
  resolveAppStateWrite,
  resolveBusinessScope,
  resolveBusinessWrite,
  resolveEventWrite,
} from '../../server/platformWriteAccess';

describe('escrita de estado da plataforma', () => {
  it('exige sempre uma sessão autenticada', () => {
    expect(resolveAppStateWrite(undefined, 'guigui_businesses')).toEqual({
      allowed: false,
      status: 401,
      code: 'AUTHENTICATION_REQUIRED',
    });
  });

  it('rejeita chaves que não pertencem ao espaço de estado da aplicação', () => {
    expect(resolveAppStateWrite('admin', 'chave_inventada')).toEqual({
      allowed: false,
      status: 400,
      code: 'APP_STATE_KEY_NOT_ALLOWED',
    });
  });

  it('permite que cada utilizador grave apenas a sua preferência de idioma', () => {
    expect(resolveAppStateWrite('user', 'user_language_user-1', 'user-1')).toEqual({ allowed: true });
    expect(resolveAppStateWrite('user', 'user_language_user-2', 'user-1')).toEqual({
      allowed: false,
      status: 403,
      code: 'APP_STATE_NOT_OWNER',
    });
  });

  it('impede um cidadão de alterar o directório, os planos ou o catálogo de preços', () => {
    for (const key of ['guigui_businesses', 'guigui_events', 'guigui_promotions', 'guigui_subscription_plans', 'guigui_monetization_catalog']) {
      expect(resolveAppStateWrite('user', key, 'user-1')).toEqual({
        allowed: false,
        status: 403,
        code: 'APP_STATE_WRITE_FORBIDDEN',
      });
    }
  });

  it('permite que um cidadão publique os seus posts, sujeitos a moderação', () => {
    expect(resolveAppStateWrite('user', 'guigui_user_posts', 'user-1')).toEqual({ allowed: true });
  });

  it('impede um cidadão de publicar stories, mesmo com plano pago', () => {
    // As stories são a vitrine das empresas e da administração; o cidadão
    // apenas as vê. Enviar a colecção inteira permitiria reescrever ou apagar
    // stories de empresas.
    expect(resolveAppStateWrite('user', 'guigui_stories', 'user-1')).toEqual({
      allowed: false,
      status: 403,
      code: 'STORY_PUBLISH_FORBIDDEN',
    });
  });

  it('dá à administração o controlo de todo o estado da plataforma', () => {
    for (const key of PLATFORM_STATE_KEYS) {
      expect(resolveAppStateWrite('admin', key, 'admin-1')).toEqual({ allowed: true });
    }
  });

  it('permite à empresa escrever apenas as chaves que lhe pertencem', () => {
    // Espelha BUSINESS_FORBIDDEN_VALUE_KEYS: catálogo, planos, modelo de
    // negócio, conversas e suporte são de administração.
    const forbiddenForBusiness = [
      'guigui_monetization_catalog',
      'guigui_subscription_plans',
      'guigui_admin_business_model_config',
      'guigui_conversations',
      'guigui_conversation_messages',
      'guigui_support_requests',
      'guigui_about_content',
    ];
    for (const key of PLATFORM_STATE_KEYS) {
      if (forbiddenForBusiness.includes(key)) {
        expect(resolveAppStateWrite('business', key, 'biz-1')).toEqual({
          allowed: false,
          status: 403,
          code: 'APP_STATE_WRITE_FORBIDDEN',
        });
      } else {
        expect(resolveAppStateWrite('business', key, 'biz-1'), key).toEqual({ allowed: true });
      }
    }
  });
});

describe('leitura pública do estado da plataforma', () => {
  it('não expõe a configuração do modelo de negócio a visitantes nem a perfis não administrativos', () => {
    const key = 'guigui_admin_business_model_config';
    expect(PUBLIC_STATE_KEYS.has(key)).toBe(false);
    expect(isPublicAppStateKey(key)).toBe(false);
    expect(ADMIN_ONLY_STATE_KEYS.has(key)).toBe(true);

    const value = { ticketCommissionPercent: 10 };

    expect(readAppStateForSession(key, undefined, { userId: '' }, value)).toEqual({
      allowed: false,
      status: 401,
      code: 'AUTHENTICATION_REQUIRED',
    });
    expect(readAppStateForSession(key, 'user', { userId: 'user-1' }, value)).toEqual({
      allowed: false,
      status: 403,
      code: 'APP_STATE_READ_FORBIDDEN',
    });
    expect(readAppStateForSession(key, 'business', { userId: 'user-1', businessId: 'biz-1' }, value)).toEqual({
      allowed: false,
      status: 403,
      code: 'APP_STATE_READ_FORBIDDEN',
    });
    expect(readAppStateForSession(key, 'admin', { userId: 'admin-1' }, value)).toEqual({
      allowed: true,
      value,
    });
  });

  it('mantém os catálogos públicos acessíveis sem sessão', () => {
    for (const key of [
      'guigui_businesses',
      'guigui_events',
      'guigui_promotions',
      'guigui_stories',
      'guigui_user_posts',
      'guigui_subscription_plans',
      'guigui_monetization_catalog',
    ]) {
      expect(isPublicAppStateKey(key), key).toBe(true);
      expect(readAppStateForSession(key, undefined, { userId: '' }, [1])).toEqual({
        allowed: true,
        value: [1],
      });
    }
  });

  it('continua a exigir sessão para conversas, suporte e encomendas sem sessão', () => {
    for (const key of ['guigui_conversations', 'guigui_support_requests', 'guigui_purchase_orders']) {
      expect(readAppStateForSession(key, undefined, { userId: '' }, []), key).toEqual({
        allowed: false,
        status: 401,
        code: 'AUTHENTICATION_REQUIRED',
      });
    }
  });
});

describe('escrita da ficha de empresa', () => {
  it('exige sessão e recusa um cidadão comum', () => {
    expect(resolveBusinessWrite(undefined, undefined, 'biz-1')).toEqual({
      allowed: false,
      status: 401,
      code: 'AUTHENTICATION_REQUIRED',
    });
    expect(resolveBusinessWrite('user', undefined, 'biz-1')).toEqual({
      allowed: false,
      status: 403,
      code: 'BUSINESS_WRITE_FORBIDDEN',
    });
  });

  it('limita a empresa à sua própria ficha', () => {
    expect(resolveBusinessWrite('business', 'biz-1', 'biz-1')).toEqual({ allowed: true });
    expect(resolveBusinessWrite('business', 'biz-1', 'biz-2')).toEqual({
      allowed: false,
      status: 403,
      code: 'BUSINESS_SCOPE_REQUIRED',
    });
  });

  it('recusa uma conta de negócio sem empresa associada', () => {
    expect(resolveBusinessWrite('business', undefined, 'biz-1')).toEqual({
      allowed: false,
      status: 403,
      code: 'BUSINESS_ACCOUNT_REQUIRED',
    });
  });

  it('permite à administração gerir qualquer ficha', () => {
    expect(resolveBusinessWrite('admin', undefined, 'biz-9')).toEqual({ allowed: true });
  });
});

describe('âmbito empresarial reutilizável', () => {
  it('exige sessão e recusa um cidadão', () => {
    expect(resolveBusinessScope(undefined, undefined, 'biz-1')).toEqual({
      allowed: false,
      status: 401,
      code: 'AUTHENTICATION_REQUIRED',
    });
    expect(resolveBusinessScope('user', 'biz-1', 'biz-1')).toEqual({
      allowed: false,
      status: 403,
      code: 'BUSINESS_SCOPE_FORBIDDEN',
    });
  });

  it('aceita apenas a empresa da sessão e recusa ids divergentes', () => {
    expect(resolveBusinessScope('business', 'biz-1', 'biz-1')).toEqual({ allowed: true });
    expect(resolveBusinessScope('business', 'biz-1', 'biz-2')).toEqual({
      allowed: false,
      status: 403,
      code: 'BUSINESS_SCOPE_REQUIRED',
    });
  });

  it('recusa uma conta de empresa sem empresa associada', () => {
    expect(resolveBusinessScope('business', undefined, 'biz-1')).toEqual({
      allowed: false,
      status: 403,
      code: 'BUSINESS_ACCOUNT_REQUIRED',
    });
  });

  it('mantém a administração sujeita às permissões administrativas, mas com acesso ao âmbito pedido', () => {
    expect(resolveBusinessScope('admin', undefined, 'biz-9')).toEqual({ allowed: true });
  });
});

describe('isolamento de leitura por dono e empresa', () => {
  const conversations = [
    { id: 'c-1', userId: 'user-1', businessId: 'biz-1' },
    { id: 'c-2', userId: 'user-2', businessId: 'biz-2' },
  ];
  const messages = [
    { id: 'm-1', conversationId: 'c-1' },
    { id: 'm-2', conversationId: 'c-2' },
  ];

  it('um cidadão só vê as suas conversas e mensagens', () => {
    const result = readAppStateForSession('guigui_conversations', 'user', { userId: 'user-1' }, conversations);
    expect(result).toEqual({ allowed: true, value: [conversations[0]] });

    const ids = new Set(['c-1']);
    expect(readAppStateForSession('guigui_conversation_messages', 'user', { userId: 'user-1' }, messages, ids)).toEqual({
      allowed: true,
      value: [messages[0]],
    });
  });

  it('uma empresa só vê o suporte e as encomendas que lhe pertencem', () => {
    const support = [
      { id: 's-1', businessId: 'biz-1', requesterId: 'user-9' },
      { id: 's-2', businessId: 'biz-2', requesterId: 'user-9' },
    ];
    expect(readAppStateForSession('guigui_support_requests', 'business', { userId: 'user-1', businessId: 'biz-1' }, support)).toEqual({
      allowed: true,
      value: [support[0]],
    });

    const orders = [
      { id: 'o-1', businessId: 'biz-1' },
      { id: 'o-2', businessId: 'biz-2' },
    ];
    expect(readAppStateForSession('guigui_purchase_orders', 'business', { userId: 'user-1', businessId: 'biz-1' }, orders)).toEqual({
      allowed: true,
      value: [orders[0]],
    });
  });

  it('recusa a leitura de uma chave privada desconhecida a qualquer perfil não administrativo', () => {
    expect(readAppStateForSession('guigui_private_unknown', 'user', { userId: 'user-1' }, [])).toEqual({
      allowed: false,
      status: 403,
      code: 'APP_STATE_READ_FORBIDDEN',
    });
  });
});

describe('escrita de eventos', () => {
  it('exige sessão e nunca aceita um cidadão isolado', () => {
    expect(resolveEventWrite(undefined, undefined, undefined)).toEqual({
      allowed: false,
      status: 401,
      code: 'AUTHENTICATION_REQUIRED',
    });
    expect(resolveEventWrite('user', undefined, 'biz-1')).toEqual({
      allowed: false,
      status: 403,
      code: 'EVENT_WRITE_FORBIDDEN',
    });
  });

  it('obliga o evento a pertencer à empresa organizadora da sessão', () => {
    expect(resolveEventWrite('business', 'biz-1', 'biz-1')).toEqual({ allowed: true });
    expect(resolveEventWrite('business', 'biz-1', 'biz-2')).toEqual({
      allowed: false,
      status: 403,
      code: 'BUSINESS_SCOPE_REQUIRED',
    });
    expect(resolveEventWrite('business', 'biz-1', undefined)).toEqual({
      allowed: false,
      status: 403,
      code: 'BUSINESS_SCOPE_REQUIRED',
    });
  });
});


describe('âmbito do valor gravado por uma empresa', () => {
  it('impede uma empresa de reescrever o catálogo de preços e os planos', () => {
    for (const key of ['guigui_monetization_catalog', 'guigui_subscription_plans', 'guigui_admin_business_model_config']) {
      expect(resolveAppStateValue('business', key, 'biz-1', [{ plans: [] }], [])).toEqual({
        allowed: false,
        code: 'APP_STATE_WRITE_FORBIDDEN',
      });
    }
  });

  it('impede uma empresa de reescrever conversas e suporte', () => {
    for (const key of ['guigui_conversations', 'guigui_conversation_messages', 'guigui_support_requests']) {
      expect(resolveAppStateValue('business', key, 'biz-1', [], []).allowed).toBe(false);
    }
  });

  it('repõe as empresas concorrentes que a empresa tentou apagar', () => {
    const stored = [{ id: 'biz-1', name: 'Minha Empresa' }, { id: 'biz-2', name: 'Concorrente' }];
    // A empresa envia apenas a sua ficha, como se apagasse a concorrente.
    const result = resolveAppStateValue('business', 'guigui_businesses', 'biz-1', [{ id: 'biz-1', name: 'Minha Empresa' }], stored);

    expect(result.allowed).toBe(true);
    expect(result.allowed === true ? result.value : null).toEqual([
      { id: 'biz-1', name: 'Minha Empresa' },
      { id: 'biz-2', name: 'Concorrente' },
    ]);
  });

  it('permite à empresa alterar apenas os seus próprios eventos', () => {
    const stored = [
      { id: 'evt-1', businessId: 'biz-1', title: 'Meu evento' },
      { id: 'evt-2', businessId: 'biz-2', title: 'Evento da concorrente' },
    ];
    const result = resolveAppStateValue('business', 'guigui_events', 'biz-1', [
      { id: 'evt-1', businessId: 'biz-1', title: 'Meu evento renomeado' },
      { id: 'evt-2', businessId: 'biz-2', title: 'Evento invadido' },
    ], stored);

    expect(result.allowed).toBe(true);
    expect(result.allowed === true ? result.value : null).toEqual([
      { id: 'evt-1', businessId: 'biz-1', title: 'Meu evento renomeado' },
      { id: 'evt-2', businessId: 'biz-2', title: 'Evento da concorrente' },
    ]);
  });

  it('recusa uma coleção inválida e uma conta de empresa sem empresa associada', () => {
    expect(resolveAppStateValue('business', 'guigui_businesses', 'biz-1', 'nao-e-uma-lista', [])).toEqual({
      allowed: false,
      code: 'APP_STATE_VALUE_INVALID',
    });
    expect(resolveAppStateValue('business', 'guigui_businesses', undefined, [], [])).toEqual({
      allowed: false,
      code: 'BUSINESS_ACCOUNT_REQUIRED',
    });
  });

  it('deixa a administração gravar o valor sem qualquer reposição', () => {
    const stored = [{ id: 'biz-1', name: 'A' }, { id: 'biz-2', name: 'B' }];
    const result = resolveAppStateValue('admin', 'guigui_businesses', undefined, [], stored);
    expect(result).toEqual({ allowed: true, value: [] });
  });

});
