import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'crypto';
import { BODY_PARSED, latin1JsonBody } from './server/latin1Json';
import { normalizeDeep } from './shared/textNormalization';
import { GoogleGenAI } from '@google/genai';
import {
  AuditEntry,
  TicketForValidation,
  createAuditEntry,
  firstIssueMessage,
  signTicket,
  hasValidTicketSignature,
  validatePaymentInput,
  validatePurchaseInput,
  validateUserIdentity,
  validateTicketForEntry,
} from './server/validationService';
import {
  createIdentityAccess,
  createSessionAccessMiddleware,
  listUserSessions,
  resolveSessionContext,
  revokeUserSessionById,
  SESSION_COOKIE_NAME,
  type BusinessTeamPermissions,
  type BusinessTeamRole,
  type IdentityAccess,
  type PublicIdentity,
} from './server/modules/identity-access';
import { createGoogleIdTokenVerifier } from './server/modules/identity-access/infrastructure/googleIdTokenVerifier';
import { createGoogleOAuthRouter } from './server/googleOAuthRoutes';
import { normaliseAndValidateEmail, normaliseEmailForAccount } from './shared/emailAddress';
import { evaluatePassword } from './shared/passwordPolicy';
import { loadJson, saveJson } from './server/runtimeStore';
import { createPaymentAdapters } from './server/paymentService';
import { localizeApiPayload, resolveRequestLanguage } from './server/i18n';
import { LANGUAGE_CYCLE } from './src/utils/i18n';
import { getBusinessProfileCompletion } from './src/utils/businessProfile';
import {
  accessFromLegacyPermissions,
  canPerformAction,
  legacyPermissionsFromAccess,
  normalizeTeamAccess,
  type TeamModuleAccess,
} from './src/config/teamAccess';
import {
  createAdminStaff,
  createCompanyMember,
  findCompanyMember,
  listAccessActivity,
  listAdminAccessActivity,
  listAdminStaff,
  listCompanyMembers,
  recordAccessChange,
  removeAdminStaff,
  removeCompanyMember,
  updateAdminStaff,
  updateCompanyMember,
} from './server/teamAccessService';
import {
  acceptTeamInvitation,
  createTeamInvitationRecord,
  inspectTeamInvitation,
  invitationModuleSummary,
  invitationRoleLabel,
  listTeamInvitations,
  markInvitationSent,
  resendTeamInvitation,
  revokeTeamInvitation,
} from './server/teamInvitationService';
import { addSubscriptionPeriod } from './src/utils/subscriptions';
import { checkDatabaseConnection, databaseConfigured, databasePool } from './server/db';
import {
  FinanceError,
  authorizeRefund,
  createReconciliation,
  createRefund,
  getFinanceStatements,
  getFinanceSummary,
  getFinanceTransaction,
  getOperatorOverview,
  listFinanceTransactions,
  listOperationalAlerts,
  listPendingPayments,
  listReconciliations,
  listRefunds,
  processRefund,
  recordPendingAction,
  rejectRefund,
  updateOperatorConfig,
  updateReconciliation,
} from './server/financeAdminService';
import {
  PayoutError,
  createPayout,
  getCompanyFinance,
  getTicketFinanceOverview,
  listPayouts,
  updatePayoutStatus,
} from './server/financePayoutService';
import {
  CommercialError,
  changeSubscriptionStatus,
  createCommercialPlan,
  createFeature,
  createPackage,
  createPriceGroup,
  createProduct,
  duplicateCommercialPlan,
  getCommercialOverview,
  getCommercialPlanConfiguration,
  getCommercialSubscriptionDetail,
  getSubscriptionEntitlements,
  changeSubscriptionPlan,
  updateSubscriptionExceptions,
  getLegacyTicketFeePolicy,
  getProductSales,
  getPublicCommercialCatalog,
  listCommercialAudit,
  listCommercialSubscriptions,
  getCompanyPlanEventQuota,
  renewSubscription,
  resolveDatabaseCommercialPrice,
  toggleCommercialPlan,
  updateCommercialPlan,
  updateCommercialRules,
  updateFeature,
  updatePlanConfiguration,
  updatePriceMatrix,
  updateProduct,
  updateTicketFees,
} from './server/commercialAdminService';
import { createCategoryRouter } from './server/categoryRoutes';
import { createQualityAuditRouter } from './server/qualityAuditRoutes';
import { createStoryRouter } from './server/storyRoutes';
import { readFile } from 'node:fs/promises';
import { injectInstitutionalMeta, injectPolicyMeta, registerInstitutionalRoutes } from './server/institutional/routes';
import { createInstitutionalRepository } from './server/institutional/repository';
import { createHealthHandler } from './server/modules/platform-foundation/http/healthHandler';
import { createHttpCompressionMiddleware } from './server/httpCompression';
import { loadPlatformRuntimeConfig } from './server/modules/platform-foundation/config/platformRuntimeConfig';
import { BUSINESS_ROLE_PERMISSIONS } from './src/utils/businessPermissions';
import { activatePostgresTicketReservations, findPostgresTicket, listPostgresTicketsForUser, markPostgresTicketUsed, persistPostgresTickets, releaseExpiredPostgresTicketReservations } from './server/postgresTicketService';
import { cancelPostgresTicket, exportPostgresTicketsByBuyer, findPostgresEventTitleForCompany, findPostgresTicketForLifecycle, listPostgresTicketsForCompany } from './server/postgresTicketLifecycleService';
import { buildOfflineManifest, syncOfflineValidations, type OfflineValidationRecord } from './server/offlineScannerService';
import { listPostgresPayments, persistPostgresPayment, recordPostgresPaymentEvent } from './server/postgresPaymentService';
import { persistPostgresAudit } from './server/postgresAuditService';
import { findPostgresModeration, listPostgresModeration, persistPostgresModeration, persistPostgresModerationReview } from './server/postgresModerationService';
import { decideModerationSubmission, getModerationSubmission, listModerationSubmissions, ModerationSubmissionError, resubmitModerationSubmission, type DecisionAction } from './server/postgresModerationSubmissionService';
import { canAccessSupportTicket, createPostgresConversation, createPostgresConversationMessage, createPostgresSupportReply, getConversationParticipants, getSupportTicketParticipants, listPostgresConversations, listPostgresNotifications, listPostgresSupportTickets, markPostgresConversationRead, markPostgresNotificationRead, persistPostgresNotification, persistPostgresSupportTicket, updatePostgresSupportStatus } from './server/postgresCommunicationService';
import { markPostgresMonetizationRefunded, persistPostgresMonetization } from './server/postgresMonetizationService';
import { persistPostgresCatalog } from './server/postgresCatalogService';
import { createPostgresReview, flagPostgresReview, isReviewAllowed, listPostgresReviews, moderatePostgresReview, replyPostgresReview } from './server/postgresReviewService';
import { normaliseReviewComment, validateReviewInput } from './src/utils/reviews';
import { assignPostgresBusinessOwner, decidePostgresBusiness, deletePostgresBusiness, getAppState, getPostgresBusiness, InvalidFeaturedBusinessOrderError, listPendingPostgresBusinesses, listPostgresBusinesses, listPostgresEvents, persistPostgresBusiness, persistPostgresEvent, setAppState, setPostgresBusinessFeaturedOrder, updatePostgresBusinessProfile, updatePostgresBusinessStatus } from './server/postgresBusinessService';

import {
  addPostComment,
  isPostReactionType,
  listPostEngagements,
  registerPostReply,
  registerPostShare,
  setPostReaction,
} from './server/postEngagementService';
import { onRealtimeEvent, publishRealtime, realtimeStatus, startRealtimeListener } from './server/realtimeBus';
import { locationMatches } from './shared/bissauLocations';
import {
  LocationCatalogError,
  createLocation,
  listLocationCatalog,
  setLocationActive,
  updateLocation,
} from './server/locationCatalogService';
import { consumeDistributedRateLimit } from './server/rateLimitService';
import { consumeAccountRateLimit, resetAccountRateLimit } from './server/accountRateLimit';
import { createPostgresObservabilityRepository } from './server/modules/platform-foundation/observability/adapters/postgresObservabilityRepository';
import { createObservabilityHandlers } from './server/modules/platform-foundation/observability/http/observabilityHandlers';
import { createObservabilityMiddleware } from './server/modules/platform-foundation/observability/http/observabilityMiddleware';
import { HttpMetricsRegistry } from './server/modules/platform-foundation/observability/domain/httpMetrics';
import { getProductFunnel, persistProductEvent } from './server/productAnalyticsService';
import {
  createSystemIncident,
  getSystemApiMonitoring,
  getSystemAvailability,
  getSystemDatabase,
  getSystemIncident,
  getSystemInfrastructure,
  getSystemOverview,
  getSystemResources,
  getSystemSecurity,
  getSystemSettings,
  listSystemIncidents,
  listSystemLogs,
  startSystemMonitor,
  updateSystemIncident,
  updateSystemSettings,
} from './server/systemMonitoringService';
import { createSystemLogMiddleware } from './server/systemLogService';
import { canViewTransaction, resolveTransactionAccess } from './server/paymentAccessService';
import { listOwnedTickets } from './server/ticketAccessService';
import { isPublicAppStateKey, readAppStateForSession, resolveAppStateValue, resolveAppStateWrite, resolveBusinessScope, resolveBusinessWrite, resolveEventWrite, visibleConversationIds } from './server/platformWriteAccess';
import { startBackupScheduler, triggerLocalBackup } from './server/backupService';
import { describeSmsGateway } from './server/smsGatewayService';
import { deliverConfirmedTicketPurchase } from './server/ticketPurchaseDeliveryService';
import { getTicketOffer } from './server/ticketCatalogService';
import { ticketInventory } from './server/ticketInventoryService';
import { buildTicketFeeSnapshot, quoteTicketPurchase, ticketFeeSnapshotForUnit } from './server/ticketPurchaseDomain';
import {
  EXPORT_SECTIONS,
  buildEventCsv,
  buildEventPdf,
  buildEventXlsx,
  filterEventData,
  loadEventControlCenter,
  normaliseSections,
  type EventViewer,
} from './server/eventControlCenter';
import { executeTicketPurchase, type TicketPurchaseResult } from './server/ticketPurchaseUseCase';
import { createEmailDeliveryAdapter } from './server/integrations/emailDeliveryAdapter';
import { createExternalEmailSender, EmailConfigurationError, ExternalEmailValidationError } from './server/email';
import { createSimulatedSmsAdapter } from './server/integrations/simulatedAdapters';
import { createScheduledItem, ensureDemoScheduledItems, listScheduledItems, processDueScheduledItems, updateScheduledItem, SCHEDULING_TIMEZONE } from './server/schedulingService';
import type { ScheduledItem } from './src/types';
import type { MonetizationCatalog, MonetizationLedgerEntry, MonetizationWallet } from './src/types';
import { DEFAULT_MONETIZATION_CATALOG, calculateTicketFees, createLedgerEntry, getCommercialProduct, normaliseMonetizationCatalog, resolveProductPrice } from './src/data/monetizationCatalog';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const emailDelivery = createEmailDeliveryAdapter();
const externalEmail = createExternalEmailSender();
const smsDelivery = createSimulatedSmsAdapter();
type CommunicationSubscriber = {
  userId: string;
  role: 'user' | 'business' | 'admin';
  businessId: string | null;
};
type CommunicationRecipients = { userId?: string | null; businessId?: string | null };
// Cada ligação SSE pertence a um participante. Os sinais de conversas e tickets
// só são escritos nas ligações de quem participa neles.
const communicationStreams = new Map<import('express').Response, CommunicationSubscriber>();
const communicationStreamReaches = (
  subscriber: CommunicationSubscriber,
  event: string,
  recipients: CommunicationRecipients,
) => {
  if (recipients.userId && subscriber.userId === recipients.userId) return true;
  if (recipients.businessId && subscriber.role === 'business' && subscriber.businessId === recipients.businessId) return true;
  // A administração acompanha os pedidos de suporte, mas não as conversas comerciais.
  return event === 'support' && subscriber.role === 'admin';
};
// Publica no canal partilhado; a entrega às ligações SSE locais é feita
// pelo consumidor registado abaixo, em todas as instâncias.
const broadcastCommunication = (event: string, payload: Record<string, unknown>, recipients: CommunicationRecipients) => {
  void publishRealtime('communication', {
    event,
    payload,
    userId: recipients.userId ?? null,
    businessId: recipients.businessId ?? null,
  });
};
const postEngagementStreams = new Set<import('express').Response>();
const broadcastPostEngagement = (payload: { postId: string }) => {
  void publishRealtime('post_engagement', payload);
};
const writeRealtimeStream = (streams: Set<import('express').Response>, data: string) => {
  streams.forEach((stream) => {
    try { stream.write(data); } catch { streams.delete(stream); }
  });
};

onRealtimeEvent((envelope) => {
  if (envelope.type === 'post_engagement') {
    writeRealtimeStream(postEngagementStreams, `event: engagements\ndata: ${JSON.stringify(envelope.payload)}\n\n`);
    return;
  }
  if (envelope.type === 'communication') {
    const wrapper = envelope.payload as {
      event?: string;
      payload?: Record<string, unknown>;
      userId?: string | null;
      businessId?: string | null;
    };
    if (!wrapper.event || !wrapper.payload) return;
    // Sinal sem destinatários não é reencaminhado: sem isto voltaria a chegar a todos.
    const recipients: CommunicationRecipients = {
      userId: typeof wrapper.userId === 'string' ? wrapper.userId : null,
      businessId: typeof wrapper.businessId === 'string' ? wrapper.businessId : null,
    };
    if (!recipients.userId && !recipients.businessId) return;
    const data = `event: ${wrapper.event}\ndata: ${JSON.stringify(wrapper.payload)}\n\n`;
    communicationStreams.forEach((subscriber, stream) => {
      if (!communicationStreamReaches(subscriber, wrapper.event as string, recipients)) return;
      try { stream.write(data); } catch { communicationStreams.delete(stream); }
    });
  }
});

const runtimeConfig = loadPlatformRuntimeConfig(process.env);
const PORT = runtimeConfig.port;
const isProduction = runtimeConfig.isProduction;
const configuredScannerDoorCode = process.env.SCANNER_DOOR_CODE?.trim() || 'PORTA2026';
const ticketSigningSecret = process.env.TICKET_SIGNING_SECRET?.trim() || (!isProduction ? 'guigui-ticket-development-secret' : undefined);
const paymentWebhookSecret = process.env.PAYMENT_WEBHOOK_SECRET?.trim() || (!isProduction ? 'guigui-payment-webhook-development-secret' : undefined);
const demoAccountsEnabled = process.env.ENABLE_DEMO_ACCOUNTS !== 'false';
if (isProduction) {
  const missingSecrets = [
    !process.env.SESSION_COOKIE_SECRET?.trim() && 'SESSION_COOKIE_SECRET',
    !ticketSigningSecret && 'TICKET_SIGNING_SECRET',
    !paymentWebhookSecret && 'PAYMENT_WEBHOOK_SECRET',
    !process.env.SCANNER_DOOR_CODE?.trim() && 'SCANNER_DOOR_CODE',
  ].filter((value): value is string => Boolean(value));
  if (missingSecrets.length > 0) {
    throw new Error(`Configuração de produção incompleta. Variáveis obrigatórias em falta: ${missingSecrets.join(', ')}`);
  }
}
const paymentAdapters = createPaymentAdapters({
  webhookSecret: paymentWebhookSecret,
  autoConfirmSandbox: process.env.PAYMENT_SANDBOX_AUTOCONFIRM !== 'false',
});

const httpMetricsRegistry = new HttpMetricsRegistry();
const observabilityRepository = createPostgresObservabilityRepository(
  databasePool
    ? { query: (text: string, values: unknown[]) => databasePool.query(text, values) }
    : null,
);
const observabilityHandlers = createObservabilityHandlers({
  registry: httpMetricsRegistry,
  repository: observabilityRepository,
});

app.disable('x-powered-by');
// Atrás do proxy/balanceador, confiar apenas no número de proxies configurado.
// Sem isto `req.ip` seria o IP interno do proxy e RateLimit/auditoria agregavam
// todos os clientes no mesmo balde.
app.set('trust proxy', runtimeConfig.trustProxy);
// gzip/brotli para JSON e outros corpos de texto; SSE e ficheiros em streaming passam intactos.
app.use(createHttpCompressionMiddleware({
  minBytes: 1024,
  // Cache curta do corpo comprimido; TTL 0 desliga-a (útil para comparar).
  cacheTtlMs: Number(process.env.HTTP_COMPRESSION_CACHE_TTL_MS ?? 5000),
}));
// Middleware anti-cache para forçar o navegador a buscar tudo novo (resolve tela branca por cache/Service Worker)
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});
app.use(createObservabilityMiddleware({
  registry: httpMetricsRegistry,
  persistRequestMetric: observabilityRepository.persistRequestMetric,
  requestIdFrom,
  logger: console,
}));
// Logs técnicos reais: apenas respostas com erro ou lentas, sem corpos de pedido.
app.use(createSystemLogMiddleware(requestIdFrom));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=()');
  if (isProduction) {
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'self'",
      "form-action 'self'",
      // O botão "Continuar com Google" carrega o script e o iframe oficiais.
      "script-src 'self' 'unsafe-inline' https://accounts.google.com",
      "frame-src https://accounts.google.com",
      // O GSI injeta a folha de estilos do botão a partir de accounts.google.com.
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
      "img-src 'self' data: https:",
      "font-src 'self' data: https: https://fonts.gstatic.com",
      "connect-src 'self' https:",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join('; '));
  }
  if (isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

const allowedOrigins = new Set(
  runtimeConfig.allowedOrigins,
);

const CSRF_COOKIE_NAME = '_csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function readCookie(req: express.Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  if (!match) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function createCsrfToken(): string {
  return randomBytes(32).toString('hex');
}

// Emite o cookie em qualquer pedido (incluindo a página inicial), para a SPA
// poder ler o token mesmo antes do primeiro GET /api.
app.use((req, res, next) => {
  const current = readCookie(req, CSRF_COOKIE_NAME);
  const token = current && CSRF_TOKEN_PATTERN.test(current) ? current : createCsrfToken();
  if (token !== current) {
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      sameSite: 'lax',
      secure: isProduction,
      path: '/',
      maxAge: 2 * 60 * 60 * 1000,
    });
  }
  res.locals.csrfToken = token;
  next();
});

app.get('/api/csrf', (req, res) => {
  res.json({ csrfToken: res.locals.csrfToken });
});

function normalizeOrigin(value: string): string | undefined {
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function trustedRequestOrigins(req: express.Request): Set<string> {
  const trusted = new Set<string>();
  for (const value of [...allowedOrigins, runtimeConfig.appUrl || '']) {
    const origin = normalizeOrigin(value);
    if (origin) trusted.add(origin);
  }
  const ownOrigin = normalizeOrigin(`${req.protocol}://${req.get('host') || ''}`);
  if (ownOrigin) trusted.add(ownOrigin);
  return trusted;
}

function isTrustedNavigationOrigin(req: express.Request, value: string): boolean {
  const origin = normalizeOrigin(value);
  return Boolean(origin && trustedRequestOrigins(req).has(origin));
}

function sameToken(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  try {
    return timingSafeEqual(Buffer.from(left), Buffer.from(right));
  } catch {
    return false;
  }
}

function validateStateChangingRequest(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (SAFE_METHODS.has(req.method)) return next();
  // Webhooks de pagamento autenticam-se pela assinatura HMAC do fornecedor e
  // não têm browser/cookie; o Origin/CSRF não se aplica a este chamador.
  if (/^\/(?:api\/)?payments\/webhook\/[^/]+\/?$/.test(req.path)) return next();

  const origin = req.get('origin');
  const referer = req.get('referer');
  if (!origin && !referer) {
    return res.status(403).json({ error: 'Origem do pedido ausente.', code: 'CSRF_ORIGIN_MISSING' });
  }
  if (origin && !isTrustedNavigationOrigin(req, origin)) {
    return res.status(403).json({ error: 'Origem não autorizada.', code: 'CSRF_ORIGIN_DENIED' });
  }
  if (!origin && referer && !isTrustedNavigationOrigin(req, referer)) {
    return res.status(403).json({ error: 'Origem não autorizada.', code: 'CSRF_ORIGIN_DENIED' });
  }

  const cookieToken = readCookie(req, CSRF_COOKIE_NAME);
  const headerToken = req.get(CSRF_HEADER_NAME);
  if (!cookieToken || !headerToken) {
    return res.status(403).json({ error: 'Token CSRF ausente.', code: 'CSRF_TOKEN_MISSING' });
  }
  if (!sameToken(cookieToken, headerToken)) {
    return res.status(403).json({ error: 'Token CSRF inválido.', code: 'CSRF_TOKEN_INVALID' });
  }
  next();
}
// Keep the existing API stable while exposing an explicit versioned entry point.
app.use((req, _res, next) => {
  if (req.url === '/api/v1' || req.url.startsWith('/api/v1/')) {
    req.url = `/api${req.url.slice('/api/v1'.length) || '/'}`;
  }
  next();
});
app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-CSRF-Token, X-Request-Id, Idempotency-Key, X-Payment-Signature, X-Webhook-Signature');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  } else if (origin && req.method === 'OPTIONS') {
    return res.status(403).json({ error: 'Origem não autorizada.', code: 'CORS_ORIGIN_DENIED' });
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});
// S4: Origin/Referer do próprio site + token de duplo envio em todos os
// métodos que alteram estado. Aplicado depois do CORS para os preflights
// continuarem a funcionar e antes dos limitadores para não gastar baldes com
// pedidos forjados.
app.use('/api', validateStateChangingRequest);

const requestWindows = new Map<string, { startedAt: number; count: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
// Em produção o limite protege a API. Em desenvolvimento/teste (Playwright com
// 8 workers paralelos a carregar páginas e logins pelo mesmo IP) o limite
// padrão gerava respostas 429 em cascata e pendurava os testes de e2e.
// O limite pode ser elevado por ambiente (RATE_LIMIT_MAX_REQUESTS) para
// corridas de e2e contra um servidor de produção local, sem alterar o valor
// por omissão que protege a API em produção.
const RATE_LIMIT_MAX_REQUESTS = (() => {
  const override = Number(process.env.RATE_LIMIT_MAX_REQUESTS);
  if (Number.isFinite(override) && override > 0) return Math.floor(override);
  return isProduction ? 1000 : 30_000;
})();
// O prefixo /api/app-state/ não é excluído do rate limit: as leituras em
// lote da SPA continuam sujeitas à mesma proteção que as restantes rotas /api.
app.use('/api', async (req, res, next) => {
  const key = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const current = requestWindows.get(key);
  const distributedAllowed = await consumeDistributedRateLimit(`api:${key}`, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS);
  if (distributedAllowed === false) {
    const cookieLanguage = req.headers.cookie?.match(/(?:^|;\s*)guigui_lang=([^;]+)/)?.[1];
    const language = resolveRequestLanguage(cookieLanguage || req.headers['accept-language']);
    return res.status(429).json(localizeApiPayload({ error: 'Demasiados pedidos. Tente novamente dentro de um minuto.', code: 'RATE_LIMITED' }, language));
  }
  if (distributedAllowed === true) return next();
  if (!current || now - current.startedAt >= RATE_LIMIT_WINDOW_MS) {
    requestWindows.set(key, { startedAt: now, count: 1 });
    return next();
  }
  current.count += 1;
  if (current.count > RATE_LIMIT_MAX_REQUESTS) {
    const cookieLanguage = req.headers.cookie?.match(/(?:^|;\s*)guigui_lang=([^;]+)/)?.[1];
    const language = resolveRequestLanguage(cookieLanguage || req.headers['accept-language']);
    return res.status(429).json(localizeApiPayload({ error: 'Demasiados pedidos. Tente novamente dentro de um minuto.', code: 'RATE_LIMITED' }, language));
  }
  next();
});

// Limite dedicado às chamadas de IA: protege a quota do Gemini de abuso por
// parte de contas autenticadas. Usa o armazém distribuído quando existe base de
// dados e recorre a memória como alternativa em desenvolvimento.
const aiRequestWindows = new Map<string, { startedAt: number; count: number }>();
const AI_RATE_LIMIT_WINDOW_MS = 60_000;
const AI_RATE_LIMIT_MAX_REQUESTS = isProduction ? 20 : 300;

async function consumeAiQuota(userId: string): Promise<boolean> {
  const distributed = await consumeDistributedRateLimit(`ai:${userId}`, AI_RATE_LIMIT_WINDOW_MS, AI_RATE_LIMIT_MAX_REQUESTS);
  if (distributed !== null) return distributed;
  const now = Date.now();
  const current = aiRequestWindows.get(userId);
  if (!current || now - current.startedAt >= AI_RATE_LIMIT_WINDOW_MS) {
    aiRequestWindows.set(userId, { startedAt: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= AI_RATE_LIMIT_MAX_REQUESTS;
}

// Clientes/importações em Latin-1: o corpo é convertido para UTF-8 antes do
// parser padrão, para que acentos e cedilha não sejam rejeitados com 415.
app.use(latin1JsonBody);
const jsonBodyParser = express.json({ limit: '10mb' });
app.use((req, res, next) => {
  // Pedidos já convertidos de Latin-1 não passam outra vez pelo parser.
  if ((req as unknown as Record<symbol, boolean>)[BODY_PARSED]) return next();
  jsonBodyParser(req, res, (error?: { type?: string; status?: number }) => {
    if (error?.type === 'charset.unsupported') {
      return res.status(415).json({
        error: 'Codificação de caracteres não suportada. Envie o corpo do pedido em UTF-8.',
        code: 'UNSUPPORTED_CHARSET',
      });
    }
    next(error);
  });
});
app.use('/api', (req, res, next) => {
  const cookieLanguage = req.headers.cookie?.match(/(?:^|;\s*)guigui_lang=([^;]+)/)?.[1];
  const language = resolveRequestLanguage(cookieLanguage || req.headers['accept-language']);
  const originalJson = res.json.bind(res);
  res.json = ((payload: unknown) => originalJson(localizeApiPayload(payload, language))) as typeof res.json;
  next();
});

function matchesScannerDoorCode(value: unknown): boolean {
  if (typeof value !== 'string' || !value || (isProduction && !process.env.SCANNER_DOOR_CODE)) {
    return false;
  }
  const provided = Buffer.from(value.trim());
  const expected = Buffer.from(configuredScannerDoorCode);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

// Initialize Gemini Client Lazily if key exists
let aiClient: GoogleGenAI | null = null;
function getAIClient(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY') {
    try {
      aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch (err) {
      console.warn('Failed to initialize Gemini AI client:', err);
    }
  }
  return aiClient;
}

// In-Memory Database for Tickets and Moderation logs in Dev
const ticketsDb = new Map<string, any>(loadJson<Array<[string, any]>>('tickets.json', []));
const eventSnapshots = new Map<string, any>(loadJson<any[]>('events.json', []).map((event) => [event.id, event]));
const moderationLogs: any[] = loadJson<any[]>('moderation-logs.json', []);
const securityAuditLogs: AuditEntry[] = loadJson<AuditEntry[]>('audit-logs.json', []);
const persistTickets = () => saveJson('tickets.json', Array.from(ticketsDb.entries()));
const persistEventSnapshots = () => saveJson('events.json', Array.from(eventSnapshots.values()));
const persistModerationLogs = () => saveJson('moderation-logs.json', moderationLogs);
const persistAuditLogs = () => saveJson('audit-logs.json', securityAuditLogs);
const purchaseIdempotency = new Map<string, { createdAt: number; response: Record<string, unknown>; status: number; result?: TicketPurchaseResult }>();
const purchaseIdempotencyLocks = new Map<string, Promise<void>>();
const paymentIdempotency = new Map<string, { createdAt: number; response: unknown }>();
const smsResendWindows = new Map<string, { lastSentAt: number; dayKey: string; count: number }>();
const TICKET_LOOKUP_WINDOW_MS = 10 * 60_000;
const SMS_RESEND_COOLDOWN_MS = 60_000;
const SMS_RESEND_DAILY_MAX = 3;
const TICKET_LOOKUP_MAX_ATTEMPTS = 5;
const normalizeLookupPhone = (value: unknown) => String(value || '').replace(/\D/g, '').slice(-9);
const allowTicketLookup = (phone: string) =>
  consumeAccountRateLimit('ticket-lookup', phone, TICKET_LOOKUP_WINDOW_MS, TICKET_LOOKUP_MAX_ATTEMPTS);

const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60_000;
const LOGIN_RATE_LIMIT_MAX_ATTEMPTS = 10;
const PASSWORD_RESET_RATE_LIMIT_WINDOW_MS = 15 * 60_000;
const PASSWORD_RESET_MAX_ATTEMPTS = 5;
const monetizationCatalogStore = loadJson<MonetizationCatalog>('monetization-catalog.json', DEFAULT_MONETIZATION_CATALOG);
void persistPostgresCatalog(monetizationCatalogStore).catch((error: unknown) => {
  console.error('postgres-catalog-bootstrap-failed', error);
});
const monetizationLedger: MonetizationLedgerEntry[] = loadJson<MonetizationLedgerEntry[]>('monetization-ledger.json', []);
const monetizationWallets: Record<string, MonetizationWallet> = loadJson<Record<string, MonetizationWallet>>('monetization-wallets.json', {});
const monetizationRequests: any[] = loadJson<any[]>('monetization-requests.json', []);
const persistMonetizationCatalog = () => saveJson('monetization-catalog.json', monetizationCatalogStore);
const persistMonetizationLedger = () => saveJson('monetization-ledger.json', monetizationLedger);
const persistMonetizationWallets = () => saveJson('monetization-wallets.json', monetizationWallets);
const persistMonetizationRequests = () => saveJson('monetization-requests.json', monetizationRequests);
const IDEMPOTENCY_TTL_MS = 10 * 60_000;

function getCommercialCodeForUseCase(useCase: unknown, productCode?: unknown): string | undefined {
  if (typeof productCode === 'string' && productCode.trim()) return productCode.trim().toUpperCase();
  const map: Record<string, string> = { extra_posts: 'POST_EXTRA', extra_promotions: 'PROMOTION_EXTRA', advertising_purchase: 'HOMEPAGE_BANNER', content_service_request: 'PUSH_CAMPAIGN', extra_credit_purchase: 'POST_EXTRA' };
  return typeof useCase === 'string' ? map[useCase] : undefined;
}

async function resolveCommercialPayment(body: Record<string, unknown>) {
  const useCase = String(body.useCase || '');
  const code = getCommercialCodeForUseCase(useCase, body.productCode);
  const commercialUseCase = ['extra_posts', 'extra_promotions', 'advertising_purchase', 'content_service_request', 'extra_credit_purchase'].includes(useCase);
  if (!commercialUseCase || !code) return { ok: true as const, code: undefined, quantity: 1, price: Number(body.amountXOF || 0) };
  const quantity = Number.isInteger(Number(body.quantity)) ? Math.min(1000, Math.max(1, Number(body.quantity))) : 1;
  try {
    const databaseProduct = await resolveDatabaseCommercialPrice(code, quantity, typeof body.durationDays === 'number' ? body.durationDays : undefined);
    if (databaseProduct) {
      if (Number(body.amountXOF) !== databaseProduct.price) {
        return { ok: false as const, status: 409, error: 'O valor não corresponde ao preço actual do produto.', code: 'PRODUCT_PRICE_MISMATCH', expectedAmountXOF: databaseProduct.price };
      }
      return { ok: true as const, code: databaseProduct.code, quantity, price: databaseProduct.price, productId: databaseProduct.productId };
    }
  } catch (error) {
    if (error instanceof CommercialError && error.code !== 'DATABASE_REQUIRED') {
      return { ok: false as const, status: error.status, error: error.message, code: error.code };
    }
    console.error('[Guigui.com] Falha ao consultar o catálogo comercial na base de dados:', error);
  }
  const catalog = normaliseMonetizationCatalog(monetizationCatalogStore);
  const commercialProduct = getCommercialProduct(catalog, code);
  if (!commercialProduct || !commercialProduct.isActive) return { ok: false as const, status: 409, error: 'O produto comercial não está activo no catálogo.', code: 'PRODUCT_NOT_ACTIVE' };
  if (commercialProduct.requiresQuote) return { ok: false as const, status: 409, error: 'Este produto requer orçamento da Administração.', code: 'PRODUCT_REQUIRES_QUOTE' };
  const price = resolveProductPrice(catalog, code, quantity, typeof body.durationDays === 'number' ? body.durationDays : undefined);
  if (price <= 0 || Number(body.amountXOF) !== price) return { ok: false as const, status: 409, error: 'O valor não corresponde ao preço actual do produto.', code: 'PRODUCT_PRICE_MISMATCH', expectedAmountXOF: price };
  return { ok: true as const, code, quantity, price, productId: commercialProduct.id };
}

function recordMonetizationFulfillment(transaction: any) {
  const isTicketFee = transaction?.useCase === 'event_tickets';
  const supportedUseCase = ['extra_posts', 'extra_promotions', 'advertising_purchase', 'content_service_request', 'extra_credit_purchase'].includes(String(transaction?.useCase));
  const productCode = transaction?.productCode || (isTicketFee ? 'TICKET_FEE' : undefined);
  if (!transaction?.businessId || !productCode || (!supportedUseCase && !isTicketFee)) return;
  if (monetizationLedger.some((entry) => entry.transactionId === transaction.id && entry.status === 'paid')) return;
  const product = getCommercialProduct(normaliseMonetizationCatalog(monetizationCatalogStore), String(productCode));
  const quantity = Math.max(1, Number(transaction.quantity || 1));
  const grossAmount = isTicketFee ? Number(transaction.platformFeeXOF || 0) : Number(transaction.amountXOF || 0);
  if (grossAmount <= 0) return;
  const entry = createLedgerEntry({ transactionId: transaction.id, businessId: transaction.businessId, productId: String(transaction.productId || product?.id || productCode), productCode: String(productCode), description: String(transaction.useCaseLabel || product?.name || productCode), quantity, grossAmount, platformFee: 0, currency: String(product?.currency || 'XOF'), status: 'paid', metadata: { useCase: transaction.useCase, provider: transaction.provider, ...(isTicketFee ? { ticketBaseAmountXOF: transaction.ticketBaseAmountXOF } : {}) } });
  monetizationLedger.unshift(entry);
  const currentWallet = monetizationWallets[transaction.businessId] || { postsExtraPurchased: 0, promotionsExtraPurchased: 0, postsExtraUsed: 0, promotionsExtraUsed: 0, updatedAt: new Date().toISOString() };
  if (transaction.useCase === 'extra_posts' || transaction.useCase === 'extra_credit_purchase') currentWallet.postsExtraPurchased += quantity;
  if (transaction.useCase === 'extra_promotions') currentWallet.promotionsExtraPurchased += quantity;
  currentWallet.updatedAt = new Date().toISOString();
  monetizationWallets[transaction.businessId] = currentWallet;
  persistMonetizationLedger();
  persistMonetizationWallets();
  void persistPostgresMonetization(entry, currentWallet).catch((error: unknown) => {
    console.error('postgres-monetization-persist-failed', error);
  });
}

function markMonetizationRefunded(transactionId: string) {
  let changed = false;
  monetizationLedger.forEach((entry) => { if (entry.transactionId === transactionId && entry.status === 'paid') { entry.status = 'refunded'; changed = true; } });
  if (changed) persistMonetizationLedger();
  void markPostgresMonetizationRefunded(transactionId).catch((error: unknown) => {
    console.error('postgres-monetization-refund-persist-failed', error);
  });
}

function requestIdFrom(req: express.Request): string {
  const value = req.header('x-request-id');
  return value && value.length <= 120 ? value : randomUUID();
}

function sessionTokenFromRequest(req: express.Request): string | undefined {
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]+)`));
  return match?.[1];
}

function setSessionCookie(res: express.Response, token: string) {
  const secure = isProduction ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}${secure}`);
}

function clearSessionCookie(res: express.Response) {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function sameBusinessTeamPermissions(
  permissions: BusinessTeamPermissions | undefined,
  expected: BusinessTeamPermissions,
): boolean {
  return Boolean(
    permissions
    && permissions.profile === expected.profile
    && permissions.content === expected.content
    && permissions.events === expected.events
    && permissions.tickets === expected.tickets
    && permissions.billing === expected.billing,
  );
}

function isBusinessTeamPermissions(value: unknown): value is BusinessTeamPermissions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const permissions = value as Record<string, unknown>;
  const keys = ['profile', 'content', 'events', 'tickets', 'billing'];
  return Object.keys(permissions).length === keys.length
    && keys.every((key) => typeof permissions[key] === 'boolean');
}

let identityAccess!: IdentityAccess;

const { sessionContext, requireSession, requireRole } = createSessionAccessMiddleware({
  resolveContext: (req) =>
    resolveSessionContext(sessionTokenFromRequest(req), identityAccess),
  requestIdFrom: (req) => requestIdFrom(req),
  onAuthorizationDenied: (audit) => {
    recordAudit({
      action: 'authorization_denied',
      success: false,
      resource: audit.resource,
      actorRole: audit.actorRole,
      requestId: audit.requestId,
      metadata: { requiredRoles: audit.requiredRoles },
    });
  },
});

// ---------------------------------------------------------------------------
// Autorização por módulo (RBAC): regras centralizadas para empresas e admin.
// Aplicam-se apenas a contas restringidas; titulares e administradores sem
// restrições definidas mantêm o acesso anterior.
// ---------------------------------------------------------------------------
type RouteRule = { pattern: RegExp; module: string; action?: Partial<Record<string, 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'reject' | 'publish' | 'export' | 'manage'>> };

const BUSINESS_API_RULES: RouteRule[] = [
  { pattern: /^\/api\/marketing\/campaigns(\/|$)/, module: 'marketing', action: { GET: 'view', POST: 'create', PATCH: 'edit', PUT: 'edit', DELETE: 'delete' } },
  { pattern: /^\/api\/marketing\/promotions(\/|$)/, module: 'marketing', action: { GET: 'view', POST: 'create', PATCH: 'edit', DELETE: 'delete' } },
  { pattern: /^\/api\/marketing\/scheduled-items(\/|$)/, module: 'marketing', action: { GET: 'view', POST: 'create', PATCH: 'edit', DELETE: 'delete' } },
  { pattern: /\/publish-now$/, module: 'marketing', action: { POST: 'publish' } },
  { pattern: /\/api\/businesses\/[^/]+\/profile$/, module: 'my_business', action: { GET: 'view', PATCH: 'edit', PUT: 'edit' } },
  { pattern: /^\/api\/businesses\/[^/]+\/post-metrics$/, module: 'marketing', action: { GET: 'view' } },
  { pattern: /^\/api\/tickets\/sold$/, module: 'tickets', action: { GET: 'view' } },
  { pattern: /^\/api\/tickets\/scanner-auth$/, module: 'tickets', action: { POST: 'view' } },
  { pattern: /^\/api\/tickets\/offline-manifest$/, module: 'tickets', action: { POST: 'view' } },
  { pattern: /^\/api\/tickets\/validate/, module: 'tickets', action: { POST: 'approve' } },
  { pattern: /^\/api\/payments\/transactions$/, module: 'billing', action: { GET: 'view' } },
  { pattern: /^\/api\/monetization\/wallet\/[^/]+$/, module: 'billing', action: { GET: 'view' } },
  { pattern: /^\/api\/monetization\/requests$/, module: 'billing', action: { GET: 'view', POST: 'create' } },
  { pattern: /^\/api\/business\/team(\/|$)/, module: 'team', action: { GET: 'view', POST: 'manage', PATCH: 'manage', PUT: 'manage', DELETE: 'manage' } },
  { pattern: /^\/api\/security\/events$/, module: 'security', action: { GET: 'view' } },
  { pattern: /^\/api\/auth\/sessions(\/|$)/, module: 'security', action: { GET: 'view', DELETE: 'manage', POST: 'manage' } },
  { pattern: /^\/api\/exports?(\/|$)/, module: 'export', action: { GET: 'export', POST: 'export' } },
];

const ADMIN_API_RULES: RouteRule[] = [
  { pattern: /^\/api\/admin\/users(\/|$)/, module: 'users', action: { GET: 'view', POST: 'edit', PATCH: 'edit', PUT: 'edit', DELETE: 'delete' } },
  { pattern: /^\/api\/admin\/businesses(\/|$)/, module: 'businesses', action: { GET: 'view', POST: 'approve', PATCH: 'edit', PUT: 'approve', DELETE: 'delete' } },
  { pattern: /^\/api\/admin\/audit-logs$/, module: 'audit_logs', action: { GET: 'view' } },
  { pattern: /^\/api\/admin\/moderation-logs$/, module: 'moderation', action: { GET: 'view' } },
  { pattern: /^\/api\/reviews\/[^/]+\/moderate$/, module: 'moderation', action: { POST: 'approve' } },
  { pattern: /^\/api\/admin\/payments$/, module: 'financials', action: { GET: 'view' } },
  { pattern: /^\/api\/admin\/stats$/, module: 'overview', action: { GET: 'view' } },
  { pattern: /^\/api\/admin\/product-funnel$/, module: 'reports', action: { GET: 'view' } },
  { pattern: /^\/api\/admin\/categories(\/|$)/, module: 'categories', action: { GET: 'view', POST: 'create', PATCH: 'edit', PUT: 'edit', DELETE: 'delete' } },
  { pattern: /^\/api\/admin\/locations(\/|$)/, module: 'categories', action: { GET: 'view', POST: 'create', PATCH: 'edit', PUT: 'edit', DELETE: 'delete' } },
  { pattern: /^\/api\/monetization\/catalog$/, module: 'pricing', action: { GET: 'view', PUT: 'manage' } },
  { pattern: /^\/api\/admin\/team(\/|$)/, module: 'admin_staff', action: { GET: 'view', POST: 'create', PATCH: 'edit', DELETE: 'delete' } },
  // Operações financeiras, comerciais e de comunicação também respeitam os
  // módulos: um colaborador de moderação não pode abrir Financeiro por URL.
  { pattern: /^\/api\/admin\/finance(\/|$)/, module: 'financials', action: { GET: 'view', POST: 'approve', PATCH: 'approve', PUT: 'approve', DELETE: 'reject' } },
  { pattern: /^\/api\/admin\/commercial(\/|$)/, module: 'pricing', action: { GET: 'view', POST: 'manage', PATCH: 'manage', PUT: 'manage', DELETE: 'manage' } },
  { pattern: /^\/api\/admin\/notifications(\/|$)/, module: 'notifications', action: { GET: 'view', POST: 'create', PATCH: 'edit', DELETE: 'delete' } },
  { pattern: /^\/api\/admin\/conversations(\/|$)/, module: 'support', action: { GET: 'view', POST: 'edit', PATCH: 'edit', DELETE: 'delete' } },
  { pattern: /^\/api\/admin\/institutional\/publish$/, module: 'sobre_nos', action: { POST: 'publish' } },
  { pattern: /^\/api\/admin\/institutional\/releases\/[^/]+\/restore$/, module: 'sobre_nos', action: { POST: 'manage' } },
  { pattern: /^\/api\/admin\/institutional(\/|$)/, module: 'sobre_nos', action: { GET: 'view', POST: 'create', PUT: 'edit', DELETE: 'delete' } },
  { pattern: /^\/api\/admin\/quality-audit(\/|$)/, module: 'quality_audit', action: { GET: 'view', POST: 'edit', PUT: 'edit' } },
];

/** Acesso efectivo de um colaborador empresarial; `null` significa acesso total (titular). */
async function effectiveBusinessAccess(userId: string): Promise<{ access: TeamModuleAccess | null; businessId?: string; status?: string }> {
  const stored = await identityAccess.findById(userId);
  if (!stored) return { access: {} };
  const restricted = Boolean(stored.teamRole || stored.teamAccess || stored.teamPermissions);
  if (!restricted) return { access: null, businessId: stored.businessId, status: stored.accessStatus };
  const access = stored.teamAccess
    || accessFromLegacyPermissions(stored.teamPermissions)
    || {};
  return { access, businessId: stored.businessId, status: stored.accessStatus };
}

async function effectiveAdminAccess(userId: string): Promise<TeamModuleAccess | null> {
  const stored = await identityAccess.findById(userId);
  if (!stored) return {};
  return stored.adminAccess ? stored.adminAccess : null;
}

function ruleFor(rules: RouteRule[], method: string, path: string): RouteRule | undefined {
  return rules.find((rule) => rule.pattern.test(path));
}

app.use('/api', async (req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  const path = req.originalUrl.split('?')[0];
  const rules = [...BUSINESS_API_RULES, ...ADMIN_API_RULES];
  const rule = ruleFor(rules, req.method, path);
  if (!rule) return next();
  const context = await sessionContext(req);
  if (!context) return next();

  let allowed = true;
  if (context.role === 'business') {
    const effective = await effectiveBusinessAccess(context.userId);
    if (effective.access) {
      const action = rule.action?.[req.method] || 'view';
      allowed = canPerformAction(effective.access, rule.module, action);
      if (allowed && (effective.status === 'suspended' || effective.status === 'disabled')) allowed = false;
    }
  } else if (context.role === 'admin') {
    const adminAccess = await effectiveAdminAccess(context.userId);
    if (adminAccess) {
      const action = rule.action?.[req.method] || 'view';
      allowed = canPerformAction(adminAccess, rule.module, action);
    }
  }

  if (allowed) return next();
  recordAudit({
    action: 'authorization_denied',
    resource: rule.module,
    resourceId: path,
    actorRole: context.role === 'user' ? 'citizen' : context.role,
    actorId: context.userId,
    success: false,
    requestId: requestIdFrom(req),
    metadata: { requiredModule: rule.module, method: req.method },
  });
  return res.status(403).json({
    error: 'Não tem autorização para acessar este módulo. Contacte o responsável da sua conta.',
    code: 'MODULE_FORBIDDEN',
    module: rule.module,
  });
});

function recordAudit(entry: Omit<AuditEntry, 'id' | 'requestId' | 'createdAt'> & { requestId?: string }): AuditEntry {
  const auditEntry = createAuditEntry(entry);
  securityAuditLogs.unshift(auditEntry);
  if (securityAuditLogs.length > 2_000) securityAuditLogs.length = 2_000;
  persistAuditLogs();
  void persistPostgresAudit(auditEntry).catch((error: unknown) => {
    console.error('postgres-audit-persist-failed', error);
  });
  return auditEntry;
}

function cleanupIdempotency() {
  const cutoff = Date.now() - IDEMPOTENCY_TTL_MS;
  for (const [key, value] of purchaseIdempotency) {
    if (value.createdAt < cutoff) purchaseIdempotency.delete(key);
  }
  for (const [key, value] of paymentIdempotency) {
    if (value.createdAt < cutoff) paymentIdempotency.delete(key);
  }
}

async function findTicketByLookup(value: string): Promise<TicketForValidation | undefined> {
  if (databaseConfigured) return (await findPostgresTicket(value)) || undefined;
  const direct = ticketsDb.get(value) as TicketForValidation | undefined;
  if (direct) return direct;
  for (const ticket of ticketsDb.values() as Iterable<TicketForValidation>) {
    if (ticket.qrToken === value || ticket.pinCode === value || ticket.ticketCode === value) return ticket;
  }
  return undefined;
}

function normalizeScannerLookup(value: string): string {
  const trimmed = value.trim();
  const prefixed = trimmed.match(/^GUI-TICKET:v1:([^:]+):[^:]+$/i);
  return prefixed?.[1] || trimmed;
}

function generateTicketIdentifiers(): { ticketCode: string; qrToken: string; pinCode: string } {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const ticketCode = `GUI-${randomBytes(5).toString('hex').toUpperCase()}`;
    const qrToken = `QR-GUI-${randomBytes(18).toString('base64url')}`;
    const pinCode = String(randomInt(100000, 1000000));
    if (!ticketsDb.has(ticketCode) && !ticketsDb.has(qrToken) && !ticketsDb.has(pinCode)) {
      return { ticketCode, qrToken, pinCode };
    }
  }
  throw new Error('Não foi possível gerar identificadores únicos para o bilhete.');
}

function calculateTicketExpiry(eventDate?: unknown, eventTime?: unknown): string {
  const dateText = typeof eventDate === 'string' ? eventDate.trim() : '';
  const timeText = typeof eventTime === 'string' && /^\d{1,2}:\d{2}$/.test(eventTime.trim()) ? eventTime.trim() : '23:59';
  const eventTimestamp = dateText ? Date.parse(`${dateText}T${timeText}:00`) : NaN;
  if (Number.isFinite(eventTimestamp) && eventTimestamp > Date.now()) {
    return new Date(eventTimestamp + 24 * 60 * 60 * 1000).toISOString();
  }
  // O preview contém eventos históricos; mantém bilhetes de demonstração testáveis por sete dias.
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
}

// Seed an initial demo ticket
ticketsDb.set('QR-GUI-DEMO-001', {
    id: 'TKT-001',
    businessId: 'biz-1',
    ticketCode: 'GUI-9821',
  eventId: 'evt-1',
  eventTitle: 'Festival da Lusofonia Bissau 2026',
  ticketTypeName: 'VIP Entrada Geral',
  priceXOF: 15000,
  buyerName: 'Mamadu Saliu Djaló',
  buyerPhone: '+245 955 12 34 56',
  qrToken: 'QR-GUI-DEMO-001',
  pinCode: '4829',
  status: 'valid',
  purchasedAt: new Date().toISOString(),
  paymentMethod: 'orange_money',
});
const demoTicket = ticketsDb.get('QR-GUI-DEMO-001') as TicketForValidation;
if (ticketSigningSecret) {
  demoTicket.signature = signTicket(demoTicket, ticketSigningSecret);
}

// Backfill the demo event ownership for tickets created before business scoping was added.
for (const ticket of ticketsDb.values() as Iterable<TicketForValidation>) {
  if (!ticket.businessId && ticket.eventId === 'evt-1') {
    ticket.businessId = 'biz-1';
  }
}
persistTickets();

// API Routes
// Saúde pública da plataforma: o marketplace usa `database.configured` para
// escolher entre PostgreSQL e o modo local, e /metrics/system-health dependem
// do mesmo formato. Apenas booleanos de estado são expostos, nunca credenciais.
app.get('/api/health', createHealthHandler({
  databaseConfigured,
  checkDatabaseConnection,
  geminiActive: () => Boolean(getAIClient()),
  logger: console,
  now: () => new Date(),
}));

app.get('/api/marketing/scheduled-items', requireRole('business', 'admin'), async (req, res) => {
    const context = await sessionContext(req);
    if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
    const storedUser = await identityAccess.findById(context.userId) || undefined;
    const sessionBusinessId = storedUser?.businessId;
    let businessId = typeof req.query.businessId === 'string' ? req.query.businessId : undefined;
    if (context.role === 'business') {
      if (!sessionBusinessId) return res.status(403).json({ error: 'Conta empresarial sem empresa associada.', code: 'BUSINESS_ACCOUNT_REQUIRED' });
      if (businessId && businessId !== sessionBusinessId) {
        return res.status(403).json({ error: 'Não possui permissão para consultar esta empresa.', code: 'BUSINESS_SCOPE_REQUIRED' });
      }
      businessId = sessionBusinessId;
    }
    res.json({ timezone: SCHEDULING_TIMEZONE, items: await listScheduledItems(businessId) });
  });

app.post('/api/marketing/campaigns', requireRole('business'), async (req, res) => {
  const context = await sessionContext(req);
  const campaign = req.body || {};
  // Posse antes da validação: campanha de outra empresa = 403, não 400.
  const storedUser = context ? await identityAccess.findById(context.userId) || undefined : undefined;
  const campaignScope = resolveBusinessScope(context?.role, storedUser?.businessId, typeof campaign.businessId === 'string' ? campaign.businessId : undefined);
  if (campaignScope.allowed === false) {
    return res.status(403).json({ error: 'A campanha não pertence à empresa autenticada.' });
  }
  if (!context || !campaign.id || !campaign.businessId || !campaign.name) {
    return res.status(400).json({ error: 'id, businessId e name são obrigatórios.' });
  }
  const scheduledTimestamp = campaign.status === 'scheduled' && campaign.startsAt
    ? Date.parse(String(campaign.startsAt))
    : undefined;
  const endsTimestamp = campaign.endsAt ? Date.parse(String(campaign.endsAt)) : undefined;
  if (campaign.status === 'scheduled' && (!scheduledTimestamp || scheduledTimestamp <= Date.now())) {
    return res.status(400).json({ error: 'A data de início da campanha deve ser futura.' });
  }
  if (endsTimestamp !== undefined && (!Number.isFinite(endsTimestamp) || (scheduledTimestamp !== undefined && endsTimestamp <= scheduledTimestamp))) {
    return res.status(400).json({ error: 'A data de fim deve ser posterior à data de início.' });
  }
  if (databasePool) {
    await databasePool.query(`
      INSERT INTO marketing_campaigns (id, business_id, payload, created_at, updated_at)
      VALUES ($1, $2, $3::jsonb, $4, $5)
      ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload, updated_at=EXCLUDED.updated_at
    `, [String(campaign.id), String(campaign.businessId), JSON.stringify(campaign), campaign.createdAt || new Date().toISOString(), campaign.updatedAt || new Date().toISOString()]);
  }
  if (scheduledTimestamp !== undefined) {
    await createScheduledItem({
      businessId: String(campaign.businessId),
      ownerUserId: context.userId,
      itemType: 'campaign',
      itemId: String(campaign.id),
      label: String(campaign.name),
      scheduledAt: new Date(scheduledTimestamp).toISOString(),
      endsAt: endsTimestamp !== undefined ? new Date(endsTimestamp).toISOString() : undefined,
      moderationStatus: 'approved',
      paymentStatus: 'not_required',
    });

  }
  res.status(201).json({ campaign, persisted: Boolean(databasePool) });
});

app.post('/api/marketing/promotions', requireRole('business'), async (req, res) => {
  const context = await sessionContext(req);
  const promotion = req.body || {};
  // Posse antes da validação: promoção de outra empresa = 403, não 400.
  const storedUser = context ? await identityAccess.findById(context.userId) || undefined : undefined;
  const promotionScope = resolveBusinessScope(context?.role, storedUser?.businessId, typeof promotion.businessId === 'string' ? promotion.businessId : undefined);
  if (promotionScope.allowed === false) {
    return res.status(403).json({ error: 'A promoção não pertence à empresa autenticada.' });
  }
  if (!context || !promotion.id || !promotion.businessId || !promotion.title) {
    return res.status(400).json({ error: 'id, businessId e title são obrigatórios.' });
  }
  const startsTimestamp = promotion.status === 'scheduled' && promotion.startsAt ? Date.parse(String(promotion.startsAt)) : undefined;
  const endsTimestamp = promotion.validUntil ? Date.parse(String(promotion.validUntil)) : undefined;
  if (startsTimestamp !== undefined && (!Number.isFinite(startsTimestamp) || startsTimestamp <= Date.now())) {
    return res.status(400).json({ error: 'A data de início da promoção deve ser futura.' });
  }
  if (endsTimestamp !== undefined && (!Number.isFinite(endsTimestamp) || (startsTimestamp !== undefined && endsTimestamp <= startsTimestamp))) {
    return res.status(400).json({ error: 'A data de fim deve ser posterior à data de início.' });
  }
  if (databasePool) {
    await databasePool.query(`
      INSERT INTO marketing_promotions (id, business_id, payload, created_at, updated_at)
      VALUES ($1, $2, $3::jsonb, $4, $5)
      ON CONFLICT (id) DO UPDATE SET payload=EXCLUDED.payload, updated_at=EXCLUDED.updated_at
    `, [String(promotion.id), String(promotion.businessId), JSON.stringify(promotion), promotion.createdAt || new Date().toISOString(), promotion.updatedAt || new Date().toISOString()]);
  }
  if (startsTimestamp !== undefined) {
    await createScheduledItem({
      businessId: String(promotion.businessId),
      ownerUserId: context.userId,
      itemType: 'promotion',
      itemId: String(promotion.id),
      label: String(promotion.title),
      scheduledAt: new Date(startsTimestamp).toISOString(),
      endsAt: endsTimestamp !== undefined ? new Date(endsTimestamp).toISOString() : undefined,
      moderationStatus: 'approved',
      paymentStatus: 'not_required',
    });
  }
  res.status(201).json({ promotion, persisted: Boolean(databasePool) });
});

  app.patch('/api/marketing/campaigns/:id', requireRole('business'), async (req, res) => {
    const context = await sessionContext(req);
    const status = req.body?.status;
    const allowedStatuses = new Set(['draft', 'scheduled', 'active', 'paused', 'ended', 'archived']);
    if (!context || !allowedStatuses.has(String(status))) {
      return res.status(400).json({ error: 'Estado de campanha inválido.' });
    }

    if (!databasePool) {
      return res.json({ campaign: { id: req.params.id, status, updatedAt: req.body?.updatedAt || new Date().toISOString() }, persisted: false });
    }

    const result = await databasePool.query('SELECT business_id, payload FROM marketing_campaigns WHERE id = $1', [req.params.id]);
    const row = result.rows[0] as { business_id: string; payload: Record<string, unknown> } | undefined;
    if (!row) return res.status(404).json({ error: 'Campanha não encontrada.' });

    const storedUser = await identityAccess.findById(context.userId) || undefined;
    if (!storedUser?.businessId || storedUser.businessId !== String(row.business_id)) {
      return res.status(403).json({ error: 'A campanha não pertence à empresa autenticada.' });
    }

    const updatedAt = req.body?.updatedAt || new Date().toISOString();
    const campaign = { ...row.payload, status, updatedAt };
    await databasePool.query(
      'UPDATE marketing_campaigns SET payload = $1::jsonb, updated_at = $2 WHERE id = $3',
      [JSON.stringify(campaign), updatedAt, req.params.id],
    );
    res.json({ campaign, persisted: true });
  });

  app.get('/api/marketing/scheduled-items/public', async (_req, res) => {
    res.json({
      items: (await listScheduledItems()).filter((item) => item.status === 'published' || item.status === 'expired'),
    });
  });

app.post('/api/marketing/scheduled-items', requireRole('business'), async (req, res) => {
    const context = await sessionContext(req);
    const body = req.body as Partial<ScheduledItem>;
    // A autorização de âmbito precede a validação do corpo: um pedido para
    // outra empresa falha com 403 mesmo que os restantes campos sejam inválidos.
    const requestedBusinessId = typeof body.businessId === 'string' ? body.businessId : undefined;
    const storedBusinessUser = context ? await identityAccess.findById(context.userId) || undefined : undefined;
    const scope = resolveBusinessScope(context?.role, storedBusinessUser?.businessId, requestedBusinessId);
    if (scope.allowed === false) {
      return res.status(scope.status).json({ error: 'O agendamento não pertence à empresa autenticada.', code: scope.code });
    }
    if (!context || !body.businessId || !body.itemId || !body.itemType || !body.scheduledAt) {
      return res.status(400).json({ error: 'businessId, itemType, itemId e scheduledAt são obrigatórios.' });
    }
    const timestamp = Date.parse(body.scheduledAt);
    if (!Number.isFinite(timestamp) || timestamp <= Date.now()) return res.status(400).json({ error: 'A data de agendamento deve ser futura.' });
    if (body.moderationStatus && body.moderationStatus !== 'approved') return res.status(422).json({ error: 'Conteúdo sem aprovação não pode ser agendado para publicação automática.', code: 'MODERATION_REQUIRED' });
    const item = await createScheduledItem({
      businessId: body.businessId,
      ownerUserId: context.userId,
      itemType: body.itemType,
      itemId: body.itemId,
      scheduledAt: new Date(timestamp).toISOString(),
      moderationStatus: body.moderationStatus || 'approved',
      paymentStatus: body.paymentStatus || 'not_required',
      campaignId: body.campaignId,
      endsAt: body.endsAt,
    });
    res.status(201).json({ timezone: SCHEDULING_TIMEZONE, item });
  });

app.patch('/api/marketing/scheduled-items/:id', requireRole('business'), async (req, res) => {
    try {
      const context = await sessionContext(req);
      const existing = (await listScheduledItems()).find((item) => item.id === req.params.id);
      if (!existing || existing.ownerUserId !== context?.userId) return res.status(404).json({ error: 'Agendamento não encontrado.' });
      const body = req.body as Partial<ScheduledItem>;
      if (body.scheduledAt && (!Number.isFinite(Date.parse(body.scheduledAt)) || Date.parse(body.scheduledAt) <= Date.now())) {
        return res.status(400).json({ error: 'A nova data de agendamento deve ser futura.' });
      }
      const item = await updateScheduledItem(req.params.id, {
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt).toISOString() : undefined,
        status: body.status === 'cancelled' ? 'cancelled' : undefined,
        endsAt: body.endsAt,
      });
      res.json({ item });
    } catch (error) {
      res.status(404).json({ error: error instanceof Error ? error.message : 'Agendamento não encontrado.' });
    }
  });

app.post('/api/marketing/scheduled-items/:id/publish-now', requireRole('business'), async (req, res) => {
    try {
      const context = await sessionContext(req);
      const existing = (await listScheduledItems()).find((item) => item.id === req.params.id);
      if (!existing || existing.ownerUserId !== context?.userId) return res.status(404).json({ error: 'Agendamento não encontrado.' });
      const item = await updateScheduledItem(req.params.id, { scheduledAt: new Date().toISOString() });
      await processDueScheduledItems();
      res.json({ item: (await listScheduledItems()).find((candidate) => candidate.id === item.id) });
    } catch (error) {
      res.status(409).json({ error: error instanceof Error ? error.message : 'Não foi possível publicar.' });
    }
});

app.get('/api/features', (_req, res) => {
    res.json({
      productAnalytics: process.env.FEATURE_PRODUCT_ANALYTICS !== 'false',
      publicSeo: process.env.FEATURE_PUBLIC_SEO !== 'false',
      recommendations: process.env.FEATURE_RECOMMENDATIONS === 'true',
    });
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toPublicBusinessDto(business: Record<string, unknown>): Record<string, unknown> {
  const dto = { ...business };
  for (const field of ['email', 'ownerEmail', 'owner_email', 'accountEmail', 'account_email', 'ownerUserId', 'data']) {
    delete dto[field];
  }
  if (typeof dto.publicEmail !== 'string' || !dto.publicEmail.trim()) {
    delete dto.publicEmail;
  } else {
    dto.publicEmail = dto.publicEmail.trim();
  }
  return dto;
}

// Campos pesados que o directório não usa (posts, galeria, promoções, avaliações,
// métricas e estado interno da subscrição). Ficam de fora do DTO resumido.
const BUSINESS_SUMMARY_OMITTED_FIELDS = [
  'posts', 'gallery', 'promotions', 'reviews', 'metrics', 'features', 'socialLinks',
  'notApplicableFields', 'subscriptionAlertKeys', 'subscriptionPaymentId',
  'subscriptionRenewDate', 'subscriptionStartedAt', 'subscriptionSuspendedAt',
  'subscriptionAutoSuspended', 'subscriptionSuspensionReason', 'postsQuotaRemaining',
];

function toBusinessSummaryDto(business: Record<string, unknown>): Record<string, unknown> {
  const dto = toPublicBusinessDto(business);
  for (const field of BUSINESS_SUMMARY_OMITTED_FIELDS) delete dto[field];
  return dto;
}

type CollectionPaging = { paginated: boolean; limit: number; offset: number };
const MAX_COLLECTION_LIMIT = 200;

/** `?limit=&offset=` opcional. Sem `limit` a resposta mantém-se completa (compatível). */
function parseCollectionPaging(query: Record<string, unknown>): { paging: CollectionPaging } | { error: string } {
  const rawLimit = query.limit;
  const rawOffset = query.offset;
  if (rawLimit === undefined && rawOffset === undefined) {
    return { paging: { paginated: false, limit: 0, offset: 0 } };
  }
  const limit = Number(rawLimit ?? MAX_COLLECTION_LIMIT);
  const offset = rawOffset === undefined ? 0 : Number(rawOffset);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_COLLECTION_LIMIT) {
    return { error: `limit deve ser um inteiro entre 1 e ${MAX_COLLECTION_LIMIT}.` };
  }
  if (!Number.isInteger(offset) || offset < 0) {
    return { error: 'offset deve ser um inteiro não negativo.' };
  }
  return { paging: { paginated: true, limit, offset } };
}

function paginateCollection<T>(items: T[], paging: CollectionPaging) {
  if (!paging.paginated) return { items, pagination: null };
  const page = items.slice(paging.offset, paging.offset + paging.limit);
  return {
    items: page,
    pagination: {
      total: items.length,
      limit: paging.limit,
      offset: paging.offset,
      hasMore: paging.offset + page.length < items.length,
      nextOffset: paging.offset + page.length < items.length ? paging.offset + page.length : null,
    },
  };
}

const BOOTSTRAP_SECTIONS = ['businesses', 'events', 'posts', 'promotions', 'stories'] as const;
type BootstrapSection = typeof BOOTSTRAP_SECTIONS[number];

/** `?sections=businesses,events` opcional; sem parâmetro devolve todas. */
function parseBootstrapSections(value: unknown): { sections: Set<BootstrapSection> } | { error: string } {
  if (typeof value !== 'string' || !value.trim()) return { sections: new Set(BOOTSTRAP_SECTIONS) };
  const requested = value.split(',').map((part) => part.trim().toLowerCase()).filter(Boolean);
  const unknown = requested.filter((part) => !BOOTSTRAP_SECTIONS.includes(part as BootstrapSection));
  if (!requested.length || unknown.length) {
    return { error: `sections inválido. Use: ${BOOTSTRAP_SECTIONS.join(', ')}.` };
  }
  return { sections: new Set(requested as BootstrapSection[]) };
}

function toPublicBusinessCollection(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((business) => {
    return isRecord(business) ? toPublicBusinessDto(business) : business;
  });
}

app.get('/api/app-state/:key', async (req, res) => {
  try {
    const key = req.params.key;
    const value = await getAppState(key);

    // Politica deny-by-default: chaves publicas podem ser lidas anonimamente;
    // todas as restantes exigem sessao valida e sao filtradas por dono.
    if (isPublicAppStateKey(key)) {
      return res.json({
        key,
        value: key === 'guigui_businesses' ? toPublicBusinessCollection(value) : value,
      });
    }

    const context = await sessionContext(req);
    if (!context) {
      return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
    }
    const storedUser = await identityAccess.findById(context.userId) || undefined;
    const identity = {
      userId: context.userId,
      businessId: storedUser?.businessId,
      phone: storedUser?.phone,
    };
    const conversationState = key === 'guigui_conversation_messages'
      ? await getAppState('guigui_conversations')
      : undefined;
    const conversationIds = conversationState
      ? visibleConversationIds(conversationState, context.role, identity)
      : undefined;
    const decision = readAppStateForSession(key, context.role, identity, value, conversationIds);
    if (decision.allowed === false) {
      return res.status(decision.status).json({ error: 'Acesso negado.', code: decision.code });
    }
    return res.json({
      key,
      value: key === 'guigui_businesses' ? toPublicBusinessCollection(decision.value) : decision.value,
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao obter estado do banco de dados.' });
  }
});

app.post('/api/app-state/:key', requireSession, async (req, res) => {
  const requestId = requestIdFrom(req);
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });

  const key = req.params.key;
  const decision = resolveAppStateWrite(context.role, key, context.userId);
  if (decision.allowed === false) {
    recordAudit({
      action: 'app_state_write_denied',
      resource: 'app_state',
      resourceId: key,
      actorRole: context.role === 'user' ? 'citizen' : context.role,
      requestId,
      success: false,
      metadata: { code: decision.code },
    });
    return res.status(decision.status).json({
      error: 'Não possui permissão para gravar este estado da plataforma.',
      code: decision.code,
    });
  }

  try {
    // Texto guardado em app_state (publicações, eventos, comentários, mensagens)
    // fica em NFC e sem caracteres de controlo antes de ser persistido.
    const { value: incoming } = normalizeDeep(req.body || {});

    // Uma empresa envia a colecção inteira: o servidor repõe os registos que
    // não lhe pertencem, para que não possa apagar concorrentes nem reescrever
    // o catálogo de preços da plataforma.
    if (context.role === 'business') {
      const storedBusinessUser = await identityAccess.findById(context.userId) || undefined;
      const stored = await getAppState(key);
      const valueDecision = resolveAppStateValue(context.role, key, storedBusinessUser?.businessId, incoming, stored);
      if (valueDecision.allowed === false) {
        recordAudit({
          action: 'app_state_write_denied',
          resource: 'app_state',
          resourceId: key,
          actorRole: 'business',
          requestId,
          success: false,
          metadata: { code: valueDecision.code },
        });
        return res.status(403).json({ error: 'Não possui permissão para gravar este estado da plataforma.', code: valueDecision.code });
      }
      await setAppState(key, valueDecision.value);
      res.json({ success: true, key, value: valueDecision.value });
      return;
    }

    await setAppState(key, incoming);
    res.json({ success: true, key, value: incoming });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao gravar estado no banco de dados.' });
  }
});

type PublicViewer = { role: 'user' | 'business' | 'admin'; userId: string; businessId?: string } | null;

/** Sessão opcional das rotas públicas: identifica o dono sem exigir login. */
async function resolvePublicViewer(req: express.Request): Promise<PublicViewer> {
  const context = await sessionContext(req);
  if (!context) return null;
  let businessId: string | undefined;
  if (context.role === 'business') {
    const account = await identityAccess.findById(context.userId);
    businessId = account?.businessId;
  }
  return { role: context.role, userId: context.userId, businessId };
}

function isPublishedEvent(event: Record<string, any>): boolean {
  return event.status === 'published' || event.status === 'active';
}

function filterEventsForViewer(events: any[], viewer: PublicViewer): any[] {
  if (viewer?.role === 'admin') return events;
  if (viewer?.role === 'business' && viewer.businessId) {
    return events.filter((event) => isPublishedEvent(event) || event.businessId === viewer.businessId);
  }
  return events.filter(isPublishedEvent);
}

function filterBusinessesForViewer(businesses: any[], viewer: PublicViewer): any[] {
  if (viewer?.role === 'admin') return businesses;
  if (viewer?.role === 'business' && viewer.businessId) {
    return businesses.filter((business) => business.status === 'active' || business.id === viewer.businessId);
  }
  return businesses.filter((business) => business.status === 'active');
}

function isPublishedStory(story: Record<string, any>, now = Date.now()): boolean {
  // Stories antigas não têm estado: continuam públicas enquanto não houver um
  // estado explícito que as retire. Qualquer draft/removida/suspensa fica fora.
  if (story.status !== undefined && story.status !== null && story.status !== 'active') return false;
  if (story.moderationStatus !== undefined && story.moderationStatus !== null && story.moderationStatus !== 'approved') return false;
  if (story.visibility !== undefined && story.visibility !== null && story.visibility !== 'public') return false;
  if (story.expiresAt) {
    const expiresAt = Date.parse(String(story.expiresAt));
    if (Number.isFinite(expiresAt) && expiresAt <= now) return false;
  }
  return true;
}

function filterStoriesForViewer(stories: any, viewer: PublicViewer): any {
  if (!Array.isArray(stories)) return stories;
  if (viewer?.role === 'admin') return stories;
  return stories.filter((story) => {
    if (!story || typeof story !== 'object') return false;
    const owned = (viewer?.role === 'business' && viewer.businessId && story.businessId === viewer.businessId)
      || (viewer && story.ownerUserId === viewer.userId);
    return owned || isPublishedStory(story);
  });
}

app.get('/api/sync/bootstrap', async (req, res) => {
  const pagingResult = parseCollectionPaging(req.query as Record<string, unknown>);
  if ('error' in pagingResult) {
    return res.status(400).json({ error: pagingResult.error, code: 'INVALID_PAGINATION' });
  }
  const sectionsResult = parseBootstrapSections(req.query.sections);
  if ('error' in sectionsResult) {
    return res.status(400).json({ error: sectionsResult.error, code: 'INVALID_BOOTSTRAP_SECTIONS' });
  }
  const { paging } = pagingResult;
  const sections = sectionsResult.sections;
  const summary = req.query.view === 'summary';
  try {
    const viewer = await resolvePublicViewer(req);
    // Só toca nas fontes das secções pedidas: `?sections=stories` evita ler
    // empresas, eventos e publicações por completo.
    const businessSource = sections.has('businesses') ? await listPostgresBusinesses() : [];
    const eventSource = sections.has('events') ? await listPostgresEvents() : [];
    const userPosts = sections.has('posts') ? await getAppState('guigui_user_posts') : null;
    const promotions = sections.has('promotions') ? await getAppState('guigui_promotions') : null;
    const storySource = sections.has('stories') ? await getAppState('guigui_stories') : null;
    const businesses = filterBusinessesForViewer(businessSource, viewer);
    const events = filterEventsForViewer(eventSource, viewer);
    const stories = filterStoriesForViewer(storySource, viewer);

    const businessDtos = businesses.map(summary ? toBusinessSummaryDto : toPublicBusinessDto);
    const businessesPage = paginateCollection(businessDtos, paging);
    const eventsPage = paginateCollection(events, paging);
    const storiesPage = Array.isArray(stories)
      ? paginateCollection(stories, paging)
      : { items: stories, pagination: null };

    res.json({
      success: true,
      database: { connected: Boolean(databasePool) },
      data: {
        // Se a fonte tinha registos mas todos eram privados, devolve uma lista
        // vazia (não null) para o cliente não reutilizar dados locais.
        businesses: businessSource.length > 0 ? businessesPage.items : null,
        events: eventSource.length > 0 ? eventsPage.items : null,
        userPosts,
        promotions,
        stories: storiesPage.items,
      },
      meta: {
        sections: [...sections],
        view: summary ? 'summary' : 'full',
        pagination: {
          businesses: businessesPage.pagination,
          events: eventsPage.pagination,
          stories: storiesPage.pagination,
        },
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao sincronizar dados iniciais do banco.' });
  }
});

app.use('/api/categories', createCategoryRouter());
app.use('/api', createStoryRouter({ sessionContext, requireSession, requireRole, logger: console }));
// Auditoria de qualidade: o painel admin consome estes endpoints e antes não
// tinha router montado, pelo que caía no fallback do SPA (HTML com 200).
app.use('/api/admin/quality-audit', createQualityAuditRouter(requireRole('admin')));

app.get('/api/businesses', async (req, res) => {
  const pagingResult = parseCollectionPaging(req.query as Record<string, unknown>);
  if ('error' in pagingResult) {
    return res.status(400).json({ error: pagingResult.error, code: 'INVALID_PAGINATION' });
  }
  const summary = req.query.view === 'summary';
  try {
    const viewer = await resolvePublicViewer(req);
    const businesses = filterBusinessesForViewer(await listPostgresBusinesses(), viewer);
    const dtos = businesses.map(summary ? toBusinessSummaryDto : toPublicBusinessDto);
    const { items, pagination } = paginateCollection(dtos, pagingResult.paging);
    res.json({
      businesses: items,
      ...(pagination ? { pagination } : {}),
      ...(summary ? { view: 'summary' } : {}),
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar empresas.' });
  }
});

app.get('/api/businesses/featured', async (_req, res) => {
  try {
    const businesses = await listPostgresBusinesses();
    const featured = businesses
      .filter((business) => business.status === 'active'
        && typeof business.homepageFeaturedOrder === 'number'
        && Number.isInteger(business.homepageFeaturedOrder)
        && business.homepageFeaturedOrder >= 0)
      .sort((left, right) => left.homepageFeaturedOrder - right.homepageFeaturedOrder);
    return res.json({ businesses: featured.map(toPublicBusinessDto) });
  } catch (error) {
    console.error('[Guigui.com] featured business list failed:', error);
    return res.status(500).json({ error: 'Não foi possível carregar as empresas em destaque.', code: 'FEATURED_BUSINESSES_LOAD_FAILED' });
  }
});

app.put('/api/admin/businesses/featured', requireRole('admin'), async (req, res) => {
  const businessIds: unknown = req.body?.businessIds;
  if (!Array.isArray(businessIds) || businessIds.some((id) => typeof id !== 'string' || !id.trim())) {
    return res.status(400).json({ error: 'A lista de empresas em destaque não é válida.', code: 'INVALID_FEATURED_BUSINESS_ORDER' });
  }

  try {
    const businesses = await setPostgresBusinessFeaturedOrder(businessIds);
    return res.json({ success: true, businesses: businesses.map(toPublicBusinessDto) });
  } catch (error) {
    if (error instanceof InvalidFeaturedBusinessOrderError) {
      return res.status(400).json({ error: error.message, code: error.code });
    }
    console.error('[Guigui.com] featured business order save failed:', error);
    return res.status(500).json({ error: 'Não foi possível guardar a ordem das empresas em destaque.', code: 'FEATURED_BUSINESS_ORDER_SAVE_FAILED' });
  }
});

// Módulo institucional (Sobre Nós) — conteúdo normalizado, rascunho de trabalho
// e publicações imutáveis. O cliente público lê apenas a última release.
// ---------------------------------------------------------------------------
registerInstitutionalRoutes(app, {
  getPool: () => databasePool,
  requireAdmin: requireRole('admin'),
  userIdFrom: async (req) => (await sessionContext(req))?.userId ?? null,
});

// A página pública tem endereço próprio: a SPA é servida aqui com os metadados
// da última publicação injetados no HTML (motores de busca e partilha leem-nos
// sem executar JavaScript). Sem publicação, mantém-se o shell por omissão.
async function readInstitutionalShell(): Promise<string> {
  const candidates = runtimeConfig.isProduction && !runtimeConfig.isVercel
    ? [path.join(process.cwd(), 'dist', 'index.html'), path.join(process.cwd(), 'index.html')]
    : [path.join(process.cwd(), 'index.html'), path.join(process.cwd(), 'dist', 'index.html')];
  for (const candidate of candidates) {
    try {
      return await readFile(candidate, 'utf8');
    } catch {
      // tenta a localização seguinte
    }
  }
  throw new Error('index.html não encontrado');
}

app.get('/sobre-nos', async (req, res) => {
  try {
    const html = await readInstitutionalShell();
    const release = databasePool
      ? await createInstitutionalRepository(databasePool).latestRelease()
      : null;
    const origin = (process.env.APP_URL?.trim() || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
    res
      .type('html')
      .setHeader('Cache-Control', 'no-cache')
      .send(injectInstitutionalMeta(html, release?.snapshot ?? null, origin));
  } catch (error) {
    console.error('[Guigui.com] institutional shell failed:', error);
    res.status(500).type('text').send('Página institucional indisponível.');
  }
});

// As páginas de políticas têm endereço próprio e recebem no HTML inicial o
// título, a descrição e a canónica do documento publicado. Como em /sobre-nos,
// a SPA continua a carregar, mas motores de busca e pré-visualizações de
// partilha lêem os metadados sem executar JavaScript. A fonte é sempre a
// publicação activa: rascunhos e documentos apagados não geram metadados.
async function renderPolicyShell(req: express.Request, res: express.Response, slug?: string): Promise<void> {
  try {
    const html = await readInstitutionalShell();
    const release = databasePool
      ? await createInstitutionalRepository(databasePool).latestRelease()
      : null;
    const origin = (process.env.APP_URL?.trim() || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
    res
      .type('html')
      .setHeader('Cache-Control', 'no-cache')
      .send(injectPolicyMeta(html, release?.snapshot ?? null, slug, origin));
  } catch (error) {
    console.error('[Guigui.com] policy shell failed:', error);
    res.status(500).type('text').send('Página de políticas indisponível.');
  }
}

app.get('/politicas', (req, res) => {
  void renderPolicyShell(req, res);
});

app.get('/politicas/:slug', (req, res) => {
  const slug = typeof req.params.slug === 'string' ? req.params.slug.trim() : '';
  void renderPolicyShell(req, res, slug || undefined);
});

app.get('/sitemap.xml', async (req, res) => {
  const origin = (process.env.APP_URL?.trim() || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
  const entries: string[] = ['/', '/sobre-nos'];
  try {
    if (databasePool) {
      const release = await createInstitutionalRepository(databasePool).latestRelease();
      if (release?.snapshot?.seo?.no_index === true) entries.splice(entries.indexOf('/sobre-nos'), 1);
    }
    const urls = entries
      .map((entry) => `  <url><loc>${origin}${entry}</loc></url>`)
      .join('\n');
    res
      .type('application/xml')
      .setHeader('Cache-Control', 'public, max-age=3600')
      .send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
  } catch (error) {
    console.error('[Guigui.com] sitemap failed:', error);
    res.status(500).type('text').send('Sitemap indisponível.');
  }
});

app.get('/api/admin/businesses/pending', requireRole('admin'), async (_req, res) => {
  if (!databaseConfigured) return res.status(503).json({ error: 'A base de dados PostgreSQL é necessária para consultar empresas pendentes.', code: 'DATABASE_REQUIRED' });
  try {
    res.json({ businesses: await listPendingPostgresBusinesses() });
  } catch {
    res.status(500).json({ error: 'Não foi possível carregar a fila de empresas pendentes.', code: 'PENDING_BUSINESSES_LOAD_FAILED' });
  }
});

// CATEGORIES ENDPOINT
// Returns categories from PostgreSQL (categories table: 5 groups + 13 primary categories)
interface AdminCategoryRow {
  id: string;
  name: string;
  parent_id: string | null;
  is_active: boolean;
}

type AdminCategory = {
  id: string;
  name: string;
  groupId: string;
  isActive: boolean;
  subcategories: string[];
};

const CATEGORY_GROUPS = [
  'restauracao',
  'hotelaria_saude_educacao',
  'corporativo_financeiro',
  'ongs_artesãos',
  'servicos_profissionais',
];

const CATEGORY_ORDER_SQL = `
  ORDER BY
    CASE
      WHEN id IN ('cat-1','cat-2','cat-3','cat-4','cat-5') THEN 1
      WHEN id IN ('cat-6','cat-7','cat-8') THEN 2
      WHEN id IN ('cat-9','cat-10','cat-11','cat-12','cat-13') THEN 3
      ELSE 4
    END, name`;

/** Categorias principais (filhas de um grupo, não de outra categoria) + subcategorias. */
async function loadAdminCategories(): Promise<AdminCategory[]> {
  const pool = databasePool;
  if (!pool) throw new Error('DATABASE_REQUIRED');
  // Hierarquia real: grupos (parent_id IS NULL) → categorias principais → subcategorias.
  const primaries = await pool.query<AdminCategoryRow>(
    `SELECT id, name, parent_id, is_active FROM categories
      WHERE is_active = TRUE
        AND parent_id IN (SELECT id FROM categories WHERE parent_id IS NULL)
      ${CATEGORY_ORDER_SQL}`,
  );
  const ids = primaries.rows.map((row) => row.id);
  const children = ids.length === 0
    ? { rows: [] as AdminCategoryRow[] }
    : await pool.query<AdminCategoryRow>(
      `SELECT id, name, parent_id, is_active FROM categories
        WHERE parent_id = ANY($1::text[]) AND is_active = TRUE
        ORDER BY name`,
      [ids],
    );
  return primaries.rows.map((row) => ({
    id: row.id,
    name: row.name,
    groupId: row.parent_id || '',
    isActive: Boolean(row.is_active),
    subcategories: children.rows.filter((child) => child.parent_id === row.id).map((child) => child.name),
  }));
}

function categorySlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || randomUUID().slice(0, 8);
}

function categoryNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.trim())
    .filter(Boolean)))
    .slice(0, 40);
}

function categoryInputError(status: number, message: string, code: string) {
  return Object.assign(new Error(message), { status, code });
}

function sendCategoryError(res: express.Response, error: unknown, fallback: string) {
  const known = error as { status?: number; code?: string; message?: string };
  if (known?.status === 400 || known?.status === 404 || known?.status === 409) {
    return res.status(known.status).json({ error: known.message || fallback, code: known.code });
  }
  console.error('[Guigui.com] categorias:', error);
  return res.status(500).json({ error: fallback });
}

app.get('/api/admin/categories', requireRole('admin'), async (_req, res) => {
  try {
    res.json({ categories: await loadAdminCategories() });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'DATABASE_REQUIRED') {
      return res.status(503).json({ error: 'A base de dados PostgreSQL é necessária para listar as categorias.', code: 'DATABASE_REQUIRED' });
    }
    console.error('[Guigui.com] /api/admin/categories error:', error);
    res.status(500).json({ error: 'Não foi possível carregar as categorias.' });
  }
});

app.post('/api/admin/categories', requireRole('admin'), async (req, res) => {
  const pool = databasePool;
  if (!pool) {
    return res.status(503).json({ error: 'A base de dados PostgreSQL é necessária para criar categorias.', code: 'DATABASE_REQUIRED' });
  }
  try {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const groupId = typeof req.body?.groupId === 'string' ? req.body.groupId.trim() : '';
    if (name.length < 2 || name.length > 80) {
      return sendCategoryError(res, categoryInputError(400, 'O nome da categoria deve ter entre 2 e 80 caracteres.', 'CATEGORY_NAME_INVALID'), 'Nome inválido.');
    }
    if (!CATEGORY_GROUPS.includes(groupId)) {
      return sendCategoryError(res, categoryInputError(400, 'Selecione um grupo de actividade válido.', 'CATEGORY_GROUP_INVALID'), 'Grupo inválido.');
    }
    const subcategories = categoryNames(req.body?.subcategories).filter((entry) => entry.length <= 80);
    // Toda a categoria do catálogo público precisa de metadata.iconName; sem ele
    // o leitor rejeita a árvore inteira. O painel não envia ícone, por isso
    // gravamos um ícone neutro por omissão.
    const iconName = typeof req.body?.iconName === 'string' && req.body.iconName.trim()
      ? req.body.iconName.trim().slice(0, 60)
      : 'Tag';
    const id = `cat-${categorySlug(name)}-${randomUUID().slice(0, 6)}`;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO categories (id, parent_id, name, is_active, metadata) VALUES ($1, $2, $3, TRUE, $4::jsonb)`,
        [id, groupId, name, JSON.stringify({ iconName })],
      );
      for (const [position, subcategory] of subcategories.entries()) {
        await client.query(
          `INSERT INTO categories (id, parent_id, name, is_active, sort_order)
           VALUES ($1, $2, $3, TRUE, $4)
           ON CONFLICT (parent_id, name) DO NOTHING`,
          [`${id}-sub-${categorySlug(subcategory)}`, id, subcategory, position + 1],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    recordAudit({ action: 'category_created', resource: 'category', resourceId: id, actorRole: 'admin', requestId: requestIdFrom(req), success: true });
    const categories = await loadAdminCategories();
    res.status(201).json({ category: categories.find((entry) => entry.id === id) ?? null, categories });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === '23505') {
      return res.status(409).json({ error: 'Já existe uma categoria com esse nome neste grupo.', code: 'CATEGORY_ALREADY_EXISTS' });
    }
    sendCategoryError(res, error, 'Não foi possível criar a categoria.');
  }
});

app.patch('/api/admin/categories/:categoryId', requireRole('admin'), async (req, res) => {
  const pool = databasePool;
  if (!pool) {
    return res.status(503).json({ error: 'A base de dados PostgreSQL é necessária para editar categorias.', code: 'DATABASE_REQUIRED' });
  }
  const categoryId = req.params.categoryId;
  try {
    const existing = await pool.query<AdminCategoryRow>('SELECT id, name, parent_id, is_active FROM categories WHERE id = $1', [categoryId]);
    if (!existing.rows[0]) {
      return res.status(404).json({ error: 'Categoria não encontrada.', code: 'CATEGORY_NOT_FOUND' });
    }
    const nextName = typeof req.body?.name === 'string' ? req.body.name.trim() : existing.rows[0].name;
    if (nextName.length < 2 || nextName.length > 80) {
      return res.status(400).json({ error: 'O nome da categoria deve ter entre 2 e 80 caracteres.', code: 'CATEGORY_NAME_INVALID' });
    }
    const nextActive = typeof req.body?.isActive === 'boolean' ? req.body.isActive : Boolean(existing.rows[0].is_active);
    const nextIconName = typeof req.body?.iconName === 'string' ? req.body.iconName.trim().slice(0, 60) : '';
    await pool.query(
      `UPDATE categories
          SET name = $2,
              is_active = $3,
              metadata = CASE WHEN $4 = '' THEN metadata ELSE metadata || jsonb_build_object('iconName', $4) END
        WHERE id = $1`,
      [categoryId, nextName, nextActive, nextIconName],
    );
    // Arquivar uma categoria principal tem de arquivar as subcategorias: o
    // catálogo público rejeita subcategorias ativas cujo pai está inativo.
    if (!nextActive) {
      await pool.query('UPDATE categories SET is_active = FALSE WHERE parent_id = $1 AND is_active', [categoryId]);
    }

    if (req.body?.subcategories !== undefined) {
      const wanted = categoryNames(req.body.subcategories).filter((entry) => entry.length <= 80);
      const children = await pool.query<AdminCategoryRow>('SELECT id, name, parent_id, is_active FROM categories WHERE parent_id = $1', [categoryId]);
      // Remover = arquivar (os registos históricos que apontam para a subcategoria mantêm-se).
      for (const child of children.rows) {
        if (!wanted.includes(child.name) && child.is_active) {
          await pool.query('UPDATE categories SET is_active = FALSE WHERE id = $1', [child.id]);
        }
      }
      for (const [position, subcategory] of wanted.entries()) {
        const match = children.rows.find((child) => child.name === subcategory);
        if (match) {
          if (!match.is_active) await pool.query('UPDATE categories SET is_active = TRUE WHERE id = $1', [match.id]);
          continue;
        }
        await pool.query(
          `INSERT INTO categories (id, parent_id, name, is_active, sort_order)
           VALUES ($1, $2, $3, TRUE, $4)
           ON CONFLICT (parent_id, name) DO UPDATE SET is_active = TRUE`,
          [`${categoryId}-sub-${categorySlug(subcategory)}`, categoryId, subcategory, position + 1],
        );
      }
    }
    recordAudit({ action: 'category_updated', resource: 'category', resourceId: categoryId, actorRole: 'admin', requestId: requestIdFrom(req), success: true });
    res.json({ categories: await loadAdminCategories() });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === '23505') {
      return res.status(409).json({ error: 'Já existe uma categoria com esse nome neste grupo.', code: 'CATEGORY_ALREADY_EXISTS' });
    }
    sendCategoryError(res, error, 'Não foi possível actualizar a categoria.');
  }
});

app.delete('/api/admin/categories/:categoryId', requireRole('admin'), async (req, res) => {
  const pool = databasePool;
  if (!pool) {
    return res.status(503).json({ error: 'A base de dados PostgreSQL é necessária para arquivar categorias.', code: 'DATABASE_REQUIRED' });
  }
  try {
    const { rowCount } = await pool.query('UPDATE categories SET is_active = FALSE WHERE id = $1 OR parent_id = $1', [req.params.categoryId]);
    if (!rowCount) return res.status(404).json({ error: 'Categoria não encontrada.', code: 'CATEGORY_NOT_FOUND' });
    recordAudit({ action: 'category_archived', resource: 'category', resourceId: req.params.categoryId, actorRole: 'admin', requestId: requestIdFrom(req), success: true });
    res.json({ success: true, categories: await loadAdminCategories() });
  } catch (error) {
    sendCategoryError(res, error, 'Não foi possível arquivar a categoria.');
  }
});

app.get('/api/admin/locations', requireRole('admin'), async (_req, res) => {
  try {
    // O painel mostra também as localidades arquivadas para permitir reativá-las.
    res.json(await listLocationCatalog({ includeInactive: true }));
  } catch (error) {
    if (error instanceof LocationCatalogError) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    console.error('[Guigui.com] GET /api/admin/locations falhou:', error);
    res.status(500).json({ error: 'Não foi possível carregar as localidades.' });
  }
});

app.post('/api/admin/locations', requireRole('admin'), async (req, res) => {
  try {
    const location = await createLocation(req.body || {});
    recordAudit({ action: 'location_created', resource: 'location', resourceId: location.id, actorRole: 'admin', requestId: requestIdFrom(req), success: true });
    res.status(201).json({ location });
  } catch (error) {
    if (error instanceof LocationCatalogError) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    console.error('[Guigui.com] POST /api/admin/locations falhou:', error);
    res.status(500).json({ error: 'Não foi possível criar a localidade.' });
  }
});

app.patch('/api/admin/locations/:locationId', requireRole('admin'), async (req, res) => {
  try {
    const isActive = req.body?.isActive;
    const location = typeof isActive === 'boolean'
      ? await setLocationActive(req.params.locationId, isActive)
      : await updateLocation(req.params.locationId, req.body || {});
    recordAudit({ action: 'location_updated', resource: 'location', resourceId: location.id, actorRole: 'admin', requestId: requestIdFrom(req), success: true });
    res.json({ location });
  } catch (error) {
    if (error instanceof LocationCatalogError) {
      return res.status(error.status).json({ error: error.message, code: error.code });
    }
    console.error('[Guigui.com] PATCH /api/admin/locations falhou:', error);
    res.status(500).json({ error: 'Não foi possível actualizar a localidade.' });
  }
});

// ADMIN STATS ENDPOINT
// Real platform KPIs aggregated live from PostgreSQL (users, companies, events,
// orders, tickets, payments, support, moderation). Powers the executive overview
// so the dashboard reflects the database instead of hardcoded demo numbers.
app.get('/api/admin/stats', requireRole('admin'), async (_req, res) => {
  if (!databaseConfigured || !databasePool) {
    return res.status(503).json({ error: 'A base de dados PostgreSQL é necessária para as estatísticas.', code: 'DATABASE_REQUIRED' });
  }
  const pool = databasePool;
  const group = async (sql: string) => {
    const r = await pool.query(sql);
    const out: Record<string, number> = {};
    for (const row of r.rows) out[row.key] = Number(row.n);
    return out;
  };
  const rows = async (sql: string) => (await pool.query(sql)).rows;
  try {
    const [
      usersByRole, usersByStatus, usersByMonth,
      companiesByStatus, companiesByMonth,
      eventsByStatus, ordersByStatus, ticketsByStatus,
      paymentsByStatus, paymentsByUseCase,
      revenueAgg, revenueByMonth, revenueByMonthStatus, supportByStatus, moderationByStatus,
    ] = await Promise.all([
      group(`SELECT role AS key, count(*)::int AS n FROM users GROUP BY role`),
      group(`SELECT account_status AS key, count(*)::int AS n FROM users GROUP BY account_status`),
      rows(`SELECT to_char(created_at,'YYYY-MM') AS month, count(*)::int AS n FROM users GROUP BY month ORDER BY month`),
      group(`SELECT status AS key, count(*)::int AS n FROM companies GROUP BY status`),
      rows(`SELECT to_char(created_at,'YYYY-MM') AS month, count(*)::int AS n FROM companies GROUP BY month ORDER BY month`),
      group(`SELECT status AS key, count(*)::int AS n FROM events GROUP BY status`),
      group(`SELECT status AS key, count(*)::int AS n FROM orders GROUP BY status`),
      group(`SELECT status AS key, count(*)::int AS n FROM tickets GROUP BY status`),
      group(`SELECT status AS key, count(*)::int AS n FROM payment_transactions GROUP BY status`),
      group(`SELECT use_case AS key, count(*)::int AS n FROM payment_transactions GROUP BY use_case`),
      // Fonte de verdade da comissão/repasses: o pedido pago. `orders.fee_amount_xof`
      // e `orders.net_amount_xof` são gravados no momento da compra com a política
      // em vigor; `payment_transactions.commission_amount_xof` é legado (fica a 0
      // nos dados históricos e não tem sequer order_id preenchido). Usar os
      // pedidos garante que o financeiro global, o da empresa e o centro de
      // controlo do evento mostram exatamente o mesmo valor.
      rows(`SELECT COALESCE(sum(gross_amount_xof),0)::bigint AS total, COALESCE(sum(fee_amount_xof),0)::bigint AS commission, COALESCE(sum(net_amount_xof),0)::bigint AS net FROM orders WHERE status = 'paid'`),
      rows(`SELECT to_char(created_at,'YYYY-MM') AS month, COALESCE(sum(gross_amount_xof),0)::bigint AS revenue, COALESCE(sum(fee_amount_xof),0)::bigint AS commission, COALESCE(sum(net_amount_xof),0)::bigint AS net FROM orders WHERE status = 'paid' GROUP BY month ORDER BY month`),
      // Série mensal com confirmado/pendente/comissão. É a mesma definição de
      // faturação usada no financeiro: pedidos pagos (gross_amount_xof).
      rows(`SELECT to_char(created_at,'YYYY-MM') AS month,
                   COALESCE(sum(gross_amount_xof) FILTER (WHERE status = 'paid'),0)::bigint AS confirmed,
                   COALESCE(sum(gross_amount_xof) FILTER (WHERE status IN ('created','pending')),0)::bigint AS pending,
                   COALESCE(sum(fee_amount_xof) FILTER (WHERE status = 'paid'),0)::bigint AS commission
              FROM orders GROUP BY month ORDER BY month`),
      group(`SELECT status AS key, count(*)::int AS n FROM support_tickets GROUP BY status`),
      // Fila de moderação do dashboard: o modelo único de submissões. Os quatro
      // estados ativos contam como "pending" para o contador de trabalho em curso.
      group(`SELECT CASE WHEN status IN ('pending','in_review','changes_requested','resubmitted') THEN 'pending' ELSE status END AS key,
                    count(*)::int AS n
               FROM moderation_submissions GROUP BY 1`),
    ]);
    const sum = (obj: Record<string, number>) => Object.values(obj).reduce((a, b) => a + b, 0);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentRevenue = revenueByMonthStatus.find((row) => row.month === currentMonth);
    const pendingXOF = revenueByMonthStatus.reduce((total, row) => total + Number(row.pending ?? 0), 0);
    res.json({
      users: { total: sum(usersByRole), byRole: usersByRole, byStatus: usersByStatus, byMonth: usersByMonth },
      companies: { total: sum(companiesByStatus), byStatus: companiesByStatus, byMonth: companiesByMonth },
      events: { total: sum(eventsByStatus), byStatus: eventsByStatus },
      orders: { total: sum(ordersByStatus), byStatus: ordersByStatus },
      tickets: { total: sum(ticketsByStatus), byStatus: ticketsByStatus },
      payments: { total: sum(paymentsByStatus), byStatus: paymentsByStatus, byUseCase: paymentsByUseCase },
      revenue: {
        grossXOF: Number(revenueAgg[0]?.total ?? 0),
        commissionXOF: Number(revenueAgg[0]?.commission ?? 0),
        netXOF: Number(revenueAgg[0]?.net ?? 0),
        source: 'orders.fee_amount_xof',
        byMonth: revenueByMonth,
        byMonthStatus: revenueByMonthStatus,
        thisMonthXOF: Number(currentRevenue?.confirmed ?? 0),
        commissionThisMonthXOF: Number(currentRevenue?.commission ?? 0),
        pendingXOF,
      },
      support: { total: sum(supportByStatus), byStatus: supportByStatus },
      moderation: { total: sum(moderationByStatus), byStatus: moderationByStatus },
    });
  } catch (error) {
    console.error('[Guigui.com] /api/admin/stats error:', error);
    res.status(500).json({ error: 'Não foi possível carregar as estatísticas administrativas.', code: 'ADMIN_STATS_FAILED' });
  }
});

// ADMIN USERS ENDPOINT
// Paginated, searchable list of platform users with their associated company
// (via company_members), so the "Utilizadores" section shows real accounts.
app.get('/api/admin/users', requireRole('admin'), async (req, res) => {
  if (!databaseConfigured || !databasePool) {
    return res.status(503).json({ error: 'A base de dados PostgreSQL é necessária para consultar utilizadores.', code: 'DATABASE_REQUIRED' });
  }
  const pool = databasePool;
  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const role = typeof req.query.role === 'string' ? req.query.role.trim() : '';
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const dateFrom = typeof req.query.dateFrom === 'string' ? req.query.dateFrom.trim() : '';
  const dateTo = typeof req.query.dateTo === 'string' ? req.query.dateTo.trim() : '';
  const sortKey = typeof req.query.sort === 'string' ? req.query.sort : 'createdAt';
  const direction = req.query.direction === 'asc' ? 'ASC' : 'DESC';
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const params: any[] = [];
  const where: string[] = [];
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where.push(`(lower(u.name) LIKE $${params.length} OR lower(u.email) LIKE $${params.length} OR lower(coalesce(u.phone, '')) LIKE $${params.length})`);
  }
  if (role && ['user', 'business', 'admin'].includes(role)) {
    params.push(role);
    where.push(`u.role = $${params.length}`);
  }
  if (status === 'active' || status === 'deactivated') {
    params.push(status);
    where.push(`coalesce(u.account_status, 'active') = $${params.length}`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
    params.push(dateFrom);
    where.push(`u.created_at >= $${params.length}::date`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
    params.push(dateTo);
    where.push(`u.created_at < ($${params.length}::date + INTERVAL '1 day')`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const sortColumns: Record<string, string> = {
    name: 'u.name',
    email: 'u.email',
    role: 'u.role',
    status: 'u.account_status',
    createdAt: 'u.created_at',
  };
  const orderBy = sortColumns[sortKey] || sortColumns.createdAt;
  try {
    const countResult = await pool.query(`SELECT count(*)::int AS total FROM users u ${whereSql}`, params);
    params.push(limit, offset);
    const rowsResult = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.neighborhood, u.avatar_url, u.role, u.account_status,
              u.account_status_reason, u.status_changed_at, u.birth_date, u.email_verified_at,
              u.phone_verified_at, u.created_at, u.updated_at,
              c.id AS company_id, c.name AS company_name
         FROM users u
         LEFT JOIN company_members cm ON cm.user_id = u.id
         LEFT JOIN companies c ON c.id = cm.company_id
         ${whereSql}
         ORDER BY ${orderBy} ${direction}, u.id ASC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({
      total: countResult.rows[0].total,
      limit,
      offset,
      users: rowsResult.rows.map(mapAdminUserRow),
    });
  } catch (error) {
    console.error('[Guigui.com] /api/admin/users error:', error);
    res.status(500).json({ error: 'Não foi possível carregar os utilizadores.', code: 'ADMIN_USERS_FAILED' });
  }
});

function mapAdminUserRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    neighborhood: row.neighborhood,
    avatarUrl: row.avatar_url,
    role: row.role,
    accountStatus: row.account_status === 'deactivated' ? 'deactivated' : 'active',
    accountStatusReason: row.account_status_reason,
    statusChangedAt: row.status_changed_at,
    birthDate: row.birth_date,
    emailVerifiedAt: row.email_verified_at,
    phoneVerifiedAt: row.phone_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    companyId: row.company_id ?? null,
    companyName: row.company_name ?? null,
  };
}

const ADMIN_USER_SELECT = `SELECT u.id, u.name, u.email, u.phone, u.neighborhood, u.avatar_url, u.role,
       u.account_status, u.account_status_reason, u.status_changed_at, u.birth_date,
       u.email_verified_at, u.phone_verified_at, u.created_at, u.updated_at,
       c.id AS company_id, c.name AS company_name
  FROM users u
  LEFT JOIN company_members cm ON cm.user_id = u.id
  LEFT JOIN companies c ON c.id = cm.company_id`;

async function findAdminUser(userId: string) {
  if (!databasePool) return null;
  const result = await databasePool.query(`${ADMIN_USER_SELECT} WHERE u.id = $1 LIMIT 1`, [userId]);
  return result.rows[0] ? mapAdminUserRow(result.rows[0]) : null;
}

function sendFinanceError(res: express.Response, error: unknown, context: string) {
  if (error instanceof FinanceError) {
    return res.status(error.status).json({ error: error.message, code: error.code });
  }
  console.error(`[Guigui.com] ${context}:`, error);
  return res.status(500).json({ error: 'Não foi possível concluir a operação financeira.', code: 'FINANCE_OPERATION_FAILED' });
}

app.get('/api/admin/finance/summary', requireRole('admin'), async (_req, res) => {
  try {
    res.json(await getFinanceSummary());
  } catch (error) {
    sendFinanceError(res, error, 'GET /api/admin/finance/summary');
  }
});

app.get('/api/admin/finance/alerts', requireRole('admin'), async (_req, res) => {
  try {
    res.json(await listOperationalAlerts());
  } catch (error) {
    sendFinanceError(res, error, 'GET /api/admin/finance/alerts');
  }
});

app.get('/api/admin/finance/transactions', requireRole('admin'), async (req, res) => {
  try {
    const scope = req.query.scope === 'business' ? 'business' : 'platform';
    res.json({ transactions: await listFinanceTransactions(scope) });
  } catch (error) {
    sendFinanceError(res, error, 'GET /api/admin/finance/transactions');
  }
});

app.get('/api/admin/finance/transactions/:transactionId', requireRole('admin'), async (req, res) => {
  if (!databasePool) return res.status(503).json({ error: 'A base de dados PostgreSQL é necessária.', code: 'DATABASE_REQUIRED' });
  try {
    const transaction = await getFinanceTransaction(req.params.transactionId);
    if (!transaction) return res.status(404).json({ error: 'Transação não encontrada.', code: 'TRANSACTION_NOT_FOUND' });
    const [actions, refunds, events, orders] = await Promise.all([
      databasePool.query(
        `SELECT a.id, a.action, a.reason, a.proof_reference, u.name AS actor_name, a.created_at
           FROM payment_manual_actions a
           LEFT JOIN users u ON u.id = a.actor_user_id
          WHERE a.transaction_id = $1 ORDER BY a.created_at DESC`,
        [req.params.transactionId],
      ),
      databasePool.query(
        `SELECT id, amount_xof, reason, status, kind, provider_reference, created_at
           FROM refunds WHERE transaction_id = $1 ORDER BY created_at DESC`,
        [req.params.transactionId],
      ),
      databasePool.query(
        `SELECT id, provider, event_reference, signature_valid, received_at
           FROM payment_events WHERE transaction_id = $1 ORDER BY received_at DESC`,
        [req.params.transactionId],
      ),
      databasePool.query(
        `SELECT o.id, o.status, o.gross_amount_xof, o.fee_amount_xof, o.net_amount_xof,
                o.event_id, e.title AS event_title, e.company_id, c.name AS company_name,
                COUNT(t.id)::int AS ticket_count,
                string_agg(t.ticket_code, ', ' ORDER BY t.ticket_code) AS ticket_codes,
                string_agg(DISTINCT tt.name, ', ') AS ticket_types
           FROM payment_transaction_orders pto
           JOIN orders o ON o.id = pto.order_id
           LEFT JOIN events e ON e.id = o.event_id
           LEFT JOIN companies c ON c.id = e.company_id
           LEFT JOIN tickets t ON t.order_id = o.id
           LEFT JOIN ticket_types tt ON tt.id = t.ticket_type_id
          WHERE pto.transaction_id = $1
          GROUP BY o.id, e.title, e.company_id, c.name
          ORDER BY o.created_at ASC`,
        [req.params.transactionId],
      ),
    ]);
    res.json({ transaction, actions: actions.rows, refunds: refunds.rows, events: events.rows, orders: orders.rows });
  } catch (error) {
    sendFinanceError(res, error, 'GET /api/admin/finance/transactions/:id');
  }
});

app.get('/api/admin/finance/reconciliations', requireRole('admin'), async (_req, res) => {
  try {
    res.json(await listReconciliations());
  } catch (error) {
    sendFinanceError(res, error, 'GET /api/admin/finance/reconciliations');
  }
});

app.post('/api/admin/finance/reconciliations', requireRole('admin'), async (req, res) => {
  try {
    const context = await sessionContext(req);
    const reconciliation = await createReconciliation(req.body || {}, context?.userId || 'system');
    recordAudit({ action: 'payment_reconciliation_created', resource: 'payment_reconciliation', resourceId: String(reconciliation.transactionId || req.body?.transactionId || ''), actorRole: 'admin', actorId: context?.userId, requestId: requestIdFrom(req), success: true });
    res.status(201).json(reconciliation);
  } catch (error) {
    sendFinanceError(res, error, 'POST /api/admin/finance/reconciliations');
  }
});

app.patch('/api/admin/finance/reconciliations/:id', requireRole('admin'), async (req, res) => {
  try {
    const context = await sessionContext(req);
    const reconciliation = await updateReconciliation(req.params.id, req.body || {}, context?.userId || 'system');
    recordAudit({ action: 'payment_reconciliation_updated', resource: 'payment_reconciliation', resourceId: String(reconciliation.transactionId || req.params.id), actorRole: 'admin', actorId: context?.userId, requestId: requestIdFrom(req), success: true });
    res.json(reconciliation);
  } catch (error) {
    sendFinanceError(res, error, 'PATCH /api/admin/finance/reconciliations/:id');
  }
});

app.get('/api/admin/finance/operators', requireRole('admin'), async (_req, res) => {
  try {
    res.json(await getOperatorOverview());
  } catch (error) {
    sendFinanceError(res, error, 'GET /api/admin/finance/operators');
  }
});

app.patch('/api/admin/finance/operators/:provider', requireRole('admin'), async (req, res) => {
  try {
    const context = await sessionContext(req);
    const result = await updateOperatorConfig(req.params.provider, req.body || {}, context?.userId || 'system');
    recordAudit({ action: 'payment_operator_config_updated', resource: 'payment_operator', resourceId: req.params.provider, actorRole: 'admin', actorId: context?.userId, requestId: requestIdFrom(req), success: true });
    res.json(result);
  } catch (error) {
    sendFinanceError(res, error, 'PATCH /api/admin/finance/operators/:provider');
  }
});

app.get('/api/admin/finance/pending', requireRole('admin'), async (_req, res) => {
  try {
    res.json({ items: await listPendingPayments() });
  } catch (error) {
    sendFinanceError(res, error, 'GET /api/admin/finance/pending');
  }
});

app.post('/api/admin/finance/pending/:transactionId/:action', requireRole('admin'), async (req, res) => {
  const action = req.params.action === 'request-proof' ? 'request_proof' : req.params.action;
  if (!['confirm', 'reject', 'request_proof'].includes(action)) {
    return res.status(400).json({ error: 'Ação de pagamento inválida.', code: 'INVALID_PENDING_ACTION' });
  }
  try {
    const context = await sessionContext(req);
    const result = await recordPendingAction(req.params.transactionId, action as 'confirm' | 'reject' | 'request_proof', req.body || {}, context?.userId || 'system');
    const auditAction = action === 'confirm' ? 'payment_confirm' : action === 'reject' ? 'payment_reject' : 'payment_proof_requested';
    recordAudit({ action: auditAction, resource: 'payment', resourceId: req.params.transactionId, actorRole: 'admin', actorId: context?.userId, requestId: requestIdFrom(req), success: true });
    res.json(result);
  } catch (error) {
    sendFinanceError(res, error, 'POST /api/admin/finance/pending/:id/:action');
  }
});

app.get('/api/admin/finance/refunds', requireRole('admin'), async (_req, res) => {
  try {
    res.json({ items: await listRefunds() });
  } catch (error) {
    sendFinanceError(res, error, 'GET /api/admin/finance/refunds');
  }
});

app.post('/api/admin/finance/refunds', requireRole('admin'), async (req, res) => {
  try {
    const context = await sessionContext(req);
    const refund = await createRefund(req.body || {}, context?.userId || 'system');
    recordAudit({ action: 'refund_requested', resource: 'refund', resourceId: String(refund.id || ''), actorRole: 'admin', actorId: context?.userId, requestId: requestIdFrom(req), success: true });
    res.status(201).json(refund);
  } catch (error) {
    sendFinanceError(res, error, 'POST /api/admin/finance/refunds');
  }
});

app.post('/api/admin/finance/refunds/:id/:mode', requireRole('admin'), async (req, res) => {
  const handlers = { authorize: authorizeRefund, process: processRefund, reject: rejectRefund } as const;
  const handler = handlers[req.params.mode as keyof typeof handlers];
  if (!handler) return res.status(400).json({ error: 'Ação de reembolso inválida.', code: 'INVALID_REFUND_ACTION' });
  try {
    const context = await sessionContext(req);
    const result = await handler(req.params.id, req.body || {}, context?.userId || 'system');
    const auditAction = req.params.mode === 'authorize' ? 'refund_authorized' : req.params.mode === 'process' ? 'refund_processed' : 'refund_rejected';
    recordAudit({ action: auditAction, resource: 'refund', resourceId: req.params.id, actorRole: 'admin', actorId: context?.userId, requestId: requestIdFrom(req), success: true });
    res.json(result);
  } catch (error) {
    sendFinanceError(res, error, 'POST /api/admin/finance/refunds/:id/:mode');
  }
});

app.get('/api/admin/finance/statements', requireRole('admin'), async (req, res) => {
  try {
    res.json(await getFinanceStatements(req.query as Record<string, unknown>));
  } catch (error) {
    sendFinanceError(res, error, 'GET /api/admin/finance/statements');
  }
});

function sendPayoutError(res: express.Response, error: unknown, context: string) {
  if (error instanceof PayoutError) {
    return res.status(error.status).json({ error: error.message, code: error.code });
  }
  console.error(`[Guigui.com] ${context}:`, error);
  return res.status(500).json({ error: 'Não foi possível concluir a operação de repasse.', code: 'PAYOUT_OPERATION_FAILED' });
}

// Central financeira de bilhetes: receita própria, comissões, valores devidos
// às empresas e repasses, calculados exclusivamente a partir dos pedidos pagos.
app.get('/api/admin/finance/tickets', requireRole('admin'), async (req, res) => {
  try {
    const companyId = typeof req.query.companyId === 'string' ? req.query.companyId.trim() : '';
    res.setHeader('Cache-Control', 'no-store');
    res.json(await getTicketFinanceOverview(companyId || undefined));
  } catch (error) {
    sendPayoutError(res, error, 'GET /api/admin/finance/tickets');
  }
});

app.get('/api/admin/finance/payouts', requireRole('admin'), async (req, res) => {
  try {
    const payouts = await listPayouts({
      companyId: typeof req.query.companyId === 'string' ? req.query.companyId.trim() : undefined,
      eventId: typeof req.query.eventId === 'string' ? req.query.eventId.trim() : undefined,
      status: typeof req.query.status === 'string' ? req.query.status.trim() : undefined,
    });
    res.setHeader('Cache-Control', 'no-store');
    res.json({ payouts });
  } catch (error) {
    sendPayoutError(res, error, 'GET /api/admin/finance/payouts');
  }
});

app.post('/api/admin/finance/payouts', requireRole('admin'), async (req, res) => {
  try {
    const context = await sessionContext(req);
    const payout = await createPayout(req.body || {}, context?.userId || '');
    recordAudit({
      action: 'event_payout_created',
      resource: 'event_payout',
      resourceId: payout.id,
      actorRole: 'admin',
      actorId: context?.userId,
      requestId: requestIdFrom(req),
      success: true,
      metadata: { companyId: payout.companyId, eventId: payout.eventId, amountXOF: payout.amountXOF, method: payout.method },
    });
    res.status(201).json(payout);
  } catch (error) {
    sendPayoutError(res, error, 'POST /api/admin/finance/payouts');
  }
});

app.patch('/api/admin/finance/payouts/:payoutId', requireRole('admin'), async (req, res) => {
  try {
    const context = await sessionContext(req);
    const payout = await updatePayoutStatus(req.params.payoutId, req.body || {}, context?.userId || '');
    recordAudit({
      action: `event_payout_${payout.status}`,
      resource: 'event_payout',
      resourceId: payout.id,
      actorRole: 'admin',
      actorId: context?.userId,
      requestId: requestIdFrom(req),
      success: true,
      metadata: {
        companyId: payout.companyId,
        eventId: payout.eventId,
        amountXOF: payout.amountXOF,
        reference: payout.reference,
        proofReference: payout.proofReference,
      },
    });
    res.json(payout);
  } catch (error) {
    sendPayoutError(res, error, 'PATCH /api/admin/finance/payouts/:payoutId');
  }
});

// A empresa vê apenas os seus eventos, valores e repasses. Nunca escolhe a
// empresa no pedido: o âmbito vem da sessão autenticada.
app.get('/api/business/finance', requireRole('business'), async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  const stored = await identityAccess.findById(context.userId);
  if (!stored?.businessId) {
    return res.status(403).json({ error: 'A sua conta não está associada a uma empresa.', code: 'BUSINESS_ACCOUNT_REQUIRED' });
  }
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await getCompanyFinance(stored.businessId));
  } catch (error) {
    sendPayoutError(res, error, 'GET /api/business/finance');
  }
});

function sendCommercialError(res: express.Response, error: unknown, context: string) {
  if (error instanceof CommercialError) {
    return res.status(error.status).json({ error: error.message, code: error.code });
  }
  console.error(`[Guigui.com] ${context}:`, error);
  return res.status(500).json({ error: 'Não foi possível concluir a operação comercial.', code: 'COMMERCIAL_OPERATION_FAILED' });
}

async function commercialActor(req: express.Request) {
  const context = await sessionContext(req);
  return { id: context?.userId || '', name: 'Administração Guigui' };
}

app.get('/api/commercial/public-catalog', async (req, res) => {
  try {
    res.json(await getPublicCommercialCatalog(String(req.query.companyId || '')));
  } catch (error) {
    sendCommercialError(res, error, 'GET /api/commercial/public-catalog');
  }
});

app.get('/api/admin/commercial/overview', requireRole('admin'), async (_req, res) => {
  try {
    res.json(await getCommercialOverview());
  } catch (error) {
    sendCommercialError(res, error, 'GET /api/admin/commercial/overview');
  }
});

app.get('/api/admin/commercial/plans/:planId/config', requireRole('admin'), async (req, res) => {
  try {
    res.json(await getCommercialPlanConfiguration(req.params.planId));
  } catch (error) {
    sendCommercialError(res, error, 'GET /api/admin/commercial/plans/:planId/config');
  }
});

app.post('/api/admin/commercial/plans', requireRole('admin'), async (req, res) => {
  try {
    const actor = await commercialActor(req);
    res.status(201).json(await createCommercialPlan(req.body || {}, actor, String(req.body?.reason || '')));
  } catch (error) {
    sendCommercialError(res, error, 'POST /api/admin/commercial/plans');
  }
});

app.patch('/api/admin/commercial/plans/:planId', requireRole('admin'), async (req, res) => {
  try {
    const actor = await commercialActor(req);
    res.json(await updateCommercialPlan(req.params.planId, req.body || {}, actor, String(req.body?.reason || '')));
  } catch (error) {
    sendCommercialError(res, error, 'PATCH /api/admin/commercial/plans/:planId');
  }
});

app.post('/api/admin/commercial/plans/:planId/duplicate', requireRole('admin'), async (req, res) => {
  try {
    const actor = await commercialActor(req);
    res.status(201).json(await duplicateCommercialPlan(req.params.planId, req.body || {}, actor, String(req.body?.reason || '')));
  } catch (error) {
    sendCommercialError(res, error, 'POST /api/admin/commercial/plans/:planId/duplicate');
  }
});

app.post('/api/admin/commercial/plans/:planId/toggle', requireRole('admin'), async (req, res) => {
  try {
    const actor = await commercialActor(req);
    res.json(await toggleCommercialPlan(req.params.planId, Boolean(req.body?.active), actor, String(req.body?.reason || '')));
  } catch (error) {
    sendCommercialError(res, error, 'POST /api/admin/commercial/plans/:planId/toggle');
  }
});

app.put('/api/admin/commercial/plans/:planId/configuration', requireRole('admin'), async (req, res) => {
  try {
    const actor = await commercialActor(req);
    res.json(await updatePlanConfiguration(req.params.planId, req.body?.features, actor, String(req.body?.reason || '')));
  } catch (error) {
    sendCommercialError(res, error, 'PUT /api/admin/commercial/plans/:planId/configuration');
  }
});

app.put('/api/admin/commercial/matrix/:groupId/:planId', requireRole('admin'), async (req, res) => {
  try {
    const actor = await commercialActor(req);
    res.json(await updatePriceMatrix(req.params.groupId, req.params.planId, req.body || {}, actor, String(req.body?.reason || '')));
  } catch (error) {
    sendCommercialError(res, error, 'PATCH /api/admin/commercial/matrix/:groupId/:planId');
  }
});

app.post('/api/admin/commercial/price-groups', requireRole('admin'), async (req, res) => {
  try {
    const actor = await commercialActor(req);
    res.status(201).json(await createPriceGroup(req.body || {}, actor, String(req.body?.reason || '')));
  } catch (error) {
    sendCommercialError(res, error, 'POST /api/admin/commercial/price-groups');
  }
});

app.post('/api/admin/commercial/features', requireRole('admin'), async (req, res) => {
  try {
    const actor = await commercialActor(req);
    res.status(201).json(await createFeature(req.body || {}, actor, String(req.body?.reason || '')));
  } catch (error) {
    sendCommercialError(res, error, 'POST /api/admin/commercial/features');
  }
});

app.patch('/api/admin/commercial/features/:featureId', requireRole('admin'), async (req, res) => {
  try {
    const actor = await commercialActor(req);
    res.json(await updateFeature(req.params.featureId, req.body || {}, actor, String(req.body?.reason || '')));
  } catch (error) {
    sendCommercialError(res, error, 'PATCH /api/admin/commercial/features/:featureId');
  }
});

app.post('/api/admin/commercial/products', requireRole('admin'), async (req, res) => {
  try {
    const actor = await commercialActor(req);
    res.status(201).json(await createProduct(req.body || {}, actor, String(req.body?.reason || '')));
  } catch (error) {
    sendCommercialError(res, error, 'POST /api/admin/commercial/products');
  }
});

app.patch('/api/admin/commercial/products/:productId', requireRole('admin'), async (req, res) => {
  try {
    const actor = await commercialActor(req);
    res.json(await updateProduct(req.params.productId, req.body || {}, actor, String(req.body?.reason || '')));
  } catch (error) {
    sendCommercialError(res, error, 'PATCH /api/admin/commercial/products/:productId');
  }
});

app.post('/api/admin/commercial/packages', requireRole('admin'), async (req, res) => {
  try {
    const actor = await commercialActor(req);
    res.status(201).json(await createPackage(req.body || {}, actor, String(req.body?.reason || '')));
  } catch (error) {
    sendCommercialError(res, error, 'POST /api/admin/commercial/packages');
  }
});

app.patch('/api/admin/commercial/ticket-fees', requireRole('admin'), async (req, res) => {
  try {
    const actor = await commercialActor(req);
    res.json(await updateTicketFees(req.body || {}, actor, String(req.body?.reason || '')));
  } catch (error) {
    sendCommercialError(res, error, 'PATCH /api/admin/commercial/ticket-fees');
  }
});

app.put('/api/admin/commercial/rules', requireRole('admin'), async (req, res) => {
  try {
    const actor = await commercialActor(req);
    res.json(await updateCommercialRules(req.body || {}, actor, String(req.body?.reason || '')));
  } catch (error) {
    sendCommercialError(res, error, 'PUT /api/admin/commercial/rules');
  }
});

app.get('/api/admin/commercial/subscriptions', requireRole('admin'), async (req, res) => {
  try {
    res.json(await listCommercialSubscriptions(req.query || {}));
  } catch (error) {
    sendCommercialError(res, error, 'GET /api/admin/commercial/subscriptions');
  }
});

app.get('/api/admin/commercial/subscriptions/:subscriptionId', requireRole('admin'), async (req, res) => {
  try {
    res.json(await getCommercialSubscriptionDetail(req.params.subscriptionId));
  } catch (error) {
    sendCommercialError(res, error, 'GET /api/admin/commercial/subscriptions/:subscriptionId');
  }
});

app.patch('/api/admin/commercial/subscriptions/:subscriptionId', requireRole('admin'), async (req, res) => {
  try {
    const actor = await commercialActor(req);
    res.json(await changeSubscriptionStatus(req.params.subscriptionId, req.body || {}, actor, String(req.body?.reason || '')));
  } catch (error) {
    sendCommercialError(res, error, 'PATCH /api/admin/commercial/subscriptions/:subscriptionId');
  }
});

app.post('/api/admin/commercial/subscriptions/:subscriptionId/renew', requireRole('admin'), async (req, res) => {
  try {
    const actor = await commercialActor(req);
    res.json(await renewSubscription(req.params.subscriptionId, req.body || {}, actor, String(req.body?.reason || '')));
  } catch (error) {
    sendCommercialError(res, error, 'POST /api/admin/commercial/subscriptions/:subscriptionId/renew');
  }
});

app.get('/api/admin/commercial/subscriptions/:subscriptionId/entitlements', requireRole('admin'), async (req, res) => {
  try {
    res.json(await getSubscriptionEntitlements(req.params.subscriptionId));
  } catch (error) {
    sendCommercialError(res, error, 'GET /api/admin/commercial/subscriptions/:subscriptionId/entitlements');
  }
});

app.post('/api/admin/commercial/subscriptions/:subscriptionId/plan-change', requireRole('admin'), async (req, res) => {
  try {
    const actor = await commercialActor(req);
    res.json(await changeSubscriptionPlan(req.params.subscriptionId, req.body || {}, actor, String(req.body?.reason || '')));
  } catch (error) {
    sendCommercialError(res, error, 'POST /api/admin/commercial/subscriptions/:subscriptionId/plan-change');
  }
});

app.put('/api/admin/commercial/subscriptions/:subscriptionId/exceptions', requireRole('admin'), async (req, res) => {
  try {
    const actor = await commercialActor(req);
    res.json(await updateSubscriptionExceptions(req.params.subscriptionId, req.body || {}, actor, String(req.body?.reason || '')));
  } catch (error) {
    sendCommercialError(res, error, 'PUT /api/admin/commercial/subscriptions/:subscriptionId/exceptions');
  }
});

// ---------------------------------------------------------------------------
// Módulo Sistema — monitorização técnica real (exclusivo da administração)
// ---------------------------------------------------------------------------

function sendSystemError(res: Response, error: unknown, context: string) {
  const code = (error as { code?: string }).code;
  if (code === 'SYSTEM_MONITORING_UNAVAILABLE') {
    return res.status(503).json({
      error: (error as Error).message,
      code,
      hint: 'Aplique a migração 036_system_monitoring.sql (npm run db:migrate).',
    });
  }
  if (code === 'SYSTEM_SETTING_INVALID' || code === 'SYSTEM_INCIDENT_INVALID') {
    return res.status(400).json({ error: (error as Error).message, code });
  }
  if (code === 'NOT_FOUND') {
    return res.status(404).json({ error: (error as Error).message, code });
  }
  console.error(`[Guigui.com] ${context}:`, error);
  return res.status(500).json({ error: 'Não foi possível concluir a operação de monitorização.', code: 'SYSTEM_MONITORING_FAILED' });
}

async function systemActorName(req: Request): Promise<string> {
  const context = await sessionContext(req);
  if (!context) return 'Administração';
  const stored = await identityAccess.findById(context.userId);
  return stored?.name || 'Administração';
}

app.get('/api/admin/system/overview', requireRole('admin'), async (_req, res) => {
  try {
    res.json(await getSystemOverview());
  } catch (error) {
    sendSystemError(res, error, 'GET /api/admin/system/overview');
  }
});

app.get('/api/admin/system/infrastructure', requireRole('admin'), async (_req, res) => {
  try {
    res.json(await getSystemInfrastructure());
  } catch (error) {
    sendSystemError(res, error, 'GET /api/admin/system/infrastructure');
  }
});

app.get('/api/admin/system/resources', requireRole('admin'), async (req, res) => {
  try {
    res.json(await getSystemResources(Number(req.query.hours || 24)));
  } catch (error) {
    sendSystemError(res, error, 'GET /api/admin/system/resources');
  }
});

app.get('/api/admin/system/database', requireRole('admin'), async (_req, res) => {
  try {
    res.json(await getSystemDatabase());
  } catch (error) {
    sendSystemError(res, error, 'GET /api/admin/system/database');
  }
});

app.get('/api/admin/system/apis', requireRole('admin'), async (req, res) => {
  try {
    res.json(await getSystemApiMonitoring(Number(req.query.days || 7)));
  } catch (error) {
    sendSystemError(res, error, 'GET /api/admin/system/apis');
  }
});

app.get('/api/admin/system/incidents', requireRole('admin'), async (req, res) => {
  try {
    res.json(await listSystemIncidents({
      status: typeof req.query.status === 'string' ? req.query.status : undefined,
      severity: typeof req.query.severity === 'string' ? req.query.severity : undefined,
      service: typeof req.query.service === 'string' ? req.query.service : undefined,
      query: typeof req.query.q === 'string' ? req.query.q : undefined,
      limit: Number(req.query.limit || 50),
    }));
  } catch (error) {
    sendSystemError(res, error, 'GET /api/admin/system/incidents');
  }
});

app.get('/api/admin/system/incidents/:incidentId', requireRole('admin'), async (req, res) => {
  try {
    const detail = await getSystemIncident(req.params.incidentId);
    if (!detail) return res.status(404).json({ error: 'Incidente não encontrado.', code: 'NOT_FOUND' });
    res.json(detail);
  } catch (error) {
    sendSystemError(res, error, 'GET /api/admin/system/incidents/:incidentId');
  }
});

app.post('/api/admin/system/incidents', requireRole('admin'), async (req, res) => {
  try {
    const actorName = await systemActorName(req);
    const incident = await createSystemIncident(req.body || {}, actorName);
    recordAudit({
      action: 'system_incident_created',
      resource: 'system_incident',
      resourceId: incident.id,
      actorRole: 'admin',
      actorName,
      requestId: requestIdFrom(req),
      success: true,
      metadata: { severity: incident.severity, service: incident.service },
    });
    res.status(201).json({ incident });
  } catch (error) {
    sendSystemError(res, error, 'POST /api/admin/system/incidents');
  }
});

app.patch('/api/admin/system/incidents/:incidentId', requireRole('admin'), async (req, res) => {
  try {
    const actorName = await systemActorName(req);
    const incident = await updateSystemIncident(req.params.incidentId, req.body || {}, actorName);
    recordAudit({
      action: 'system_incident_updated',
      resource: 'system_incident',
      resourceId: incident.id,
      actorRole: 'admin',
      actorName,
      requestId: requestIdFrom(req),
      success: true,
      metadata: { status: incident.status, severity: incident.severity },
    });
    res.json({ incident });
  } catch (error) {
    sendSystemError(res, error, 'PATCH /api/admin/system/incidents/:incidentId');
  }
});

app.get('/api/admin/system/logs', requireRole('admin'), async (req, res) => {
  try {
    res.json(await listSystemLogs({
      level: typeof req.query.level === 'string' ? req.query.level : undefined,
      service: typeof req.query.service === 'string' ? req.query.service : undefined,
      query: typeof req.query.q === 'string' ? req.query.q : undefined,
      requestId: typeof req.query.requestId === 'string' ? req.query.requestId : undefined,
      hours: Number(req.query.hours || 24),
      limit: Number(req.query.limit || 100),
    }));
  } catch (error) {
    sendSystemError(res, error, 'GET /api/admin/system/logs');
  }
});

app.get('/api/admin/system/availability', requireRole('admin'), async (_req, res) => {
  try {
    res.json(await getSystemAvailability());
  } catch (error) {
    sendSystemError(res, error, 'GET /api/admin/system/availability');
  }
});

app.get('/api/admin/system/security', requireRole('admin'), async (req, res) => {
  try {
    res.json(await getSystemSecurity(Number(req.query.days || 7)));
  } catch (error) {
    sendSystemError(res, error, 'GET /api/admin/system/security');
  }
});

app.get('/api/admin/system/settings', requireRole('admin'), async (_req, res) => {
  try {
    res.json(await getSystemSettings());
  } catch (error) {
    sendSystemError(res, error, 'GET /api/admin/system/settings');
  }
});

app.put('/api/admin/system/settings', requireRole('admin'), async (req, res) => {
  try {
    const actorName = await systemActorName(req);
    const body = req.body || {};
    const input = {
      intervalSeconds: Number(body.intervalSeconds),
      cpuThreshold: Number(body.cpuThreshold),
      memoryThreshold: Number(body.memoryThreshold),
      dbLatencyThresholdMs: Number(body.dbLatencyThresholdMs),
      errorRateThreshold: Number(body.errorRateThreshold),
      retentionDays: Number(body.retentionDays),
      sloTarget: Number(body.sloTarget),
      alertsEnabled: body.alertsEnabled !== false,
    };
    const result = await updateSystemSettings(input, actorName);
    recordAudit({
      action: 'system_settings_updated',
      resource: 'system_monitoring_settings',
      resourceId: '1',
      actorRole: 'admin',
      actorName,
      requestId: requestIdFrom(req),
      success: true,
      metadata: input,
    });
    res.json(result);
  } catch (error) {
    sendSystemError(res, error, 'PUT /api/admin/system/settings');
  }
});

app.get('/api/admin/commercial/audit', requireRole('admin'), async (req, res) => {
  try {
    res.json(await listCommercialAudit(req.query || {}));
  } catch (error) {
    sendCommercialError(res, error, 'GET /api/admin/commercial/audit');
  }
});

app.get('/api/admin/commercial/product-sales', requireRole('admin'), async (_req, res) => {
  try {
    res.json({ items: await getProductSales() });
  } catch (error) {
    sendCommercialError(res, error, 'GET /api/admin/commercial/product-sales');
  }
});

app.get('/api/admin/sessions', requireRole('admin'), async (_req, res) => {
  if (!databasePool) {
    return res.status(503).json({ error: 'A base de dados PostgreSQL é necessária.', code: 'DATABASE_REQUIRED' });
  }
  try {
    const result = await databasePool.query(
      `SELECT s.id, s.user_id, u.name AS user_name, u.email AS user_email, u.role AS user_role,
              s.created_at, s.last_seen_at, s.expires_at, s.revoked_at, s.ip_address, s.user_agent
         FROM sessions s
         JOIN users u ON u.id = s.user_id
        ORDER BY s.created_at DESC
        LIMIT 200`,
    );
    res.json({
      sessions: result.rows.map((row) => ({
        id: row.id,
        user_id: row.user_id,
        user_name: row.user_name,
        user_email: row.user_email,
        user_role: row.user_role,
        created_at: new Date(row.created_at).toISOString(),
        last_seen_at: new Date(row.last_seen_at).toISOString(),
        expires_at: new Date(row.expires_at).toISOString(),
        revoked_at: row.revoked_at ? new Date(row.revoked_at).toISOString() : null,
        ip_address: row.ip_address || null,
        user_agent: row.user_agent || null,
      })),
    });
  } catch (error) {
    console.error('[Guigui.com] GET /api/admin/sessions error:', error);
    res.status(500).json({ error: 'Não foi possível carregar as sessões.', code: 'ADMIN_SESSIONS_FAILED' });
  }
});

app.delete('/api/admin/sessions/:sessionId', requireRole('admin'), async (req, res) => {
  if (!databasePool) {
    return res.status(503).json({ error: 'A base de dados PostgreSQL é necessária.', code: 'DATABASE_REQUIRED' });
  }
  const requestId = requestIdFrom(req);
  try {
    const result = await databasePool.query(
      'UPDATE sessions SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL RETURNING id, user_id',
      [req.params.sessionId],
    );
    const revoked = result.rows[0];
    if (!revoked) {
      return res.status(404).json({ error: 'Sessão não encontrada ou já revogada.', code: 'SESSION_NOT_FOUND' });
    }
    recordAudit({
      action: 'admin_session_revoked',
      resource: 'session',
      resourceId: String(revoked.id),
      actorRole: 'admin',
      requestId,
      success: true,
      metadata: { userId: revoked.user_id },
    });
    res.json({ success: true });
  } catch (error) {
    console.error('[Guigui.com] DELETE /api/admin/sessions/:id error:', error);
    res.status(500).json({ error: 'Não foi possível revogar a sessão.', code: 'ADMIN_SESSION_REVOKE_FAILED' });
  }
});

app.get('/api/admin/users/:userId', requireRole('admin'), async (req, res) => {
  if (!databasePool) {
    return res.status(503).json({ error: 'A base de dados PostgreSQL é necessária.', code: 'DATABASE_REQUIRED' });
  }
  try {
    const user = await findAdminUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'Conta não encontrada.', code: 'USER_NOT_FOUND' });
    const [orders, notifications, sessions] = await Promise.all([
      databasePool.query('SELECT count(*)::int AS total FROM orders WHERE user_id = $1', [req.params.userId]).catch(() => ({ rows: [{ total: 0 }] })),
      databasePool.query('SELECT count(*)::int AS total FROM notifications WHERE user_id = $1', [req.params.userId]).catch(() => ({ rows: [{ total: 0 }] })),
      databasePool.query(
        'SELECT count(*)::int AS total FROM sessions WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()',
        [req.params.userId],
      ).catch(() => ({ rows: [{ total: 0 }] })),
    ]);
    res.json({
      user,
      company: user.companyId ? { id: user.companyId, name: user.companyName } : null,
      counts: {
        orders: Number(orders.rows[0]?.total || 0),
        notifications: Number(notifications.rows[0]?.total || 0),
        active_sessions: Number(sessions.rows[0]?.total || 0),
      },
    });
  } catch (error) {
    console.error('[Guigui.com] GET /api/admin/users/:id error:', error);
    res.status(500).json({ error: 'Não foi possível abrir a ficha da conta.', code: 'ADMIN_USER_DETAIL_FAILED' });
  }
});

app.get('/api/admin/users/:userId/activity', requireRole('admin'), async (req, res) => {
  if (!databasePool) {
    return res.status(503).json({ error: 'A base de dados PostgreSQL é necessária.', code: 'DATABASE_REQUIRED' });
  }
  try {
    const [audit, sessions] = await Promise.all([
      databasePool.query(
        `SELECT a.id, a.action, a.result, a.reason, a.actor_user_id, a.created_at, a.before_data, a.after_data,
                u.name AS actor_name
           FROM audit_logs a
           LEFT JOIN users u ON u.id = a.actor_user_id
          WHERE a.resource = 'user' AND a.resource_id = $1
          ORDER BY a.created_at DESC
          LIMIT 100`,
        [req.params.userId],
      ).catch(() => ({ rows: [] as any[] })),
      databasePool.query(
        `SELECT id, last_seen_at, ip_address, user_agent FROM sessions
          WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
          ORDER BY last_seen_at DESC LIMIT 20`,
        [req.params.userId],
      ).catch(() => ({ rows: [] as any[] })),
    ]);
    res.json({
      activity: audit.rows.map((row: any) => {
        // `persistPostgresAudit` guarda o metadata em after_data; as rotas de
        // utilizadores incluem aí o mapa `before`/`after` dos campos alterados.
        const metadata = row.after_data && typeof row.after_data === 'object' ? row.after_data : {};
        const before = (metadata.before && typeof metadata.before === 'object') ? metadata.before : null;
        const after = (metadata.after && typeof metadata.after === 'object') ? metadata.after : null;
        const changedFields = before && after
          ? Object.keys(after)
            .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
            .map((key) => key.replace(/_([a-z])/g, (_match, letter: string) => letter.toUpperCase()))
          : [];
        return {
          id: row.id,
          timestamp: row.created_at,
          action: row.action,
          result: row.result,
          reason: row.reason,
          actorId: row.actor_user_id,
          actorName: row.actor_name || 'Sistema',
          changedFields,
          before,
          after,
        };
      }),
      sessions: sessions.rows,
    });
  } catch (error) {
    console.error('[Guigui.com] GET /api/admin/users/:id/activity error:', error);
    res.status(500).json({ error: 'Não foi possível carregar o histórico da conta.', code: 'ADMIN_USER_ACTIVITY_FAILED' });
  }
});

app.patch('/api/admin/users/:userId', requireRole('admin'), async (req, res) => {
  if (!databasePool) {
    return res.status(503).json({ error: 'A base de dados PostgreSQL é necessária.', code: 'DATABASE_REQUIRED' });
  }
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  const userId = req.params.userId;
  try {
    const current = await findAdminUser(userId);
    if (!current) return res.status(404).json({ error: 'Conta não encontrada.', code: 'USER_NOT_FOUND' });

    const updates: string[] = [];
    const params: any[] = [];
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};
    const setField = (column: string, value: unknown, beforeValue: unknown) => {
      params.push(value);
      updates.push(`${column} = $${params.length}`);
      before[column] = beforeValue;
      after[column] = value;
    };

    if (typeof req.body?.name === 'string') {
      const name = req.body.name.trim();
      if (name.length < 2 || name.length > 120) {
        return res.status(400).json({ error: 'O nome deve ter entre 2 e 120 caracteres.', code: 'USER_NAME_INVALID' });
      }
      if (name !== current.name) setField('name', name, current.name);
    }
    if (typeof req.body?.neighborhood === 'string') {
      const neighborhood = req.body.neighborhood.trim();
      if (!neighborhood) return res.status(400).json({ error: 'A localização é obrigatória.', code: 'USER_LOCATION_REQUIRED' });
      if (neighborhood !== (current.neighborhood || '')) setField('neighborhood', neighborhood, current.neighborhood);
    }
    if (typeof req.body?.avatarUrl === 'string') {
      const avatarUrl = req.body.avatarUrl.trim();
      if (avatarUrl && !/^https?:\/\//i.test(avatarUrl) && !/^data:image\//i.test(avatarUrl)) {
        return res.status(400).json({ error: 'A fotografia deve ser um URL de imagem válido.', code: 'USER_AVATAR_INVALID' });
      }
      if (avatarUrl !== (current.avatarUrl || '')) setField('avatar_url', avatarUrl || null, current.avatarUrl);
    }
    if (req.body?.birthDate !== undefined) {
      const raw = String(req.body.birthDate || '').trim();
      if (raw && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return res.status(400).json({ error: 'A data de nascimento não é válida.', code: 'USER_BIRTHDATE_INVALID' });
      }
      if (raw && new Date(`${raw}T00:00:00Z`).getTime() > Date.now()) {
        return res.status(400).json({ error: 'A data de nascimento não pode estar no futuro.', code: 'USER_BIRTHDATE_INVALID' });
      }
      const nextValue = raw || null;
      if (nextValue !== (current.birthDate ? String(current.birthDate).slice(0, 10) : null)) {
        setField('birth_date', nextValue, current.birthDate);
      }
    }
    let suspendReason = '';
    let statusChanged = false;
    if (req.body?.accountStatus !== undefined) {
      const nextStatus = req.body.accountStatus === 'deactivated' ? 'deactivated' : 'active';
      suspendReason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
      if (nextStatus === 'deactivated' && suspendReason.length < 3) {
        return res.status(400).json({ error: 'Indique o motivo da suspensão (mínimo 3 caracteres).', code: 'USER_REASON_REQUIRED' });
      }
      if (nextStatus !== current.accountStatus) {
        setField('account_status', nextStatus, current.accountStatus);
        params.push(nextStatus === 'deactivated' ? suspendReason : null);
        updates.push(`account_status_reason = $${params.length}`);
        before.account_status_reason = current.accountStatusReason;
        after.account_status_reason = nextStatus === 'deactivated' ? suspendReason : null;
        updates.push('status_changed_at = NOW()');
        statusChanged = true;
      }
    }

    if (updates.length === 0) {
      return res.json({ success: true, user: current, changed: false });
    }
    params.push(userId);
    await databasePool.query(
      `UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
      params,
    );
    if (statusChanged && after.account_status === 'deactivated') {
      await identityAccess.revokeAllSessions(userId).catch(() => 0);
    }
    recordAudit({
      action: statusChanged ? 'admin_user_status_changed' : 'admin_user_updated',
      resource: 'user',
      resourceId: userId,
      actorId: context.userId,
      actorRole: 'admin',
      success: true,
      requestId: requestIdFrom(req),
      metadata: { before, after, ...(suspendReason ? { reason: suspendReason } : {}) },
    });
    res.json({ success: true, changed: true, user: await findAdminUser(userId) });
  } catch (error) {
    console.error('[Guigui.com] PATCH /api/admin/users/:id error:', error);
    res.status(500).json({ error: 'Não foi possível guardar as alterações.', code: 'ADMIN_USER_UPDATE_FAILED' });
  }
});

app.post('/api/admin/users/:userId/request-password-reset', requireRole('admin'), async (req, res) => {
  const requestId = requestIdFrom(req);
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  try {
    const user = await findAdminUser(req.params.userId);
    if (!user) return res.status(404).json({ error: 'Conta não encontrada.', code: 'USER_NOT_FOUND' });
    if (!await consumeAccountRateLimit('password-reset', user.email, PASSWORD_RESET_RATE_LIMIT_WINDOW_MS, PASSWORD_RESET_MAX_ATTEMPTS)) {
      return res.status(429).json({ error: 'Demasiados pedidos de recuperação para esta conta. Tente novamente mais tarde.', code: 'PASSWORD_RESET_RATE_LIMITED' });
    }
    const token = await identityAccess.requestPasswordReset(user.email);
    if (!token) {
      recordAudit({
        action: 'admin_user_password_reset_failed',
        resource: 'user',
        resourceId: user.id,
        actorId: context.userId,
        actorRole: 'admin',
        success: false,
        requestId,
        metadata: { reason: 'token_not_created' },
      });
      return res.status(409).json({ error: 'Não foi possível gerar o código de recuperação para esta conta.', code: 'PASSWORD_RESET_NOT_CREATED' });
    }
    const delivery = await emailDelivery.sendPasswordReset({
      recipientEmail: user.email,
      recipientName: user.name,
      token,
      expiresInMinutes: 15,
    });
    if (delivery.state !== 'accepted') {
      recordAudit({
        action: 'admin_user_password_reset_failed',
        resource: 'user',
        resourceId: user.id,
        actorId: context.userId,
        actorRole: 'admin',
        success: false,
        requestId,
        metadata: { reason: 'delivery_not_accepted', mode: delivery.mode, state: delivery.state },
      });
      return res.status(503).json({
        success: false,
        error: 'O código foi gerado mas o email não foi aceite pelo fornecedor. Nenhuma instrução foi enviada.',
        code: 'PASSWORD_RESET_DELIVERY_FAILED',
      });
    }
    recordAudit({
      action: 'admin_user_password_reset_requested',
      resource: 'user',
      resourceId: user.id,
      actorId: context.userId,
      actorRole: 'admin',
      success: true,
      requestId,
      metadata: { deliveryMode: delivery.mode },
    });
    res.json({ success: true, message: 'Código de recuperação enviado para o email registado do utilizador.' });
  } catch (error) {
    console.error('[Guigui.com] reset de credenciais falhou:', error);
    recordAudit({
      action: 'admin_user_password_reset_failed',
      resource: 'user',
      actorId: context.userId,
      actorRole: 'admin',
      success: false,
      requestId,
      metadata: { reason: 'exception' },
    });
    res.status(500).json({ error: 'Não foi possível iniciar a redefinição.', code: 'ADMIN_USER_RESET_FAILED' });
  }
});

// ADMIN PAYMENTS ENDPOINT (read-only, banco)
// Trail de auditoria real vindo da tabela PostgreSQL (audit_logs), para o hub
// de auditoria do admin mostrar a actividade da plataforma em vez da demo local.
function auditLogCategoryOf(action: string, resource: string): 'business' | 'moderation' | 'financial' | 'admin_management' | 'security' | 'ticket_redemption' | 'system' {
  const hay = `${action} ${resource}`.toLowerCase();
  if (/redemption|redeem|ticket_valid|validate_ticket|scanner|door_code/.test(hay)) return 'ticket_redemption';
  if (/payment|monetiz|subscription|refund|ledger|commission|wallet|price|catalog/.test(hay)) return 'financial';
  if (/moderation|gemini|ai_moderation/.test(hay)) return 'moderation';
  if (/business|company|campaign|promotion|event/.test(hay)) return 'business';
  if (/admin|staff|permission|role|team|invitation/.test(hay)) return 'admin_management';
  if (/auth|login|session|password|mfa|cors|token/.test(hay)) return 'security';
  return 'system';
}

function auditLogSeverityOf(action: string, result: string): 'info' | 'warning' | 'critical' | 'security' {
  const hay = action.toLowerCase();
  if (/auth|login|session|password|mfa|cors/.test(hay)) return 'security';
  if (result === 'failure') return /delete|revoke|suspend|refund|denied|denied/.test(hay) ? 'critical' : 'warning';
  return 'info';
}

function auditLogActionLabel(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
}

app.get('/api/admin/audit-logs', requireRole('admin'), async (req, res) => {
  if (!databaseConfigured || !databasePool) {
    return res.status(503).json({ error: 'A base de dados PostgreSQL é necessária para consultar a auditoria.', code: 'DATABASE_REQUIRED' });
  }
  try {
    const limit = Math.min(Number(req.query.limit) || 500, 2000);
    const result = await databasePool.query(
      `SELECT a.id, a.action, a.resource, a.resource_id, a.result, a.reason,
              a.actor_user_id, a.ip_address::text AS ip_address, a.after_data, a.created_at,
              u.name AS actor_name
         FROM audit_logs a
         LEFT JOIN users u ON u.id = a.actor_user_id
        ORDER BY a.created_at DESC
        LIMIT $1`,
      [limit],
    );
    const logs = result.rows.map((row: Record<string, unknown>) => {
      const action = String(row.action || 'unknown');
      const outcome = String(row.result || 'success');
      const resource = String(row.resource || 'system');
      const afterData = (row.after_data && typeof row.after_data === 'object' ? row.after_data : {}) as Record<string, unknown>;
      return {
        id: String(row.id),
        timestamp: new Date(String(row.created_at)).toISOString().slice(0, 19).replace('T', ' '),
        actorId: String(row.actor_user_id || 'system'),
        actorName: String(afterData.actorName || row.actor_name || 'Sistema'),
        actorRole: String(afterData.actorRole || 'system'),
        action,
        actionLabel: auditLogActionLabel(action),
        category: auditLogCategoryOf(action, resource),
        severity: auditLogSeverityOf(action, outcome),
        targetEntity: resource,
        targetId: row.resource_id ? String(row.resource_id) : undefined,
        ipAddress: String(row.ip_address || '—'),
        deviceInfo: '—',
        details: String(row.reason || afterData.title || afterData.code || '') || '—',
      };
    });
    res.json({ logs, total: logs.length });
  } catch (error) {
    console.error('[Guigui.com] /api/admin/audit-logs error:', error);
    res.status(500).json({ error: 'Não foi possível carregar os logs de auditoria.', code: 'ADMIN_AUDIT_LOGS_FAILED' });
  }
});

// Devolve as transaccoes reais de payment_transactions mapeadas para o shape do
// frontend. Read-only: nao interfere no fluxo de reconciliacao (array em memoria).
app.get('/api/admin/payments', requireRole('admin'), async (req, res) => {
  if (!databaseConfigured || !databasePool) {
    return res.status(503).json({ error: 'A base de dados PostgreSQL é necessária para consultar pagamentos.', code: 'DATABASE_REQUIRED' });
  }
  const limit = Math.min(Math.max(Number(req.query.limit) || 500, 1), 1000);
  try {
    const transactions = await listPostgresPayments(limit);
    const revenueXOF = transactions
      .filter((t) => t.status === 'confirmed_api' || t.status === 'confirmed_manual')
      .reduce((sum, t) => sum + t.amountXOF, 0);
    res.json({ transactions, total: transactions.length, revenueXOF });
  } catch (error) {
    console.error('[Guigui.com] /api/admin/payments error:', error);
    res.status(500).json({ error: 'Não foi possível carregar os pagamentos.', code: 'ADMIN_PAYMENTS_FAILED' });
  }
});

app.post('/api/admin/businesses/:id/decision', requireRole('admin'), async (req, res) => {
  const requestId = requestIdFrom(req);
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  if (!databaseConfigured) return res.status(503).json({ error: 'A base de dados PostgreSQL é necessária para decidir empresas.', code: 'DATABASE_REQUIRED' });
  const decision = req.body?.decision;
  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim().slice(0, 1000) : '';
  if (decision !== 'approve' && decision !== 'reject') return res.status(400).json({ error: 'A decisão deve ser approve ou reject.', code: 'INVALID_BUSINESS_DECISION' });
  if (decision === 'reject' && reason.length < 3) return res.status(400).json({ error: 'Indique o motivo da rejeição.', code: 'REJECTION_REASON_REQUIRED' });
  try {
    const business = await decidePostgresBusiness(req.params.id, decision, context.userId, reason);
    if (!business) return res.status(409).json({ error: 'A empresa não está pendente ou não existe.', code: 'BUSINESS_NOT_PENDING' });
    recordAudit({ action: decision === 'approve' ? 'business_approved' : 'business_rejected', resource: 'company', resourceId: req.params.id, actorRole: 'admin', actorName: context.userId, requestId, success: true, metadata: { reason } });
    res.json({ success: true, business });
  } catch (error) {
    recordAudit({ action: 'business_decision_failed', resource: 'company', resourceId: req.params.id, actorRole: 'admin', actorName: context.userId, requestId, success: false, metadata: { decision, reason, error: error instanceof Error ? error.message : 'unknown' } });
    res.status(500).json({ error: 'Não foi possível persistir a decisão administrativa.', code: 'BUSINESS_DECISION_FAILED' });
  }
});

// Suspender/reactivar é uma acção operacional distinta da decisão de
// aprovação: só se suspende uma empresa activa e só se reactiva uma suspensa,
// para que o estado "pending" continue a ter de passar por /decision.
app.patch('/api/admin/businesses/:id/status', requireRole('admin'), async (req, res) => {
  const requestId = requestIdFrom(req);
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  if (!databaseConfigured) return res.status(503).json({ error: 'A base de dados PostgreSQL é necessária para alterar o estado da empresa.', code: 'DATABASE_REQUIRED' });
  const status = req.body?.status;
  if (status !== 'active' && status !== 'suspended') {
    return res.status(400).json({ error: 'O estado deve ser active ou suspended.', code: 'INVALID_BUSINESS_STATUS' });
  }
  try {
    const current = await getPostgresBusiness(req.params.id);
    if (!current) return res.status(404).json({ error: 'Empresa não encontrada.', code: 'BUSINESS_NOT_FOUND' });
    const previousStatus = String(current.status ?? '');
    const allowed = status === 'suspended' ? previousStatus === 'active' : previousStatus === 'suspended';
    if (!allowed) {
      return res.status(409).json({
        error: status === 'suspended'
          ? 'Só é possível suspender uma empresa activa.'
          : 'Só é possível reactivar uma empresa suspensa.',
        code: 'BUSINESS_STATUS_TRANSITION_NOT_ALLOWED',
        currentStatus: previousStatus,
      });
    }
    const business = await updatePostgresBusinessStatus(req.params.id, status);
    if (!business) return res.status(404).json({ error: 'Empresa não encontrada.', code: 'BUSINESS_NOT_FOUND' });
    recordAudit({
      action: status === 'suspended' ? 'business_suspended' : 'business_reactivated',
      resource: 'company',
      resourceId: req.params.id,
      // requireRole('admin') já garantiu o papel; SessionRole inclui 'user',
      // que não faz parte de GuiguiRole.
      actorRole: 'admin',
      actorId: context.userId,
      requestId,
      success: true,
      metadata: { previousStatus, status },
    });
    res.json({ success: true, business });
  } catch (error) {
    recordAudit({
      action: 'business_status_failed',
      resource: 'company',
      resourceId: req.params.id,
      actorRole: 'admin',
      actorId: context.userId,
      requestId,
      success: false,
      metadata: { status, error: error instanceof Error ? error.message : 'unknown' },
    });
    res.status(500).json({ error: 'Não foi possível alterar o estado da empresa.', code: 'BUSINESS_STATUS_UPDATE_FAILED' });
  }
});

const editableBusinessProfileFields = new Set([
  'name',
  'categoryId',
  'subcategoryId',
  'groupGroupId',
  'description',
  'phone',
  'neighborhood',
  'address',
  'whatsapp',
  'publicEmail',
  'website',
  'openingHours',
  'socialLinks',
  'serviceLanguages',
  'notApplicableFields',
  'logo',
  'coverImage',
  'gallery',
]);
const protectedBusinessProfileFields = new Set([
  'id',
  'ownerUserId',
  'ownerName',
  'status',
  'approvalStatus',
  'verified',
  'featured',
  'homepageFeaturedOrder',
  'tier',
  'planId',
  'planName',
  'subscriptionPlanVersion',
  'subscriptionPlanSnapshot',
  'subscriptionUsage',
  'subscriptionRenewDate',
  'subscriptionPeriod',
  'subscriptionStartedAt',
  'subscriptionStatus',
  'subscriptionPaymentId',
  'subscriptionAlertKeys',
  'subscriptionSuspendedAt',
  'subscriptionSuspensionReason',
  'subscriptionAutoSuspended',
  'postsQuotaRemaining',
  'monetizationWallet',
  'rating',
  'ratingLabel',
  'reviewsCount',
  'reviews',
  'posts',
  'promotions',
  'metrics',
  'reviewedBy',
  'reviewedAt',
  'reviewDecision',
  'reviewReason',
  'moderation',
  'moderationStatus',
]);
const requiredBusinessProfileFields = new Set([
  'name',
  'categoryId',
  'subcategoryId',
  'description',
  'phone',
  'neighborhood',
]);
const optionalNotApplicableFields = new Set([
  'address',
  'openingHours',
  'publicEmail',
  'whatsapp',
  'website',
  'socialLinks',
  'serviceLanguages',
]);
const businessProfileStringFields = new Set([
  'name',
  'categoryId',
  'subcategoryId',
  'description',
  'phone',
  'neighborhood',
  'address',
  'whatsapp',
  'publicEmail',
  'website',
  'openingHours',
  'logo',
  'coverImage',
]);

function validateBusinessProfileUpdate(
  input: unknown,
  storedProfile?: Record<string, unknown> | null,
):
  | { ok: true; profile: Record<string, unknown> }
  | { ok: false; error: { code: string; message: string } } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: { code: 'INVALID_BUSINESS_PROFILE', message: 'O perfil da empresa deve ser um objeto.' } };
  }

  const profile: Record<string, unknown> = {};
  const entries = Object.entries(input);
  if (entries.length === 0) {
    return { ok: false, error: { code: 'INVALID_BUSINESS_PROFILE', message: 'Indique pelo menos um campo do perfil.' } };
  }

  for (const [field, value] of entries) {
    if (protectedBusinessProfileFields.has(field)) {
      return { ok: false, error: { code: 'PROTECTED_BUSINESS_FIELD', message: `O campo ${field} não pode ser alterado nesta operação.` } };
    }
    if (!editableBusinessProfileFields.has(field)) {
      return { ok: false, error: { code: 'INVALID_BUSINESS_PROFILE', message: `O campo ${field} não pertence ao perfil editável.` } };
    }

    if (businessProfileStringFields.has(field)) {
      if (typeof value !== 'string') {
        return { ok: false, error: { code: 'INVALID_BUSINESS_PROFILE', message: `O campo ${field} deve ser texto.` } };
      }
      const normalized = value.trim();
      // Um campo legado inválido que o cliente reenvia sem alterações não deve
      // bloquear a gravação de outro campo; só uma alteração deliberada valida.
      const unchangedLegacyValue = typeof storedProfile?.[field] === 'string'
        && (storedProfile[field] as string).trim() === normalized;
      if (unchangedLegacyValue) {
        profile[field] = normalized;
        continue;
      }
      if (requiredBusinessProfileFields.has(field) && !normalized) {
        return { ok: false, error: { code: 'INVALID_BUSINESS_PROFILE', message: `O campo ${field} é obrigatório.` } };
      }
      if (field === 'description' && normalized.length < 30) {
        return { ok: false, error: { code: 'INVALID_BUSINESS_PROFILE', message: 'A descrição deve conter pelo menos 30 caracteres.' } };
      }
      if (field === 'publicEmail' && normalized && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        return { ok: false, error: { code: 'INVALID_BUSINESS_PROFILE', message: 'O email público não é válido.' } };
      }
      profile[field] = normalized;
      continue;
    }

    if (field === 'gallery') {
      if (!Array.isArray(value) || value.some((image) => typeof image !== 'string')) {
        return { ok: false, error: { code: 'INVALID_BUSINESS_PROFILE', message: 'A galeria deve ser uma lista de imagens.' } };
      }
      profile[field] = value.filter((image): image is string => typeof image === 'string').map((image) => image.trim());
      continue;
    }

    if (field === 'socialLinks') {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { ok: false, error: { code: 'INVALID_BUSINESS_PROFILE', message: 'As redes sociais devem ser um objeto válido.' } };
      }
      const socialLinks = value as Record<string, unknown>;
      if (Object.keys(socialLinks).some((network) => !['facebook', 'instagram'].includes(network))
        || Object.values(socialLinks).some((url) => typeof url !== 'string')) {
        return { ok: false, error: { code: 'INVALID_BUSINESS_PROFILE', message: 'As redes sociais contêm valores inválidos.' } };
      }
      profile[field] = Object.fromEntries(Object.entries(socialLinks).map(([network, url]) => [network, (url as string).trim()]));
      continue;
    }

    if (field === 'groupGroupId') {
      if (typeof value !== 'string' || ![
        'restauracao',
        'hotelaria_saude_educacao',
        'corporativo_financeiro',
        'ongs_artesãos',
        'servicos_profissionais',
      ].includes(value)) {
        return { ok: false, error: { code: 'INVALID_BUSINESS_PROFILE', message: 'O grupo da categoria não é válido.' } };
      }
      profile[field] = value;
      continue;
    }

    if (field === 'serviceLanguages') {
      if (!Array.isArray(value) || value.some((language) => !['pt', 'fr', 'en', 'es'].includes(String(language)))) {
        return { ok: false, error: { code: 'INVALID_BUSINESS_PROFILE', message: 'A lista de idiomas de atendimento não é válida.' } };
      }
      profile[field] = [...new Set(value)];
      continue;
    }

    if (field === 'notApplicableFields') {
      if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !optionalNotApplicableFields.has(item))) {
        return { ok: false, error: { code: 'INVALID_BUSINESS_PROFILE', message: 'A lista de campos não aplicáveis não é válida.' } };
      }
      profile[field] = [...new Set(value)];
    }
  }

  return { ok: true, profile };
}

app.patch('/api/businesses/:id/profile', requireRole('business', 'admin'), async (req, res) => {
  const requestId = requestIdFrom(req);
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });

  const storedBusinessUser = context.role === 'business'
    ? (await identityAccess.findById(context.userId) || undefined)
    : null;
  const decision = resolveBusinessWrite(context.role, storedBusinessUser?.businessId, req.params.id);
  if (decision.allowed === false) {
    recordAudit({
      action: 'business_profile_update_denied',
      resource: 'company',
      resourceId: req.params.id,
      actorRole: context.role === 'user' ? 'citizen' : context.role,
      requestId,
      success: false,
      metadata: { code: decision.code },
    });
    return res.status(decision.status).json({
      error: 'Não possui permissão para editar esta empresa.',
      code: decision.code,
    });
  }

  const validation = validateBusinessProfileUpdate(req.body);
  if (validation.ok === false) {
    return res.status(400).json(validation.error);
  }

  try {

    const business = await updatePostgresBusinessProfile(req.params.id, validation.profile);
    if (!business) {
      return res.status(404).json({ error: 'Empresa não encontrada.', code: 'BUSINESS_NOT_FOUND' });
    }
    return res.json({ success: true, business: toPublicBusinessDto(business) });
  } catch (error) {
    console.error('[Guigui.com] business profile update failed:', error);
    return res.status(500).json({
      error: 'Não foi possível guardar o perfil da empresa.',
      code: 'BUSINESS_PROFILE_UPDATE_FAILED',
    });
  }
});

app.post('/api/businesses', requireSession, async (req, res) => {
  const requestId = requestIdFrom(req);
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });

  const business = req.body || {};
  // A posse é decidida antes de validar o corpo: um pedido para uma ficha
  // alheia responde 403 mesmo que os restantes campos estejam incompletos.
  const targetBusinessId = String(context.role === 'admin' ? business.id : (business.businessId || business.id || ''));
  const storedBusinessUser = context.role === 'business'
    ? (await identityAccess.findById(context.userId) || undefined)
    : null;
  const decision = resolveBusinessWrite(context.role, storedBusinessUser?.businessId, targetBusinessId);
  if (decision.allowed === false) {
    recordAudit({
      action: 'business_write_denied',
      resource: 'company',
      resourceId: targetBusinessId,
      actorRole: context.role === 'user' ? 'citizen' : context.role,
      requestId,
      success: false,
      metadata: { code: decision.code },
    });
    return res.status(decision.status).json({ error: 'Não possui permissão para gravar esta empresa.', code: decision.code });
  }

  if (!business.id || !business.name) {
    return res.status(400).json({ error: 'id e name são obrigatórios para a empresa.' });
  }

  if (context.role === 'business') {
    const profileInput = Object.fromEntries(
      Object.entries(business).filter(([field]) => editableBusinessProfileFields.has(field)),
    );
    const storedProfile = await getPostgresBusiness(targetBusinessId);
    const validation = validateBusinessProfileUpdate(profileInput, storedProfile);
    if (validation.ok === false) {
      return res.status(400).json(validation.error);
    }

    try {
      const updatedBusiness = await updatePostgresBusinessProfile(targetBusinessId, validation.profile);
      if (!updatedBusiness) {
        return res.status(404).json({ error: 'Empresa não encontrada.', code: 'BUSINESS_NOT_FOUND' });
      }
      return res.json({ success: true, business: toPublicBusinessDto(updatedBusiness) });
    } catch (error) {
      console.error('[Guigui.com] legacy business profile update failed:', error);
      return res.status(500).json({
        error: 'Não foi possível guardar o perfil da empresa.',
        code: 'BUSINESS_PROFILE_UPDATE_FAILED',
      });
    }
  }

  try {
    await persistPostgresBusiness({ ...business, id: targetBusinessId });
    res.json({ success: true, business: { ...business, id: targetBusinessId } });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao persistir empresa no banco.' });
  }
});

app.get('/api/events', async (req, res) => {
  try {
    const events = databaseConfigured
      ? await listPostgresEvents()
      : Array.from(eventSnapshots.values());
    const viewer = await resolvePublicViewer(req);
    res.json({ events: filterEventsForViewer(events, viewer) });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar eventos.' });
  }
});

app.post('/api/events', requireSession, async (req, res) => {
  const requestId = requestIdFrom(req);
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });

  const event = req.body || {};
  // Um evento é sempre propriedade da empresa organizadora: o businessId vem da
  // sessão, nunca do corpo do pedido, para impedir eventos em nome de terceiros.
  const storedBusinessUser = context.role === 'business'
    ? (await identityAccess.findById(context.userId) || undefined)
    : null;
  // Uma empresa fica sempre ligada à sua própria conta; a administração pode
  // indicar a empresa organizadora, porque gere o conjunto da plataforma.
  const resolvedBusinessId = context.role === 'admin'
    ? (event.businessId || event.companyId)
    : storedBusinessUser?.businessId;
  const decision = resolveEventWrite(context.role, storedBusinessUser?.businessId, resolvedBusinessId);
  if (decision.allowed === false) {
    recordAudit({
      action: 'event_write_denied',
      resource: 'event',
      resourceId: String(event.id || ''),
      actorRole: context.role === 'user' ? 'citizen' : context.role,
      requestId,
      success: false,
      metadata: { code: decision.code },
    });
    return res.status(decision.status).json({ error: 'Não possui permissão para gravar este evento.', code: decision.code });
  }

  if (!event.id || !event.title) {
    return res.status(400).json({ error: 'id e title são obrigatórios para o evento.' });
  }

  try {
    const previousEvent = eventSnapshots.get(event.id);
    // Limite do plano aplicado no servidor: a quota de eventos deixa de existir
    // apenas na interface. Só a criação é limitada; editar um evento existente
    // (incluindo publicar ou corrigir) continua permitido.
    if (!previousEvent && context.role === 'business' && resolvedBusinessId) {
      try {
        const quota = await getCompanyPlanEventQuota(String(resolvedBusinessId));
        if (quota.enforced && quota.remaining <= 0) {
          recordAudit({
            action: 'event_write_denied',
            resource: 'event',
            resourceId: String(event.id || ''),
            actorRole: 'business',
            actorId: context.userId,
            requestId,
            success: false,
            metadata: { code: 'PLAN_EVENT_LIMIT_REACHED', limit: quota.limit, used: quota.used },
          });
          return res.status(409).json({
            error: `O plano da empresa atingiu o limite de ${quota.limit} eventos (${quota.used} usados).`,
            code: 'PLAN_EVENT_LIMIT_REACHED',
            limit: quota.limit,
            used: quota.used,
            requestId,
          });
        }
      } catch (error) {
        // Uma falha na leitura da assinatura não deve impedir a criação do
        // evento: o limite é uma política comercial, não uma condição de
        // integridade dos dados.
        console.error('[Guigui.com] Falha ao verificar a quota de eventos do plano:', error);
      }
    }
    const storedEvent = {
      ...previousEvent,
      ...event,
      ...(Array.isArray(event.ticketTypes) ? { ticketTypes: event.ticketTypes } : previousEvent?.ticketTypes ? { ticketTypes: previousEvent.ticketTypes } : {}),
      businessId: resolvedBusinessId,
    };
    await persistPostgresEvent(storedEvent);
    eventSnapshots.set(storedEvent.id, storedEvent);
    persistEventSnapshots();
    // Histórico do evento: cada gravação fica registada para o centro de controlo.
    recordAudit({
      action: previousEvent ? 'event_updated' : 'event_created',
      resource: 'event',
      resourceId: storedEvent.id,
      actorRole: context.role === 'user' ? 'citizen' : context.role,
      actorId: context.userId,
      requestId,
      success: true,
      metadata: previousEvent
        ? {
            statusChanged: previousEvent.status !== storedEvent.status,
            dateChanged: previousEvent.date !== storedEvent.date,
            timeChanged: previousEvent.time !== storedEvent.time,
            locationChanged: previousEvent.location !== storedEvent.location,
          }
        : { created: true },
    });
    res.json({ success: true, event: storedEvent });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao persistir evento no banco.' });
  }
});


/* ------------------------------------------------------------------ *
 * Centro de controlo individual do evento
 * Empresa organizadora (só os seus eventos) e Super Admin. Reaproveita os
 * dados operacionais existentes; não há cálculo financeiro paralelo.
 * ------------------------------------------------------------------ */

async function resolveEventViewer(req: express.Request): Promise<{ viewer: EventViewer | null; status?: number; code?: string; error?: string }> {
  const context = await sessionContext(req);
  if (!context) {
    return { viewer: null, status: 401, code: 'AUTHENTICATION_REQUIRED', error: 'Sessão autenticada necessária.' };
  }
  if (context.role !== 'business' && context.role !== 'admin') {
    return { viewer: null, status: 403, code: 'EVENT_CONTROL_FORBIDDEN', error: 'Apenas a empresa organizadora ou a administração podem abrir o evento.' };
  }
  if (context.role === 'admin') {
    return { viewer: { role: 'admin', userId: context.userId, companyId: null } };
  }
  const stored = await identityAccess.findById(context.userId);
  if (!stored?.businessId) {
    return { viewer: null, status: 403, code: 'BUSINESS_ACCOUNT_REQUIRED', error: 'A sua conta não está associada a uma empresa.' };
  }
  return { viewer: { role: 'business', userId: context.userId, companyId: stored.businessId } };
}

app.get('/api/events/:eventId/control-center', requireRole('business', 'admin'), async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const resolved = await resolveEventViewer(req);
  if (!resolved.viewer) {
    return res.status(resolved.status || 403).json({ error: resolved.error, code: resolved.code });
  }
  if (!databasePool) {
    return res.status(503).json({ error: 'O centro de controlo exige base de dados configurada.', code: 'DATABASE_REQUIRED' });
  }
  const eventId = String(req.params.eventId || '').trim();
  if (!eventId) return res.status(400).json({ error: 'Evento inválido.', code: 'EVENT_REQUIRED' });
  try {
    const data = await loadEventControlCenter(databasePool, eventId, resolved.viewer);
    if (!data) return res.status(404).json({ error: 'Evento não encontrado.', code: 'EVENT_NOT_FOUND' });
    res.json({ data });
  } catch (error) {
    if ((error as { code?: string }).code === 'EVENT_FORBIDDEN') {
      recordAudit({
        action: 'event_control_denied',
        resource: 'event',
        resourceId: eventId,
        actorRole: resolved.viewer.role,
        actorId: resolved.viewer.userId,
        requestId: requestIdFrom(req),
        success: false,
        metadata: { reason: 'company_scope' },
      });
      return res.status(403).json({ error: 'Não tem acesso a este evento.', code: 'EVENT_FORBIDDEN' });
    }
    console.error('[Guigui.com] event control center failed:', error);
    res.status(500).json({ error: 'Não foi possível carregar o centro de controlo do evento.', code: 'EVENT_CONTROL_FAILED' });
  }
});

app.get('/api/events/:eventId/control-center/export', requireRole('business', 'admin'), async (req, res) => {
  const resolved = await resolveEventViewer(req);
  if (!resolved.viewer) {
    return res.status(resolved.status || 403).json({ error: resolved.error, code: resolved.code });
  }
  if (!databasePool) {
    return res.status(503).json({ error: 'A exportação exige base de dados configurada.', code: 'DATABASE_REQUIRED' });
  }
  const eventId = String(req.params.eventId || '').trim();
  if (!eventId) return res.status(400).json({ error: 'Evento inválido.', code: 'EVENT_REQUIRED' });
  const format = String(req.query.format || 'csv').toLowerCase();
  if (format !== 'csv' && format !== 'xlsx' && format !== 'pdf') {
    return res.status(400).json({ error: 'Formato de exportação inválido.', code: 'INVALID_EXPORT_FORMAT', formats: ['csv', 'xlsx', 'pdf'] });
  }
  const sections = normaliseSections(req.query.sections ?? EXPORT_SECTIONS);
  if (sections.length === 0) {
    return res.status(400).json({ error: 'Selecione pelo menos uma secção para exportar.', code: 'EXPORT_SECTIONS_REQUIRED', sections: EXPORT_SECTIONS });
  }
  try {
    // A exportação carrega o evento com um limite alto para não truncar dados.
    const loaded = await loadEventControlCenter(databasePool, eventId, resolved.viewer, { ticketLimit: 50000 });
    if (!loaded) return res.status(404).json({ error: 'Evento não encontrado.', code: 'EVENT_NOT_FOUND' });
    // A exportação respeita os filtros aplicados no centro de controlo e
    // documenta-os no próprio relatório.
    const exportFilter = {
      ticketQuery: typeof req.query.ticketQuery === 'string' ? req.query.ticketQuery : undefined,
      buyerQuery: typeof req.query.buyerQuery === 'string' ? req.query.buyerQuery : undefined,
      validationQuery: typeof req.query.validationQuery === 'string' ? req.query.validationQuery : undefined,
      ticketStatus: typeof req.query.ticketStatus === 'string' ? req.query.ticketStatus : undefined,
      orderStatus: typeof req.query.orderStatus === 'string' ? req.query.orderStatus : undefined,
      validationResult: typeof req.query.validationResult === 'string' ? req.query.validationResult : undefined,
    };
    const data = filterEventData(loaded, exportFilter);
    const slug = (data.event.title || 'evento')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase()
      .slice(0, 60) || 'evento';
    const filename = `evento-${slug}-${new Date().toISOString().slice(0, 10)}`;
    if (format === 'csv') {
      const csv = buildEventCsv(data, sections, exportFilter);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.setHeader('Cache-Control', 'no-store');
      res.send(csv);
    } else if (format === 'xlsx') {
      const buffer = await buildEventXlsx(data, sections, exportFilter);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
      res.setHeader('Cache-Control', 'no-store');
      res.send(buffer);
    } else {
      const buffer = await buildEventPdf(data, sections, exportFilter);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.pdf"`);
      res.setHeader('Cache-Control', 'no-store');
      res.send(buffer);
    }
    recordAudit({
      action: 'event_report_exported',
      resource: 'event',
      resourceId: eventId,
      actorRole: resolved.viewer.role,
      actorId: resolved.viewer.userId,
      requestId: requestIdFrom(req),
      success: true,
      metadata: { format, sections, filters: exportFilter },
    });
  } catch (error) {
    if ((error as { code?: string }).code === 'EVENT_FORBIDDEN') {
      recordAudit({
        action: 'event_report_export_denied',
        resource: 'event',
        resourceId: eventId,
        actorRole: resolved.viewer.role,
        actorId: resolved.viewer.userId,
        requestId: requestIdFrom(req),
        success: false,
        metadata: { reason: 'company_scope', format },
      });
      return res.status(403).json({ error: 'Não tem acesso a este evento.', code: 'EVENT_FORBIDDEN' });
    }
    console.error('[Guigui.com] event report export failed:', error);
    res.status(500).json({ error: 'Não foi possível gerar a exportação do evento.', code: 'EVENT_EXPORT_FAILED' });
  }
});

app.post('/api/product-events', async (req, res) => {
    const eventName = typeof req.body?.eventName === 'string' ? req.body.eventName.trim() : '';
    const source = typeof req.body?.source === 'string' ? req.body.source.trim() : 'web';
    const context = req.body?.context && typeof req.body.context === 'object' && !Array.isArray(req.body.context) ? req.body.context : {};
    if (!eventName || eventName.length > 80 || source.length > 120) {
      return res.status(400).json({ error: 'Evento de produto inválido.', code: 'PRODUCT_EVENT_INVALID' });
    }
    const contextSession = await sessionContext(req);
    await persistProductEvent({
      eventName,
      source,
      appVersion: typeof req.body?.appVersion === 'string' ? req.body.appVersion : undefined,
      userId: contextSession?.userId,
      sessionId: typeof req.body?.sessionId === 'string' ? req.body.sessionId : undefined,
      context,
    });
    res.status(202).json({ accepted: true });
});

app.get('/api/admin/product-funnel', requireRole('admin'), async (req, res) => {
    const days = Number(req.query.days || 30);
    res.json(await getProductFunnel(Number.isFinite(days) ? days : 30));
});

app.get('/api/openapi.json', (_req, res) => {
  res.sendFile(path.resolve(process.cwd(), 'docs/openapi.json'));
});

app.get('/api/metrics', requireRole('admin'), observabilityHandlers.adminMetrics);

app.get('/metrics', observabilityHandlers.prometheusMetrics);

app.get('/api/monetization/catalog', (_req, res) => {
  res.json(normaliseMonetizationCatalog(monetizationCatalogStore));
});

app.put('/api/monetization/catalog', requireRole('admin'), async (req, res) => {
  const incoming = req.body as MonetizationCatalog;
  if (!incoming || !Array.isArray(incoming.products) || !Array.isArray(incoming.adPlacements) || !Array.isArray(incoming.contentServices) || !incoming.ticketFeePolicy) {
    return res.status(400).json({ error: 'Catálogo de monetização inválido.', code: 'INVALID_MONETIZATION_CATALOG' });
  }
  const normalisedIncoming = normaliseMonetizationCatalog(incoming);
  const nextVersion = Math.max((monetizationCatalogStore.version || 1) + 1, normalisedIncoming.version || 1);
  const next: MonetizationCatalog = {
    ...normalisedIncoming,
    version: nextVersion,
    updatedAt: new Date().toISOString(),
    history: [...(monetizationCatalogStore.history || []), { id: `MON-CATALOG-${Date.now()}`, version: nextVersion, changedBy: 'Admin API', changedAt: new Date().toISOString(), reason: 'Alteração guardada no catálogo', changedAreas: ['catalog'] }],
  };
  Object.keys(monetizationCatalogStore).forEach((key) => delete (monetizationCatalogStore as unknown as Record<string, unknown>)[key]);
  Object.assign(monetizationCatalogStore, next);
  persistMonetizationCatalog();
  await persistPostgresCatalog(next);
  recordAudit({ action: 'monetization_catalog_updated', resource: 'monetization_catalog', actorRole: 'admin', requestId: requestIdFrom(req), success: true, metadata: { version: next.version, products: next.products.length, placements: next.adPlacements.length } });
  res.json({ success: true, catalog: next });
});

app.get('/api/monetization/ledger', requireRole('admin'), (_req, res) => res.json(monetizationLedger));
app.get('/api/monetization/requests', requireRole('admin'), (_req, res) => res.json(monetizationRequests));
app.post('/api/monetization/requests', requireRole('business'), async (req, res) => {
  const { kind, businessId, businessName, serviceId, serviceName, productId, productCode, productName, notes } = req.body || {};
  const context = await sessionContext(req);
  const requestedBusinessId = typeof businessId === 'string' && businessId.trim() ? businessId.trim() : undefined;
  // Autorização antes da validação: a empresa alheia recebe 403, não 400.
  const storedBusinessUser = context ? await identityAccess.findById(context.userId) || undefined : undefined;
  const scope = resolveBusinessScope(context?.role, storedBusinessUser?.businessId, requestedBusinessId);
  if (scope.allowed === false) {
    return res.status(scope.status).json({ error: 'O pedido não pertence à empresa autenticada.', code: scope.code });
  }
  if (!['content_service', 'advertising'].includes(String(kind)) || !requestedBusinessId || typeof (serviceName || productName) !== 'string') {
    return res.status(400).json({ error: 'Pedido comercial inválido.', code: 'INVALID_MONETIZATION_REQUEST' });
  }
  const request = { id: `MON-REQ-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`, kind, businessId: businessId.trim(), businessName: String(businessName || ''), serviceId, serviceName, productId, productCode, productName, notes: String(notes || '').slice(0, 2000), status: 'requested', createdAt: new Date().toISOString() };
  monetizationRequests.unshift(request);
  persistMonetizationRequests();
  recordAudit({ action: 'monetization_request_created', resource: 'monetization_request', resourceId: request.id, actorRole: 'business', actorId: context?.userId, success: true, metadata: { kind, businessId: request.businessId, serviceId, productCode } });
  res.status(201).json({ success: true, request });
});
app.get('/api/monetization/wallet/:businessId', requireRole('admin', 'business'), async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  if (context.role === 'business') {
    const storedUser = await identityAccess.findById(context.userId) || undefined;
    const sessionBusinessId = storedUser?.businessId;
    if (!sessionBusinessId || sessionBusinessId !== req.params.businessId) {
      return res.status(403).json({ error: 'Não possui permissão para consultar esta empresa.', code: 'BUSINESS_SCOPE_REQUIRED' });
    }
  }
  return res.json(monetizationWallets[req.params.businessId] || { postsExtraPurchased: 0, promotionsExtraPurchased: 0, postsExtraUsed: 0, promotionsExtraUsed: 0 });
});

const demoUsers: Array<PublicIdentity & { password: string }> = [
  { id: 'demo-citizen', name: 'Malam Bacar', email: 'cidadao.teste@guigui.com', role: 'user', phone: '+245 955 12 34', neighborhood: 'Bissau Velho', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80', password: 'Guigui@2026!' },
  { id: 'demo-business', name: 'Coqueiros Bissau', email: 'empresa.teste@guigui.com', role: 'business', phone: '+245 955 88 99', neighborhood: 'Praça dos Heróis', avatarUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=200&q=80', businessId: 'biz-1', businessName: 'Coqueiros Bissau', password: 'Guigui@2026!' },
  { id: 'demo-admin', name: 'Administração Guigui', email: 'admin.teste@guigui.com', role: 'admin', phone: '+245 955 00 00', neighborhood: 'Centro Administrativo', avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80', password: 'Guigui@2026!' },
];

function findDemoUserById(userId: string): PublicIdentity | undefined {
  const demo = demoUsers.find((user) => user.id === userId);
  if (!demo) return undefined;
  const { password: _password, ...publicUser } = demo;
  return publicUser;
}

identityAccess = createIdentityAccess({
  databaseConfigured,
  demoAccountsEnabled,
  demoUsers,
  // O mesmo client ID público usado pelo botão no browser; sem ele o login
  // Google fica desactivado em vez de aceitar tokens por verificar.
  verifyGoogleIdToken: createGoogleIdTokenVerifier({
    clientId: process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '',
  }),
  businessProvisioning: {
    validateProfile: (profile) => ({
      missingFields: getBusinessProfileCompletion(profile).missingFields,
    }),
    createProfile: async (profile) => {
      await persistPostgresBusiness({
        id: profile.id,
        name: profile.name,
        status: 'pending',
        createdAt: new Date().toISOString(),
        categoryId: profile.categoryId,
        data: {
          categoryId: profile.categoryId,
          groupGroupId: profile.groupGroupId,
          subcategoryId: profile.subcategoryId,
          description: profile.description,
          phone: profile.phone,
          neighborhood: profile.neighborhood,
          ...(profile.publicEmail ? { publicEmail: profile.publicEmail } : {}),
        },
      });
      return { id: profile.id };
    },
    assignOwner: assignPostgresBusinessOwner,
    deleteProfile: deletePostgresBusiness,
  },
  createBusinessInvitationAccess: ({ findInviterById, findInvitedMemberById }) => ({
    validate: async (input) => {
      const inviter = await findInviterById(input.inviterUserId);
      if (!inviter || inviter.role !== 'business' || inviter.businessId !== input.businessId) return null;
      if (inviter.teamRole) {
        const canonicalInviterPermissions = BUSINESS_ROLE_PERMISSIONS[inviter.teamRole];
        if (!sameBusinessTeamPermissions(inviter.teamPermissions, canonicalInviterPermissions) || !canonicalInviterPermissions.profile) return null;
      } else if (inviter.teamPermissions) {
        return null;
      }
      return { role: input.role, permissions: { ...BUSINESS_ROLE_PERMISSIONS[input.role] } };
    },
    addMember: async (input) => {
      const member = await findInvitedMemberById(input.userId);
      const canonicalPermissions = BUSINESS_ROLE_PERMISSIONS[input.role];
      return Boolean(
        member
        && member.role === 'business'
        && member.businessId === input.businessId
        && member.teamRole === input.role
        && sameBusinessTeamPermissions(member.teamPermissions, canonicalPermissions)
        && sameBusinessTeamPermissions(input.permissions, canonicalPermissions),
      );
    },
  }),
});

app.post('/api/auth/login', async (req, res) => {
  const googleIdToken = typeof req.body?.googleIdToken === 'string' ? req.body.googleIdToken : undefined;
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (googleIdToken) {
    const result = await identityAccess.authenticate({
      googleIdToken,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
    if (result.kind === 'rejected') {
      if (result.reason === 'google_failed') return res.status(401).json({ error: 'Token Google inválido.' });
      if (result.reason === 'deactivated') return res.status(403).json({ error: 'Esta conta foi desativada.', code: 'ACCOUNT_DEACTIVATED' });
      if (result.reason === 'suspended') return res.status(403).json({ error: 'O seu acesso está suspenso. Contacte o responsável da empresa.', code: 'ACCESS_SUSPENDED' });
      if (result.reason === 'disabled') return res.status(403).json({ error: 'O acesso desta conta foi revogado.', code: 'ACCESS_DISABLED' });
      if (result.reason === 'mfa_required') return res.status(401).json({ error: 'Código MFA obrigatório.', code: 'MFA_REQUIRED' });
      if (result.reason === 'mfa_invalid') return res.status(401).json({ error: 'Código MFA inválido ou já utilizado.', code: 'MFA_INVALID' });
      return res.status(401).json({ error: 'Falha na autenticação Google.' });
    }
    setSessionCookie(res, result.sessionToken);
    res.json({ success: true, user: result.user });
    return;
  }
  if (!email || password.length < 6) return res.status(400).json({ error: 'Indique um e-mail e uma palavra-passe válida.' });

  // Balde distribuído por conta: tentativas falhadas acumulam; um login
  // bem-sucedido limpa o balde dessa conta.
  if (!await consumeAccountRateLimit('login', email, LOGIN_RATE_LIMIT_WINDOW_MS, LOGIN_RATE_LIMIT_MAX_ATTEMPTS)) {
    return res.status(429).json({ error: 'Demasiadas tentativas de início de sessão. Tente novamente mais tarde.', code: 'LOGIN_RATE_LIMITED' });
  }

  const result = await identityAccess.authenticate({
    email,
    password,
    mfaCode: typeof req.body?.mfaCode === 'string' ? req.body.mfaCode : undefined,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  if (result.kind === 'rejected') {
    if (result.reason === 'deactivated') return res.status(403).json({ error: 'Esta conta está desativada. Contacte o suporte para reativá-la.' });
    if (result.reason === 'suspended') return res.status(403).json({ error: 'O seu acesso está suspenso. Contacte o responsável da empresa.', code: 'ACCESS_SUSPENDED' });
    if (result.reason === 'disabled') return res.status(403).json({ error: 'O acesso desta conta foi revogado.', code: 'ACCESS_DISABLED' });
    if (result.reason === 'mfa_required') return res.status(401).json({ error: 'Código MFA obrigatório.', code: 'MFA_REQUIRED' });
    if (result.reason === 'mfa_invalid') return res.status(401).json({ error: 'Código MFA inválido ou já utilizado.', code: 'MFA_INVALID' });
    return res.status(401).json({ error: 'E-mail ou palavra-passe incorretos.' });
  }
  // A limpeza do balde é otimização de segurança, não deve impedir um login
  // válido se a base de dados tiver um soluço momentâneo.
  await resetAccountRateLimit('login', email).catch((error) => {
    console.warn('login-rate-limit-reset-failed', error);
  });
  setSessionCookie(res, result.sessionToken);
  res.json({ success: true, user: result.user });
});

// Login com Google por redireccionamento (OAuth 2.0 authorization code).
// O router vive em server/googleOAuthRoutes.ts para poder ser testado sem levantar
// o servidor completo nem contactar a Google.
app.use('/api/auth/google', createGoogleOAuthRouter({
  authenticate: (input) => identityAccess.authenticate(input),
}));

app.post('/api/auth/mfa/setup', requireRole('admin'), async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : 'admin.teste@guigui.com';
  const setup = await identityAccess.beginMfaSetup(context.userId, email);
  res.json({ success: true, ...setup, warning: 'Guarde o segredo apenas para concluir a configuração. Nunca o publique.' });
});

app.post('/api/auth/mfa/enable', requireRole('admin'), async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  const code = typeof req.body?.code === 'string' ? req.body.code : '';
  if (!await identityAccess.enableMfa(context.userId, code)) return res.status(400).json({ error: 'Código MFA inválido.', code: 'MFA_INVALID' });
  recordAudit({ action: 'mfa_enabled', resource: 'user', resourceId: context.userId, actorRole: 'admin', requestId: requestIdFrom(req), success: true });
  res.json({ success: true });
});

app.post('/api/auth/logout', async (req, res) => {
  const token = sessionTokenFromRequest(req);
  const revoked = await identityAccess.logout(token);
  clearSessionCookie(res);
  res.json({ success: true, revoked });
});

app.post('/api/auth/sessions/revoke-all', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  const revoked = await identityAccess.revokeAllSessions(context.userId);
  clearSessionCookie(res);
  recordAudit({ action: 'sessions_revoked_all', resource: 'session', actorRole: context.role === 'user' ? 'citizen' : context.role, requestId: requestIdFrom(req), success: true, metadata: { revoked } });
  res.json({ success: true, revoked });
});

app.get('/api/auth/sessions', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  const sessions = await listUserSessions(context.userId, sessionTokenFromRequest(req));
  res.setHeader('Cache-Control', 'no-store');
  res.json({ sessions });
});

app.delete('/api/auth/sessions/:id', requireSession, async (req, res) => {
  const requestId = requestIdFrom(req);
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  const revoked = await revokeUserSessionById(context.userId, String(req.params.id || ''));
  if (!revoked) {
    return res.status(404).json({ error: 'Sessão não encontrada nesta conta.', code: 'SESSION_NOT_FOUND' });
  }
  recordAudit({ action: 'session_revoked', resource: 'session', resourceId: String(req.params.id), actorRole: context.role === 'user' ? 'citizen' : context.role, requestId, success: true });
  res.json({ success: true });
});

app.get('/api/security/events', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  if (!databasePool) {
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ events: [], source: 'Indisponível sem base de dados PostgreSQL.' });
  }
  // `limit` mantém compatibilidade com consumidores antigos (ex.: resumo em
  // Configurações); a paginação nova usa `pageSize`, com 20 por omissão.
  const pageSize = Math.min(Math.max(Number(req.query.pageSize) || Number(req.query.limit) || 20, 1), 100);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const offset = (page - 1) * pageSize;
  const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 120) : '';
  const searchPattern = search ? `%${search.replace(/[%_]/g, '\\$&')}%` : null;
  const [result, totalResult] = await Promise.all([
    databasePool.query(
      `SELECT id, action, resource, resource_id, result, reason, created_at
         FROM audit_logs
        WHERE actor_user_id = $1
          AND ($2::text IS NULL OR action ILIKE $2 OR resource ILIKE $2 OR resource_id ILIKE $2 OR reason ILIKE $2)
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4`,
      [context.userId, searchPattern, pageSize, offset],
    ),
    databasePool.query(
      `SELECT count(*)::int AS total
         FROM audit_logs
        WHERE actor_user_id = $1
          AND ($2::text IS NULL OR action ILIKE $2 OR resource ILIKE $2 OR resource_id ILIKE $2 OR reason ILIKE $2)`,
      [context.userId, searchPattern],
    ),
  ]);
  const total = Number(totalResult.rows[0]?.total ?? 0);
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    source: 'audit_logs',
    total,
    page,
    pageSize,
    totalPages: Math.max(Math.ceil(total / pageSize), 1),
    events: result.rows.map((row) => ({
      id: String(row.id),
      action: String(row.action),
      resource: row.resource ? String(row.resource) : null,
      resourceId: row.resource_id ? String(row.resource_id) : null,
      result: String(row.result || 'success'),
      reason: row.reason ? String(row.reason) : null,
      createdAt: new Date(row.created_at).toISOString(),
    })),
  });
});

app.get('/api/auth/session', async (req, res) => {
  const session = await identityAccess.getSession(sessionTokenFromRequest(req));
  if (!session || !session.role) {
    res.json({ authenticated: false });
    return;
  }
  // Devolve a mesma projecção do login para que um browser sem
  // `guigui_current_user` restaure a conta completa e o guia/painel certos.
  const account = await identityAccess.findById(session.userId) || findDemoUserById(session.userId);
  res.json({
    authenticated: true,
    userId: session.userId,
    role: session.role,
    expiresAt: session.expiresAt,
    ...(account ? { user: account } : {}),
  });
});

app.post('/api/business/team/invitations', requireRole('business'), async (req, res) => {
  const { recipientEmail, recipientName, businessId, businessName, role, permissions, roleLabel, token } = req.body || {};
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  // O convite é sempre da empresa da sessão; a validação de campos só corre
  // depois de confirmar que o businessId indicado lhe pertence (403, não 400).
  if (typeof businessId === 'string' && businessId.trim()) {
    const storedInviter = await identityAccess.findById(context.userId) || undefined;
    const invitationScope = resolveBusinessScope(context.role, storedInviter?.businessId, businessId);
    if (invitationScope.allowed === false) {
      return res.status(403).json({
        error: 'Não tem permissão para convidar membros para esta empresa.',
        code: 'BUSINESS_INVITATION_FORBIDDEN',
      });
    }
  }
  const invitationEmailCheck = normaliseEmailForAccount(recipientEmail);
  if (
    typeof recipientEmail !== 'string'
    || !invitationEmailCheck.ok
    || typeof recipientName !== 'string'
    || typeof businessName !== 'string'
    || typeof businessId !== 'string'
    || !['manager', 'editor', 'finance', 'support'].includes(role)
    || !isBusinessTeamPermissions(permissions)
    || typeof roleLabel !== 'string'
    || typeof token !== 'string'
    || token.trim().length < 32
  ) {
    return res.status(400).json({ error: 'Dados do convite inválidos.', code: 'INVALID_TEAM_INVITATION' });
  }
  try {
    const invitationResult = await identityAccess.createTeamInvitation({
      inviterUserId: context.userId,
      email: invitationEmailCheck.ok ? invitationEmailCheck.email : '',
      name: recipientName,
      businessId,
      businessName,
      role: role as BusinessTeamRole,
      permissions,
      token: token.trim(),
    });
    if (invitationResult.kind === 'forbidden') {
      return res.status(403).json({
        error: 'Não tem permissão para convidar membros para esta empresa.',
        code: 'BUSINESS_INVITATION_FORBIDDEN',
      });
    }
    const delivery = await emailDelivery.sendTeamInvitation({
      invitationId: randomUUID(),
      recipientEmail: recipientEmail.trim().toLowerCase(),
      recipientName: recipientName.trim(),
      businessName: businessName.trim(),
      roleLabel: roleLabel.trim(),
      invitationUrl: `${runtimeConfig.appUrl?.trim() || 'http://localhost:3000'}/?team_invite=${encodeURIComponent(token.trim())}`,
    });
    const accepted = delivery.state === 'accepted';
    return res.status(201).json({
      success: true,
      simulated: delivery.mode === 'simulated',
      delivery: { state: delivery.state, mode: delivery.mode, reference: delivery.reference },
      message: accepted
        ? 'Convite registado. O e-mail foi aceite pelo fornecedor de envio.'
        : 'Convite registado. O envio por e-mail está simulado e não foi realizado.',
    });
  } catch (error) {
    console.error('team-invitation-simulation-failed', {
      businessId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    return res.status(503).json({ error: 'Não foi possível registar o convite simulado.', code: 'TEAM_INVITATION_SIMULATION_FAILED' });
  }
});

app.get('/api/business/team/invitations/:token', async (req, res) => {
  const invitation = await identityAccess.inspectTeamInvitation(req.params.token);
  if (!invitation) return res.status(404).json({ error: 'Convite inválido, expirado ou já utilizado.', code: 'INVALID_TEAM_INVITATION' });
  res.json({ invitation });
});

app.post('/api/business/team/invitations/accept', async (req, res) => {
  const { token, password, phone, neighborhood } = req.body || {};
  if (typeof token !== 'string' || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'O convite e uma palavra-passe com pelo menos 6 caracteres são obrigatórios.', code: 'INVALID_TEAM_ACCEPTANCE' });
  }
  const result = await identityAccess.acceptTeamInvitation({
    token,
    password,
    phone: typeof phone === 'string' ? phone : '',
    neighborhood: typeof neighborhood === 'string' ? neighborhood : 'Bissau',
  });
  if (result.kind === 'unavailable') {
    return res.status(409).json({ error: 'Convite inválido, expirado, já utilizado ou e-mail já registado.', code: 'TEAM_INVITATION_UNAVAILABLE' });
  }
  if (result.kind === 'association_failed') {
    return res.status(409).json({ error: 'Não foi possível associar a conta à equipa empresarial.', code: 'TEAM_INVITATION_ASSOCIATION_FAILED' });
  }
  res.status(201).json({ success: true, user: result.user });
});

// ---------------------------------------------------------------------------
// Equipa da empresa: contas individuais com acesso por módulos e acções.
// ---------------------------------------------------------------------------

async function teamScopeFor(req: Parameters<typeof sessionContext>[0]): Promise<{
  context: Awaited<ReturnType<typeof sessionContext>>;
  userId: string;
  businessId: string;
  canManage: boolean;
} | null> {
  const context = await sessionContext(req);
  if (!context || context.role !== 'business') return null;
  const stored = await identityAccess.findById(context.userId);
  const businessId = stored?.businessId || '';
  if (!businessId) return null;
  const effective = await effectiveBusinessAccess(context.userId);
  const canManage = effective.access === null || canPerformAction(effective.access, 'team', 'manage');
  return { context, userId: context.userId, businessId, canManage };
}

app.get('/api/business/team/members', requireRole('business'), async (req, res) => {
  const scope = await teamScopeFor(req);
  if (!scope) return res.status(403).json({ error: 'A conta não está associada a uma empresa.', code: 'BUSINESS_ACCOUNT_REQUIRED' });
  if (!databaseConfigured) return res.status(503).json({ error: 'A gestão de equipas exige a base de dados PostgreSQL.', code: 'TEAM_ACCESS_REQUIRES_DATABASE' });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ members: await listCompanyMembers(scope.businessId) });
});

app.post('/api/business/team/members', requireRole('business'), async (req, res) => {
  const requestId = requestIdFrom(req);
  const scope = await teamScopeFor(req);
  if (!scope) return res.status(403).json({ error: 'A conta não está associada a uma empresa.', code: 'BUSINESS_ACCOUNT_REQUIRED' });
  if (!scope.canManage) return res.status(403).json({ error: 'Não tem permissão para gerir a equipa.', code: 'TEAM_MANAGE_FORBIDDEN' });
  const body = req.body || {};
  const result = await createCompanyMember({
    companyId: scope.businessId,
    name: typeof body.name === 'string' ? body.name : '',
    email: typeof body.email === 'string' ? body.email : '',
    password: typeof body.password === 'string' ? body.password : '',
    phone: typeof body.phone === 'string' ? body.phone : '',
    jobTitle: typeof body.jobTitle === 'string' ? body.jobTitle : '',
    role: typeof body.role === 'string' ? body.role : 'custom',
    access: body.access ?? body.modules ?? {},
    status: body.status === 'pending' ? 'pending' : 'active',
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'TEAM_ACCESS_REQUIRES_DATABASE') return null;
    console.error('[team] Falha ao criar colaborador:', message);
    return { kind: 'invalid' as const, reason: 'Não foi possível criar a conta do colaborador. Verifique os dados e tente novamente.' };
  });
  if (!result) return res.status(503).json({ error: 'A gestão de equipas exige a base de dados PostgreSQL.', code: 'TEAM_ACCESS_REQUIRES_DATABASE' });
  if (result.kind === 'duplicate') return res.status(409).json({ error: 'Já existe uma conta com este e-mail.', code: 'TEAM_MEMBER_DUPLICATE' });
  if (result.kind === 'invalid') return res.status(400).json({ error: result.reason, code: 'TEAM_MEMBER_INVALID' });
  await recordAccessChange({ scope: 'business', companyId: scope.businessId, actorUserId: scope.userId, targetUserId: result.member.userId, action: 'member_created', after: { role: result.member.role, access: result.member.access, jobTitle: result.member.jobTitle } });
  recordAudit({ action: 'team_member_created', resource: 'company_member', resourceId: result.member.userId, actorRole: 'business', actorId: scope.userId, success: true, requestId, metadata: { modules: Object.keys(result.member.access) } });
  res.status(201).json({ member: result.member });
});

app.patch('/api/business/team/members/:userId', requireRole('business'), async (req, res) => {
  const requestId = requestIdFrom(req);
  const scope = await teamScopeFor(req);
  if (!scope) return res.status(403).json({ error: 'A conta não está associada a uma empresa.', code: 'BUSINESS_ACCOUNT_REQUIRED' });
  if (!scope.canManage) return res.status(403).json({ error: 'Não tem permissão para gerir a equipa.', code: 'TEAM_MANAGE_FORBIDDEN' });
  const userId = String(req.params.userId || '');
  const target = await findCompanyMember(scope.businessId, userId).catch(() => null);
  if (!target) return res.status(404).json({ error: 'Colaborador não encontrado nesta empresa.', code: 'TEAM_MEMBER_NOT_FOUND' });
  const targetUser = await identityAccess.findById(userId);
  if (!targetUser?.teamRole && !targetUser?.teamAccess && !targetUser?.teamPermissions) {
    return res.status(403).json({ error: 'A conta titular da empresa não pode ser alterada por esta via.', code: 'OWNER_PROTECTED' });
  }
  const body = req.body || {};
  const updated = await updateCompanyMember({
    companyId: scope.businessId,
    userId,
    role: typeof body.role === 'string' ? body.role : undefined,
    access: body.access !== undefined ? body.access : undefined,
    jobTitle: typeof body.jobTitle === 'string' ? body.jobTitle : undefined,
    status: ['active', 'pending', 'suspended', 'disabled'].includes(String(body.status)) ? body.status : undefined,
    password: typeof body.password === 'string' && body.password.length >= 8 ? body.password : undefined,
  }).catch((error: unknown) => {
    console.error('[team] Falha ao actualizar colaborador:', error instanceof Error ? error.message : String(error));
    return null;
  });
  if (!updated) return res.status(404).json({ error: 'Colaborador não encontrado nesta empresa.' });
  if (updated.status === 'suspended' || updated.status === 'disabled') {
    await identityAccess.revokeAllSessions(userId);
  }
  await recordAccessChange({ scope: 'business', companyId: scope.businessId, actorUserId: scope.userId, targetUserId: userId, action: 'member_updated', before: { status: target.status, role: target.role, access: target.access }, after: { status: updated.status, role: updated.role, access: updated.access } });
  recordAudit({ action: 'team_member_updated', resource: 'company_member', resourceId: userId, actorRole: 'business', actorId: scope.userId, success: true, requestId, metadata: { status: updated.status, modules: Object.keys(updated.access) } });
  res.json({ member: updated });
});

app.delete('/api/business/team/members/:userId', requireRole('business'), async (req, res) => {
  const requestId = requestIdFrom(req);
  const scope = await teamScopeFor(req);
  if (!scope) return res.status(403).json({ error: 'A conta não está associada a uma empresa.', code: 'BUSINESS_ACCOUNT_REQUIRED' });
  if (!scope.canManage) return res.status(403).json({ error: 'Não tem permissão para gerir a equipa.', code: 'TEAM_MANAGE_FORBIDDEN' });
  const userId = String(req.params.userId || '');
  if (userId === scope.userId) return res.status(400).json({ error: 'Não pode remover a sua própria conta.', code: 'SELF_REMOVAL_FORBIDDEN' });
  const targetUser = await identityAccess.findById(userId);
  if (!targetUser?.teamRole && !targetUser?.teamAccess && !targetUser?.teamPermissions) {
    return res.status(403).json({ error: 'A conta titular da empresa não pode ser removida.', code: 'OWNER_PROTECTED' });
  }
  const removed = await removeCompanyMember(scope.businessId, userId);
  if (!removed) return res.status(404).json({ error: 'Colaborador não encontrado nesta empresa.' });
  await identityAccess.revokeAllSessions(userId);
  await recordAccessChange({ scope: 'business', companyId: scope.businessId, actorUserId: scope.userId, targetUserId: userId, action: 'member_removed' });
  recordAudit({ action: 'team_member_removed', resource: 'company_member', resourceId: userId, actorRole: 'business', actorId: scope.userId, success: true, requestId });
  res.json({ success: true });
});

app.get('/api/business/team/activity', requireRole('business'), async (req, res) => {
  const scope = await teamScopeFor(req);
  if (!scope) return res.status(403).json({ error: 'A conta não está associada a uma empresa.', code: 'BUSINESS_ACCOUNT_REQUIRED' });
  if (!databaseConfigured) return res.json({ entries: [] });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ entries: await listAccessActivity(scope.businessId, Number(req.query.limit) || 50) });
});

/** Acesso efectivo da conta autenticada (empresa ou administração). */
app.get('/api/me/access', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.' });
  const stored = await identityAccess.findById(context.userId);
  res.setHeader('Cache-Control', 'no-store');
  if (context.role === 'business') {
    const effective = await effectiveBusinessAccess(context.userId);
    return res.json({
      scope: 'business',
      businessId: stored?.businessId || null,
      status: effective.status || 'active',
      fullAccess: effective.access === null,
      access: effective.access,
      jobTitle: stored?.jobTitle || null,
    });
  }
  if (context.role === 'admin') {
    const access = await effectiveAdminAccess(context.userId);
    return res.json({ scope: 'admin', fullAccess: access === null, status: stored?.accessStatus || 'active', access, jobTitle: stored?.jobTitle || null });
  }
  res.json({ scope: 'user', fullAccess: false, access: {}, status: 'active' });
});

// ---------------------------------------------------------------------------
// Equipa administrativa (contas reais, com acesso por módulos).
// ---------------------------------------------------------------------------

async function adminCanManageTeam(req: Parameters<typeof sessionContext>[0]): Promise<boolean> {
  const context = await sessionContext(req);
  if (!context || context.role !== 'admin') return false;
  const access = await effectiveAdminAccess(context.userId);
  return access === null || canPerformAction(access, 'admin_staff', 'manage') || canPerformAction(access, 'admin_staff', 'create');
}

app.get('/api/admin/team/activity', requireRole('admin'), async (req, res) => {
  if (!await adminCanManageTeam(req)) return res.status(403).json({ error: 'Não tem permissão para consultar a equipa administrativa.', code: 'TEAM_MANAGE_FORBIDDEN' });
  if (!databaseConfigured) return res.json({ entries: [] });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ entries: await listAdminAccessActivity(Number(req.query.limit) || 50) });
});

app.get('/api/admin/team/members', requireRole('admin'), async (_req, res) => {
  if (!databaseConfigured) return res.status(503).json({ error: 'A gestão da equipa exige a base de dados PostgreSQL.', code: 'TEAM_ACCESS_REQUIRES_DATABASE' });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ members: await listAdminStaff() });
});

app.post('/api/admin/team/members', requireRole('admin'), async (req, res) => {
  const requestId = requestIdFrom(req);
  if (!await adminCanManageTeam(req)) return res.status(403).json({ error: 'Não tem permissão para gerir a equipa administrativa.', code: 'TEAM_MANAGE_FORBIDDEN' });
  const context = await sessionContext(req);
  const body = req.body || {};
  const result = await createAdminStaff({
    name: typeof body.name === 'string' ? body.name : '',
    email: typeof body.email === 'string' ? body.email : '',
    password: typeof body.password === 'string' ? body.password : '',
    phone: typeof body.phone === 'string' ? body.phone : '',
    jobTitle: typeof body.jobTitle === 'string' ? body.jobTitle : '',
    preset: typeof body.preset === 'string' ? body.preset : 'staff',
    access: body.access ?? {},
  }).catch((error: unknown) => {
    if (error instanceof Error && error.message === 'TEAM_ACCESS_REQUIRES_DATABASE') return null;
    throw error;
  });
  if (!result) return res.status(503).json({ error: 'A gestão da equipa exige a base de dados PostgreSQL.', code: 'TEAM_ACCESS_REQUIRES_DATABASE' });
  if (result.kind === 'duplicate') return res.status(409).json({ error: 'Já existe uma conta com este e-mail.', code: 'TEAM_MEMBER_DUPLICATE' });
  if (result.kind === 'invalid') return res.status(400).json({ error: result.reason, code: 'TEAM_MEMBER_INVALID' });
  await recordAccessChange({ scope: 'admin', actorUserId: context?.userId || '', targetUserId: result.member.userId, action: 'admin_member_created', after: { access: result.member.access } });
  recordAudit({ action: 'admin_team_member_created', resource: 'admin_member', resourceId: result.member.userId, actorRole: 'admin', actorId: context?.userId, success: true, requestId });
  res.status(201).json({ member: result.staff || result.member });
});

app.patch('/api/admin/team/members/:userId', requireRole('admin'), async (req, res) => {
  const requestId = requestIdFrom(req);
  if (!await adminCanManageTeam(req)) return res.status(403).json({ error: 'Não tem permissão para gerir a equipa administrativa.', code: 'TEAM_MANAGE_FORBIDDEN' });
  const context = await sessionContext(req);
  const userId = String(req.params.userId || '');
  const targetUser = await identityAccess.findById(userId);
  if (!targetUser || targetUser.role !== 'admin') return res.status(404).json({ error: 'Membro da equipa não encontrado.', code: 'TEAM_MEMBER_NOT_FOUND' });
  if (!targetUser.adminAccess) return res.status(403).json({ error: 'A conta do administrador principal não pode ser alterada por esta via.', code: 'OWNER_PROTECTED' });
  const body = req.body || {};
  const updated = await updateAdminStaff({
    userId,
    access: body.access !== undefined ? body.access : undefined,
    preset: typeof body.preset === 'string' ? body.preset : undefined,
    jobTitle: typeof body.jobTitle === 'string' ? body.jobTitle : undefined,
    status: ['active', 'suspended', 'disabled'].includes(String(body.status)) ? body.status : undefined,
    password: typeof body.password === 'string' && body.password.length >= 8 ? body.password : undefined,
  });
  if (!updated) return res.status(404).json({ error: 'Membro da equipa não encontrado.' });
  if (updated.status === 'suspended' || updated.status === 'disabled') await identityAccess.revokeAllSessions(userId);
  await recordAccessChange({ scope: 'admin', actorUserId: context?.userId || '', targetUserId: userId, action: 'admin_member_updated', after: { access: updated.access, status: updated.status } });
  recordAudit({ action: 'admin_team_member_updated', resource: 'admin_member', resourceId: userId, actorRole: 'admin', actorId: context?.userId, success: true, requestId });
  res.json({ member: updated });
});

app.delete('/api/admin/team/members/:userId', requireRole('admin'), async (req, res) => {
  const requestId = requestIdFrom(req);
  if (!await adminCanManageTeam(req)) return res.status(403).json({ error: 'Não tem permissão para gerir a equipa administrativa.', code: 'TEAM_MANAGE_FORBIDDEN' });
  const context = await sessionContext(req);
  const userId = String(req.params.userId || '');
  if (userId === context?.userId) return res.status(400).json({ error: 'Não pode remover a sua própria conta.', code: 'SELF_REMOVAL_FORBIDDEN' });
  const targetUser = await identityAccess.findById(userId);
  if (!targetUser || targetUser.role !== 'admin') return res.status(404).json({ error: 'Membro da equipa não encontrado.' });
  if (!targetUser.adminAccess) return res.status(403).json({ error: 'A conta do administrador principal não pode ser removida.', code: 'OWNER_PROTECTED' });
  const removed = await removeAdminStaff(userId);
  if (!removed) return res.status(404).json({ error: 'Membro da equipa não encontrado.' });
  await identityAccess.revokeAllSessions(userId);
  await recordAccessChange({ scope: 'admin', actorUserId: context?.userId || '', targetUserId: userId, action: 'admin_member_removed' });
  recordAudit({ action: 'admin_team_member_removed', resource: 'admin_member', resourceId: userId, actorRole: 'admin', actorId: context?.userId, success: true, requestId });
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Convites de colaboradores (Administração e Empresas)
// ---------------------------------------------------------------------------
//
// O responsável cria o convite com os módulos já escolhidos; o colaborador
// recebe um link individual e define a própria palavra-passe. Nenhum módulo é
// aceite a partir do cliente na ativação: só os gravados no convite contam.

async function invitationScopeFor(req: Parameters<typeof sessionContext>[0]): Promise<{
  context: NonNullable<Awaited<ReturnType<typeof sessionContext>>>;
  scope: 'admin' | 'business';
  companyId: string | null;
  canManage: boolean;
} | null> {
  const context = await sessionContext(req);
  if (!context) return null;
  if (context.role === 'admin') {
    const access = await effectiveAdminAccess(context.userId);
    const canManage = access === null
      || canPerformAction(access, 'admin_staff', 'manage')
      || canPerformAction(access, 'admin_staff', 'create');
    return { context, scope: 'admin', companyId: null, canManage };
  }
  if (context.role === 'business') {
    const stored = await identityAccess.findById(context.userId);
    const businessId = stored?.businessId || '';
    if (!businessId) return null;
    const effective = await effectiveBusinessAccess(context.userId);
    const canManage = effective.access === null
      || canPerformAction(effective.access, 'team', 'manage')
      || canPerformAction(effective.access, 'team', 'create');
    return { context, scope: 'business', companyId: businessId, canManage };
  }
  return null;
}

function invitationActivationUrl(token: string): string {
  const base = (runtimeConfig.appUrl?.trim() || 'http://localhost:3000').replace(/\/$/, '');
  return `${base}/ativar-convite?token=${encodeURIComponent(token)}`;
}

async function companyNameFor(companyId: string): Promise<string> {
  if (!databasePool) return 'Guigui.com';
  const result = await databasePool.query('SELECT name FROM companies WHERE id = $1 LIMIT 1', [companyId]);
  return result.rowCount ? String(result.rows[0].name) : 'Guigui.com';
}

async function deliverInvitationEmail(input: {
  token: string;
  scope: 'admin' | 'business';
  invitation: { id: string; email: string; name: string; jobTitle?: string; role: string; access: TeamModuleAccess };
  companyId: string | null;
}): Promise<{ mode: 'sent' | 'simulated'; activationUrl: string }> {
  const activationUrl = invitationActivationUrl(input.token);
  const organizationName = input.scope === 'admin'
    ? 'Administração Guigui.com'
    : await companyNameFor(input.companyId || '');
  try {
    const delivery = await emailDelivery.sendTeamInvitation({
      invitationId: input.invitation.id,
      recipientEmail: input.invitation.email,
      recipientName: input.invitation.name,
      businessName: organizationName,
      organizationName,
      roleLabel: invitationRoleLabel(input.invitation.jobTitle, input.invitation.role),
      modules: invitationModuleSummary(input.scope, input.invitation.access).map((module) => module.label),
      invitationUrl: activationUrl,
      isAdminScope: input.scope === 'admin',
    });
    if (delivery.state === 'accepted') {
      await markInvitationSent(input.invitation.id);
      return { mode: 'sent', activationUrl };
    }
    if (delivery.state !== 'simulated') {
      console.error('[team-invitation] Entrega de e-mail não confirmada:', delivery.state);
    }
    return { mode: 'simulated', activationUrl };
  } catch (error) {
    console.error('[team-invitation] Falha no envio do e-mail:', error instanceof Error ? error.message : String(error));
    return { mode: 'simulated', activationUrl };
  }
}

app.get('/api/team/invitations', async (req, res) => {
  const scope = await invitationScopeFor(req);
  if (!scope) return res.status(403).json({ error: 'A conta não tem acesso à gestão de colaboradores.', code: 'TEAM_SCOPE_REQUIRED' });
  if (!scope.canManage) return res.status(403).json({ error: 'Não tem permissão para gerir convites.', code: 'TEAM_MANAGE_FORBIDDEN' });
  if (!databaseConfigured) return res.status(503).json({ error: 'A gestão de convites exige a base de dados PostgreSQL.', code: 'TEAM_ACCESS_REQUIRES_DATABASE' });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ invitations: await listTeamInvitations(scope.scope, scope.companyId) });
});

app.post('/api/team/invitations', async (req, res) => {
  const requestId = requestIdFrom(req);
  const scope = await invitationScopeFor(req);
  if (!scope) return res.status(403).json({ error: 'A conta não tem acesso à gestão de colaboradores.', code: 'TEAM_SCOPE_REQUIRED' });
  if (!scope.canManage) return res.status(403).json({ error: 'Não tem permissão para convidar colaboradores.', code: 'TEAM_MANAGE_FORBIDDEN' });
  if (!databaseConfigured) return res.status(503).json({ error: 'A gestão de convites exige a base de dados PostgreSQL.', code: 'TEAM_ACCESS_REQUIRES_DATABASE' });
  const body = req.body || {};
  const result = await createTeamInvitationRecord({
    scope: scope.scope,
    companyId: scope.companyId,
    name: typeof body.name === 'string' ? body.name : '',
    email: typeof body.email === 'string' ? body.email : '',
    jobTitle: typeof body.jobTitle === 'string' ? body.jobTitle : undefined,
    role: typeof body.role === 'string' ? body.role : 'custom',
    access: body.access ?? {},
    invitedByUserId: scope.context.userId,
  }).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'TEAM_ACCESS_REQUIRES_DATABASE') return null;
    console.error('[team-invitation] Falha ao criar convite:', message);
    return null;
  });
  if (!result) return res.status(500).json({ error: 'Não foi possível criar o convite.', code: 'TEAM_INVITATION_FAILED' });
  if (result.kind === 'invalid') return res.status(400).json({ error: result.reason, code: 'TEAM_INVITATION_INVALID' });
  if (result.kind === 'account_exists') {
    return res.status(409).json({
      error: 'Já existe uma conta com este e-mail. Associe-a pela gestão de equipa em vez de criar um novo convite.',
      code: 'TEAM_MEMBER_DUPLICATE',
    });
  }
  const delivery = await deliverInvitationEmail({ token: result.token, scope: scope.scope, invitation: result.invitation, companyId: scope.companyId });
  await recordAccessChange({
    scope: scope.scope,
    companyId: scope.companyId || undefined,
    actorUserId: scope.context.userId,
    targetUserId: '',
    action: result.renewed ? 'invitation_renewed' : 'invitation_created',
    after: { email: result.invitation.email, role: result.invitation.role, modules: Object.keys(result.invitation.access) },
  });
  recordAudit({
    action: 'team_invitation_created',
    resource: 'team_invitation',
    resourceId: result.invitation.id,
    actorRole: scope.scope === 'admin' ? 'admin' : 'business',
    actorId: scope.context.userId,
    success: true,
    requestId,
    metadata: { scope: scope.scope, modules: Object.keys(result.invitation.access), delivery: delivery.mode },
  });
  res.status(201).json({ invitation: result.invitation, delivery });
});

app.post('/api/team/invitations/:id/resend', async (req, res) => {
  const requestId = requestIdFrom(req);
  const scope = await invitationScopeFor(req);
  if (!scope) return res.status(403).json({ error: 'A conta não tem acesso à gestão de colaboradores.', code: 'TEAM_SCOPE_REQUIRED' });
  if (!scope.canManage) return res.status(403).json({ error: 'Não tem permissão para gerir convites.', code: 'TEAM_MANAGE_FORBIDDEN' });
  const resent = await resendTeamInvitation(String(req.params.id || ''), scope.scope, scope.companyId);
  if (!resent) return res.status(404).json({ error: 'Convite não encontrado ou já utilizado.', code: 'TEAM_INVITATION_NOT_FOUND' });
  const delivery = await deliverInvitationEmail({ token: resent.token, scope: scope.scope, invitation: resent.invitation, companyId: scope.companyId });
  await recordAccessChange({
    scope: scope.scope,
    companyId: scope.companyId || undefined,
    actorUserId: scope.context.userId,
    targetUserId: '',
    action: 'invitation_resent',
    after: { email: resent.invitation.email },
  });
  recordAudit({ action: 'team_invitation_resent', resource: 'team_invitation', resourceId: resent.invitation.id, actorRole: scope.scope === 'admin' ? 'admin' : 'business', actorId: scope.context.userId, success: true, requestId });
  res.json({ invitation: resent.invitation, delivery });
});

app.delete('/api/team/invitations/:id', async (req, res) => {
  const requestId = requestIdFrom(req);
  const scope = await invitationScopeFor(req);
  if (!scope) return res.status(403).json({ error: 'A conta não tem acesso à gestão de colaboradores.', code: 'TEAM_SCOPE_REQUIRED' });
  if (!scope.canManage) return res.status(403).json({ error: 'Não tem permissão para gerir convites.', code: 'TEAM_MANAGE_FORBIDDEN' });
  const revoked = await revokeTeamInvitation(String(req.params.id || ''), scope.scope, scope.companyId);
  if (!revoked) return res.status(404).json({ error: 'Convite não encontrado ou já fechado.', code: 'TEAM_INVITATION_NOT_FOUND' });
  await recordAccessChange({
    scope: scope.scope,
    companyId: scope.companyId || undefined,
    actorUserId: scope.context.userId,
    targetUserId: '',
    action: 'invitation_revoked',
  });
  recordAudit({ action: 'team_invitation_revoked', resource: 'team_invitation', resourceId: String(req.params.id || ''), actorRole: scope.scope === 'admin' ? 'admin' : 'business', actorId: scope.context.userId, success: true, requestId });
  res.json({ success: true });
});

app.get('/api/team/invitations/token/:token', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const invitation = await inspectTeamInvitation(String(req.params.token || '')).catch(() => null);
  if (!invitation) return res.status(404).json({ error: 'Convite inválido, expirado ou já utilizado.', code: 'INVALID_TEAM_INVITATION' });
  res.json({ invitation });
});

app.post('/api/team/invitations/token/:token/accept', async (req, res) => {
  const requestId = requestIdFrom(req);
  const body = req.body || {};
  const password = typeof body.password === 'string' ? body.password : '';
  if (password.length < 8) {
    return res.status(400).json({ error: 'A palavra-passe precisa de pelo menos 8 caracteres.', code: 'INVALID_TEAM_ACCEPTANCE' });
  }
  const result = await acceptTeamInvitation({
    token: String(req.params.token || ''),
    password,
    phone: typeof body.phone === 'string' ? body.phone : '',
    neighborhood: typeof body.neighborhood === 'string' ? body.neighborhood : 'Bissau',
  }).catch((error: unknown) => {
    console.error('[team-invitation] Falha na ativação:', error instanceof Error ? error.message : String(error));
    return { kind: 'unavailable' as const };
  });
  if (result.kind === 'invalid') return res.status(400).json({ error: result.reason, code: 'INVALID_TEAM_ACCEPTANCE' });
  if (result.kind === 'account_exists') {
    return res.status(409).json({
      error: 'Já existe uma conta com este e-mail. Inicie sessão ou recupere a palavra-passe.',
      code: 'TEAM_ACCOUNT_EXISTS',
    });
  }
  if (result.kind === 'unavailable') {
    return res.status(410).json({ error: 'Este convite já não está disponível. Peça um novo convite ao responsável.', code: 'TEAM_INVITATION_UNAVAILABLE' });
  }
  await recordAccessChange({
    scope: result.scope,
    companyId: result.companyId || undefined,
    actorUserId: result.userId,
    targetUserId: result.userId,
    action: 'invitation_accepted',
    after: { email: result.email },
  });
  recordAudit({ action: 'team_invitation_accepted', resource: 'team_invitation', resourceId: result.userId, actorRole: result.scope === 'admin' ? 'admin' : 'business', actorId: result.userId, success: true, requestId });
  res.json({ success: true, user: { id: result.userId, email: result.email, name: result.name, scope: result.scope } });
});

// Alteração da própria palavra-passe. A conta vem sempre da sessão — o e-mail
// no corpo, quando enviado, só serve para recusar tentativas de mudar
// credenciais de outra pessoa. Serve cidadão, empresa e administração.
app.post('/api/auth/change-password', requireSession, async (req, res) => {
  const requestId = requestIdFrom(req);
  const context = await sessionContext(req);
  if (!context) {
    return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  }
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  const account = await identityAccess.findById(context.userId) || findDemoUserById(context.userId);
  const accountEmail = account?.email ? String(account.email) : '';
  if (!accountEmail) {
    return res.status(404).json({ error: 'Conta não encontrada para alterar a palavra-passe.', code: 'ACCOUNT_NOT_FOUND' });
  }
  const requestedEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (requestedEmail && requestedEmail !== accountEmail.toLowerCase()) {
    return res.status(403).json({
      error: 'A palavra-passe só pode ser alterada na conta autenticada.',
      code: 'ACCOUNT_IDENTITY_MISMATCH',
    });
  }
  if (!currentPassword) {
    return res.status(400).json({ error: 'Confirme a palavra-passe atual.', code: 'CURRENT_PASSWORD_REQUIRED' });
  }
  const policy = evaluatePassword({
    password: newPassword,
    currentPassword,
    email: accountEmail,
    name: account?.name,
  });
  if (!policy.ok) {
    return res.status(400).json({
      error: policy.issues[0] || 'A nova palavra-passe não cumpre os requisitos de segurança.',
      issues: policy.issues,
      code: 'PASSWORD_POLICY',
    });
  }

  const updated = await identityAccess.changePassword({ email: accountEmail, currentPassword, newPassword });
  recordAudit({
    action: 'password_changed',
    resource: 'auth',
    resourceId: accountEmail,
    actorId: context.userId,
    actorRole: context.role === 'user' ? 'citizen' : context.role,
    success: updated,
    requestId,
    metadata: { strength: policy.label },
  });
  if (!updated) {
    return res.status(401).json({ error: 'A palavra-passe atual não corresponde à conta.', code: 'INVALID_CURRENT_PASSWORD' });
  }
  res.json({ success: true, message: 'Palavra-passe atualizada com sucesso.' });
});

app.patch('/api/account/profile', requireSession, async (req, res) => {
  if (!databasePool) {
    return res.status(503).json({ error: 'A base de dados PostgreSQL é necessária.', code: 'DATABASE_REQUIRED' });
  }
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const phone = typeof req.body?.phone === 'string' ? req.body.phone.trim() : '';
  const neighborhood = typeof req.body?.neighborhood === 'string' ? req.body.neighborhood.trim() : '';
  const avatarUrl = typeof req.body?.avatarUrl === 'string' ? req.body.avatarUrl.trim() : '';
  if (name.length < 2 || name.length > 120) {
    return res.status(400).json({ error: 'O nome deve ter entre 2 e 120 caracteres.', code: 'USER_NAME_INVALID' });
  }
  if (!neighborhood) {
    return res.status(400).json({ error: 'A localização é obrigatória.', code: 'USER_LOCATION_REQUIRED' });
  }
  if (avatarUrl && !/^https?:\/\//i.test(avatarUrl) && !/^data:image\/(png|jpeg|webp|gif);base64,/i.test(avatarUrl)) {
    return res.status(400).json({ error: 'A fotografia deve ser uma imagem válida.', code: 'USER_AVATAR_INVALID' });
  }
  if (avatarUrl.length > 2_000_000) {
    return res.status(413).json({ error: 'A fotografia é demasiado grande.', code: 'USER_AVATAR_TOO_LARGE' });
  }
  await databasePool.query(
    `UPDATE users SET name=$1, phone=$2, neighborhood=$3, avatar_url=$4, updated_at=NOW() WHERE id=$5`,
    [name, phone, neighborhood, avatarUrl || null, context.userId],
  );
  const updated = await identityAccess.findById(context.userId);
  if (!updated) return res.status(404).json({ error: 'Conta não encontrada.', code: 'USER_NOT_FOUND' });
  res.json({ success: true, user: updated });
});

// Guia de boas-vindas: o estado vive na conta (e não só no browser) para o guia
// abrir uma única vez por utilizador, mesmo que inicie sessão noutro dispositivo.
const ONBOARDING_AUDIENCES: readonly string[] = ['citizen', 'business', 'team', 'admin'];
const ONBOARDING_STATUSES: readonly string[] = ['in_progress', 'completed', 'skipped'];

app.get('/api/account/onboarding', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  // Sem PostgreSQL o cliente continua a usar o estado local do browser.
  if (!databasePool) return res.json({ onboarding: {} });
  const result = await databasePool.query('SELECT onboarding_state FROM users WHERE id=$1', [context.userId]);
  res.json({ onboarding: result.rows[0]?.onboarding_state ?? {} });
});

app.put('/api/account/onboarding', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  const audience = typeof req.body?.audience === 'string' ? req.body.audience : '';
  const status = typeof req.body?.status === 'string' ? req.body.status : '';
  if (!ONBOARDING_AUDIENCES.includes(audience) || !ONBOARDING_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Estado do guia inválido.', code: 'INVALID_ONBOARDING_STATE' });
  }
  if (!databasePool) {
    return res.status(503).json({ error: 'A base de dados PostgreSQL é necessária.', code: 'DATABASE_REQUIRED' });
  }
  const step = Number.isInteger(req.body?.step) ? Math.max(0, Math.min(50, Number(req.body.step))) : 0;
  const result = await databasePool.query(
    `UPDATE users
        SET onboarding_state = COALESCE(onboarding_state, '{}'::jsonb) || jsonb_build_object(
              $2::text,
              jsonb_build_object('status', $3::text, 'step', $4::int, 'updatedAt', now()::text)
            ),
            updated_at = NOW()
      WHERE id = $1
      RETURNING onboarding_state`,
    [context.userId, audience, status, step],
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'Conta não encontrada.', code: 'USER_NOT_FOUND' });
  res.json({ success: true, onboarding: result.rows[0]?.onboarding_state ?? {} });
});

app.post('/api/account/deactivate', requireSession, async (req, res) => {
  const requestId = requestIdFrom(req);
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  if (!currentPassword) return res.status(400).json({ error: 'Confirme a palavra-passe atual.' });
  const result = await identityAccess.deactivateAccount({
    userId: context.userId,
    currentPassword,
    email: typeof req.body?.email === 'string' ? req.body.email : undefined,
    actorRole: context.role,
    requestId,
  }, (event) => { recordAudit({ ...event, requestId }); });
  if (result.kind === 'account_not_found') return res.status(404).json({ error: 'Conta não encontrada no backend.' });
  if (result.kind === 'identity_mismatch') return res.status(403).json({ error: 'A operação deve ser executada na conta autenticada.', code: 'ACCOUNT_IDENTITY_MISMATCH' });
  if (result.kind === 'invalid_password') return res.status(401).json({ error: 'A palavra-passe atual não corresponde à conta.' });
  if (result.kind === 'operation_failed') return res.status(404).json({ error: 'Não foi possível desativar a conta.' });
  clearSessionCookie(res);
  res.json({ success: true, message: 'Conta desativada temporariamente.' });
});

app.post('/api/account/delete', requireSession, async (req, res) => {
  const requestId = requestIdFrom(req);
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  if (!currentPassword) return res.status(400).json({ error: 'Confirme a palavra-passe atual.' });
  const result = await identityAccess.deleteAccount({
    userId: context.userId,
    currentPassword,
    email: typeof req.body?.email === 'string' ? req.body.email : undefined,
    actorRole: context.role,
    requestId,
  }, (event) => { recordAudit({ ...event, requestId }); });
  if (result.kind === 'account_not_found') return res.status(404).json({ error: 'Conta não encontrada no backend.' });
  if (result.kind === 'identity_mismatch') return res.status(403).json({ error: 'A operação deve ser executada na conta autenticada.', code: 'ACCOUNT_IDENTITY_MISMATCH' });
  if (result.kind === 'invalid_password') return res.status(401).json({ error: 'A palavra-passe atual não corresponde à conta.' });
  if (result.kind === 'operation_failed') return res.status(404).json({ error: 'Não foi possível eliminar a conta.' });
  clearSessionCookie(res);
  res.json({ success: true, message: 'Conta eliminada permanentemente.' });
});

app.post('/api/auth/request-password-reset', async (req, res) => {
  const requestId = requestIdFrom(req);
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Indique um e-mail válido.' });
  // Limite por conta/e-mail antes de gerar token ou enviar email: evita
  // bombardeamento de caixas e enumeração por tentativa repetida.
  if (!await consumeAccountRateLimit('password-reset', email, PASSWORD_RESET_RATE_LIMIT_WINDOW_MS, PASSWORD_RESET_MAX_ATTEMPTS)) {
    return res.status(429).json({
      success: false,
      error: 'Demasiados pedidos de recuperação. Tente novamente mais tarde.',
      code: 'PASSWORD_RESET_RATE_LIMITED',
    });
  }
  const token = await identityAccess.requestPasswordReset(email);
  if (!token) {
    // Resposta idêntica para conta inexistente: não revela quais emails estão
    // registados e não há nada para entregar.
    return res.json({
      success: true,
      message: 'Se existir uma conta com este e-mail, receberá instruções para recuperar a palavra-passe.',
    });
  }
  let delivery: Awaited<ReturnType<typeof emailDelivery.sendPasswordReset>>;
  try {
    const recipient = await identityAccess.findByEmail(email);
    delivery = await emailDelivery.sendPasswordReset({
      recipientEmail: email,
      recipientName: recipient?.name || email,
      token,
      expiresInMinutes: 15,
    });
  } catch (error) {
    console.error('[Guigui.com] envio do reset de palavra-passe falhou:', error);
    recordAudit({ action: 'password_reset_delivery_failed', resource: 'user', requestId, success: false, metadata: { reason: 'delivery_exception' } });
    return res.status(503).json({
      success: false,
      error: 'Não foi possível enviar o email de recuperação. Tente novamente mais tarde.',
      code: 'PASSWORD_RESET_DELIVERY_FAILED',
    });
  }
  if (delivery.state !== 'accepted') {
    recordAudit({ action: 'password_reset_delivery_failed', resource: 'user', requestId, success: false, metadata: { mode: delivery.mode, state: delivery.state } });
    return res.status(503).json({
      success: false,
      error: 'Não foi possível enviar o email de recuperação. Tente novamente mais tarde.',
      code: 'PASSWORD_RESET_DELIVERY_FAILED',
    });
  }
  recordAudit({ action: 'password_reset_requested', resource: 'user', requestId, success: true, metadata: { deliveryMode: delivery.mode } });
  res.json({
    success: true,
    message: 'Se existir uma conta com este e-mail, receberá instruções para recuperar a palavra-passe.',
  });
});

app.post('/api/auth/reset-password', async (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  if (!token || newPassword.length < 8) return res.status(400).json({ error: 'O código e a nova palavra-passe são obrigatórios. Use pelo menos 8 carateres.' });
  // O token identifica o pedido de uma conta; o balde é indexado pelo hash do
  // token para não guardar o segredo em claro na tabela de rate-limit.
  const tokenKey = createHash('sha256').update(token).digest('hex');
  if (!await consumeAccountRateLimit('password-reset-token', tokenKey, PASSWORD_RESET_RATE_LIMIT_WINDOW_MS, PASSWORD_RESET_MAX_ATTEMPTS)) {
    return res.status(429).json({ error: 'Demasiadas tentativas de reposição. Tente novamente mais tarde.', code: 'PASSWORD_RESET_RATE_LIMITED' });
  }
  if (!await identityAccess.resetPassword(token, newPassword)) return res.status(400).json({ error: 'O código expirou ou já foi utilizado.' });
  res.json({ success: true, message: 'Palavra-passe redefinida com sucesso.' });
});

app.post('/api/support/tickets', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  const subject = String(req.body?.subject || '').trim();
  const description = String(req.body?.description || '').trim();
  const category = String(req.body?.category || 'other');
  if (!subject || !description) return res.status(400).json({ error: 'Assunto e descrição são obrigatórios.', code: 'SUPPORT_FIELDS_REQUIRED' });
  const now = new Date().toISOString();
  const stored = context.role === 'business'
    ? (await identityAccess.findById(context.userId) || undefined)
    : null;
  const ticket = { id: `SUP-${Date.now()}-${randomUUID().slice(0, 8)}`, requesterUserId: context.userId, businessId: stored?.businessId, category, subject, description, status: 'open', createdAt: now, updatedAt: now };
  await persistPostgresSupportTicket(ticket);
  recordAudit({ action: 'support_ticket_created', resource: 'support_ticket', resourceId: ticket.id, actorRole: context.role === 'user' ? 'citizen' : context.role, requestId: requestIdFrom(req), success: true });
  res.status(201).json({ success: true, ticket });
});

app.get('/api/conversations/events', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  if (!context || (context.role !== 'user' && context.role !== 'business' && context.role !== 'admin')) return res.status(401).end();
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write(`event: ready\ndata: ${JSON.stringify({ connectedAt: new Date().toISOString() })}\n\n`);
  const stored = context.role === 'business'
    ? (await identityAccess.findById(context.userId) || undefined)
    : null;
  communicationStreams.set(res, {
    userId: context.userId,
    role: context.role,
    businessId: stored?.businessId ?? null,
  });
  const heartbeat = setInterval(() => { try { res.write(': heartbeat\n\n'); } catch { clearInterval(heartbeat); communicationStreams.delete(res); } }, 20000);
  req.on('close', () => { clearInterval(heartbeat); communicationStreams.delete(res); });
});

app.get('/api/conversations', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.' });
  if (context.role !== 'user' && context.role !== 'business') return res.status(403).json({ error: 'As mensagens comerciais estão disponíveis apenas para cidadãos e empresas.' });
  const stored = context.role === 'business'
    ? (await identityAccess.findById(context.userId) || undefined)
    : null;
  const result = await listPostgresConversations(context.userId, context.role, stored?.businessId);
  res.json(result);
});

const EXTERNAL_EMAIL_WINDOW_MS = 60 * 60 * 1000;
const EXTERNAL_EMAIL_MAX_PER_WINDOW = 20;

/**
 * Email escrito pelo próprio utilizador para fora da plataforma.
 *
 * O remetente visível é a plataforma (SPF/DKIM/DMARC) e as respostas vão para
 * o email da conta. Não existe modo simulado: sem fornecedor configurado a
 * rota responde 503, para que ninguém receba "enviado" sem ter saído.
 */
app.post('/api/emails/external', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  if (!context) {
    return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  }
  const stored = await identityAccess.findById(context.userId);
  // Colaboradores administrativos com acesso granular precisam do módulo
  // `external_email`. Cidadãos, contas empresariais e administradores com
  // acesso total não têm adminAccess e não são afectados.
  if (
    context.role === 'admin' &&
    stored?.adminAccess &&
    !canPerformAction(stored.adminAccess, 'external_email', 'create')
  ) {
    recordAudit({
      action: 'authorization_denied',
      resource: 'external_email',
      resourceId: '/api/emails/external',
      actorRole: 'admin',
      actorId: context.userId,
      success: false,
      requestId: requestIdFrom(req),
      metadata: { requiredModule: 'external_email', method: 'POST' },
    });
    return res.status(403).json({
      error: 'A sua conta não tem acesso ao email externo. Contacte o responsável da equipa.',
      code: 'MODULE_FORBIDDEN',
      module: 'external_email',
    });
  }
  if (!stored?.email) {
    return res.status(409).json({ error: 'A conta não tem um email associado.', code: 'ACCOUNT_EMAIL_REQUIRED' });
  }

  const to = typeof req.body?.to === 'string' ? req.body.to.trim() : '';
  const subject = typeof req.body?.subject === 'string' ? req.body.subject : '';
  const message = typeof req.body?.message === 'string' ? req.body.message : '';
  if (!to || !subject.trim() || !message.trim()) {
    return res.status(400).json({
      error: 'Destinatário, assunto e mensagem são obrigatórios.',
      code: 'EXTERNAL_EMAIL_INVALID',
    });
  }

  // Dentro da plataforma há mensagens internas; este canal é só para fora.
  const recipientAccount = await identityAccess.findByEmail(to);
  if (recipientAccount) {
    return res.status(409).json({
      error: 'Este destinatário tem conta no Guigui.com. Use as mensagens internas da plataforma.',
      code: 'RECIPIENT_IS_PLATFORM_MEMBER',
    });
  }

  const allowed = await consumeDistributedRateLimit(
    `email:external:${context.userId}`,
    EXTERNAL_EMAIL_WINDOW_MS,
    EXTERNAL_EMAIL_MAX_PER_WINDOW,
  );
  if (allowed === false) {
    return res.status(429).json({
      error: 'Limite de emails externos atingido. Tente novamente mais tarde.',
      code: 'EXTERNAL_EMAIL_RATE_LIMITED',
    });
  }

  const idempotencyKey = typeof req.body?.requestId === 'string' ? req.body.requestId.trim() : undefined;
  try {
    const outcome = await externalEmail.send({
      sender: { userId: context.userId, name: stored.name || stored.email, email: stored.email },
      to,
      subject,
      message,
      requestId: idempotencyKey,
    });
    recordAudit({
      action: 'external_email_sent',
      resource: 'email_delivery',
      resourceId: outcome.deliveryId,
      actorRole: context.role === 'user' ? 'citizen' : context.role,
      actorId: context.userId,
      success: outcome.state === 'accepted',
      requestId: requestIdFrom(req),
      metadata: { state: outcome.state, deduplicated: outcome.deduplicated },
    });
    if (outcome.state === 'accepted') {
      return res.status(202).json({ state: outcome.state, reference: outcome.deliveryId });
    }
    return res.status(502).json({
      error: 'O fornecedor de email não aceitou a mensagem.',
      code: 'EXTERNAL_EMAIL_FAILED',
      state: outcome.state,
    });
  } catch (error) {
    if (error instanceof ExternalEmailValidationError) {
      return res.status(400).json({ error: error.message, code: error.code.toUpperCase() });
    }
    if (error instanceof EmailConfigurationError) {
      return res.status(503).json({
        error: 'O envio de email não está configurado.',
        code: 'EMAIL_NOT_CONFIGURED',
      });
    }
    console.error('external-email-failed', {
      userId: context.userId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    return res.status(500).json({ error: 'Não foi possível enviar o email.', code: 'EXTERNAL_EMAIL_FAILED' });
  }
});

app.post('/api/conversations', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  const businessId = String(req.body?.businessId || '').trim();
  const subject = String(req.body?.subject || '').trim();
  const text = String(req.body?.text || '').trim();
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.' });
  if (context.role !== 'user' || !businessId || !subject || !text) return res.status(400).json({ error: 'Destinatário, assunto e mensagem são obrigatórios.' });
  const id = `CON-${randomUUID()}`;
  const conversationId = await createPostgresConversation({ id, userId: context.userId, businessId, subject, text, senderId: context.userId, senderRole: 'user' });
  broadcastCommunication('conversation', { conversationId: conversationId || id, type: 'new_message' }, { userId: context.userId, businessId });
  res.status(201).json({ id: conversationId || id });
});

app.post('/api/conversations/:id/read', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  if (!context || (context.role !== 'user' && context.role !== 'business')) return res.status(401).json({ error: 'Sessão autenticada necessária.' });
  const stored = context.role === 'business'
    ? (await identityAccess.findById(context.userId) || undefined)
    : null;
  const marked = await markPostgresConversationRead({ conversationId: req.params.id, userId: context.userId, role: context.role, businessId: stored?.businessId });
  if (!marked) return res.status(403).json({ error: 'Não participa nesta conversa.' });
  const participants = await getConversationParticipants(req.params.id);
  broadcastCommunication('conversation', { conversationId: req.params.id, type: 'read' }, participants || {});
  res.json({ success: true });
});

app.post('/api/conversations/:id/messages', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  const text = String(req.body?.text || '').trim();
  const clientMessageId = typeof req.body?.clientMessageId === 'string' ? req.body.clientMessageId.trim().slice(0, 160) : undefined;
  const replyToId = typeof req.body?.replyToId === 'string' ? req.body.replyToId.trim().slice(0, 160) : undefined;
  const messageType = typeof req.body?.messageType === 'string' ? req.body.messageType.trim().slice(0, 32) : 'text';
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.' });
  if ((context.role !== 'user' && context.role !== 'business') || !text) return res.status(400).json({ error: 'Mensagem inválida.' });
  const stored = context.role === 'business'
    ? (await identityAccess.findById(context.userId) || undefined)
    : null;
  try {
    await createPostgresConversationMessage({ id: `MSG-${randomUUID()}`, conversationId: req.params.id, senderId: context.userId, senderRole: context.role, businessId: stored?.businessId, text, clientMessageId, replyToId, messageType });
  } catch (error) {
    if (error instanceof Error && error.message === 'CONVERSATION_ACCESS_DENIED') return res.status(403).json({ error: 'Não participa nesta conversa.' });
    throw error;
  }
  const participants = await getConversationParticipants(req.params.id);
  broadcastCommunication('conversation', { conversationId: req.params.id, type: 'new_message' }, participants || {});
  res.status(201).json({ success: true });
});

app.get('/api/support/tickets/mine', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.' });
  const stored = context.role === 'business'
    ? (await identityAccess.findById(context.userId) || undefined)
    : null;
  res.json({ tickets: await listPostgresSupportTickets(context.userId, context.role, stored?.businessId) });
});

app.post('/api/support/tickets/:id/replies', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.' });
  if (!['user', 'business', 'admin'].includes(context.role)) return res.status(400).json({ error: 'Resposta inválida.' });
  const stored = context.role === 'business'
    ? (await identityAccess.findById(context.userId) || undefined)
    : null;
  // Acesso ao pedido decidido antes do corpo: sem acesso é 403, nunca 400.
  const canReply = await canAccessSupportTicket(req.params.id, context.userId, context.role, stored?.businessId);
  if (!canReply) return res.status(403).json({ error: 'Sem acesso a este pedido de suporte.' });
  const text = String(req.body?.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Resposta inválida.' });
  try {
    await createPostgresSupportReply({ id: `REP-${randomUUID()}`, ticketId: req.params.id, senderId: context.userId, senderRole: context.role, businessId: stored?.businessId, text, status: context.role === 'admin' ? 'in_progress' : undefined });
  } catch (error) {
    if (error instanceof Error && error.message === 'SUPPORT_ACCESS_DENIED') return res.status(403).json({ error: 'Sem acesso a este pedido de suporte.' });
    throw error;
  }
  const participants = await getSupportTicketParticipants(req.params.id);
  broadcastCommunication('support', { ticketId: req.params.id, type: 'new_reply' }, participants || {});
  res.status(201).json({ success: true });
});

app.post('/api/support/tickets/:id/status', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.' });
  if (context.role !== 'admin') return res.status(403).json({ error: 'Apenas a administração pode alterar o estado do suporte.' });
  const status = String(req.body?.status || '').trim();
  if (!['open', 'in_progress', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'Estado de ticket inválido.' });
  }
  const updated = await updatePostgresSupportStatus(req.params.id, status);
  if (!updated) return res.status(404).json({ error: 'Pedido de suporte não encontrado.' });
  const participants = await getSupportTicketParticipants(req.params.id);
  broadcastCommunication('support', { ticketId: req.params.id, type: 'status_changed', status }, participants || {});
  res.json({ success: true });
});

app.get('/api/notifications', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  res.json(await listPostgresNotifications(context.userId));
});

app.post('/api/notifications/:id/read', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  const updated = await markPostgresNotificationRead(context.userId, req.params.id);
  if (!updated) return res.status(404).json({ error: 'Notificação não encontrada.', code: 'NOTIFICATION_NOT_FOUND' });
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Feed: publicações e interações
// ---------------------------------------------------------------------------

/** Localiza a publicação e a empresa/entidade responsável, na base de dados. */
async function resolvePostOwner(postId: string): Promise<{
  businessId: string;
  businessName: string;
  title: string;
  ownerUserId?: string;
} | null> {
  const businesses = await listPostgresBusinesses();
  for (const business of businesses) {
    const posts = Array.isArray(business.posts) ? business.posts : [];
        const post = posts.find((entry) => entry && entry.id === postId);
    if (post) {
      let ownerUserId = (business as { ownerUserId?: string }).ownerUserId;
      if (!ownerUserId) {
        // Empresas antigas não têm o dono na coluna `companies.owner_user_id`;
        // nesse caso usa-se o membro da equipa ligado à empresa.
        const membership = await databasePool.query<{ user_id: string }>(
          'SELECT user_id FROM company_members WHERE company_id = $1 LIMIT 1',
          [business.id],
        ).catch(() => null);
        ownerUserId = membership?.rows?.[0]?.user_id;
      }
      return {
        businessId: business.id,
        businessName: business.name,
        title: post.title || post.content?.slice(0, 80) || 'publicação',
        ownerUserId,
      };
    }
  }
  return null;
}

/** Notifica a empresa responsável, sem duplicar a mesma ação. */
async function notifyPostInteraction(input: {
  postId: string;
  kind: 'like' | 'comment' | 'share';
  actorId: string;
  actorName: string;
  dedupeKey: string;
}): Promise<void> {
  try {
    const owner = await resolvePostOwner(input.postId);
    if (!owner?.ownerUserId || owner.ownerUserId === input.actorId) return;
    const existing = await listPostgresNotifications(owner.ownerUserId);
    const duplicate = existing.some((notification) => {
      const metadata = (notification as { metadata?: Record<string, unknown> } | null)?.metadata;
      return metadata?.dedupeKey === input.dedupeKey;
    });
    if (duplicate) return;
    const label = input.kind === 'like' ? 'gostou da' : input.kind === 'comment' ? 'comentou a' : 'partilhou a';
    await persistPostgresNotification({
      id: `post-ntf-${randomUUID()}`,
      userId: owner.ownerUserId,
      category: 'post_interaction',
      title: 'Nova interação no feed',
      message: `${input.actorName} ${label} publicação "${owner.title}".`,
      metadata: {
        dedupeKey: input.dedupeKey,
        kind: input.kind,
        postId: input.postId,
        businessId: owner.businessId,
        actorId: input.actorId,
        actorName: input.actorName,
        actionUrl: `/?post=${encodeURIComponent(input.postId)}`,
      },
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Guigui.com] notifyPostInteraction falhou:', error);
  }
}

app.get('/api/locations', async (_req, res) => {
  try {
    res.json(await listLocationCatalog());
  } catch (error) {
    console.error('[Guigui.com] GET /api/locations falhou:', error);
    res.status(500).json({ error: 'Não foi possível carregar as localidades.' });
  }
});

app.get('/api/posts', async (req, res) => {
  const pagingResult = parseCollectionPaging(req.query as Record<string, unknown>);
  if ('error' in pagingResult) {
    return res.status(400).json({ error: pagingResult.error, code: 'INVALID_PAGINATION' });
  }
  try {
    const neighborhood = typeof req.query.neighborhood === 'string' ? req.query.neighborhood.trim() : '';
    const query = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const businesses = await listPostgresBusinesses();
    const companyPosts = businesses.flatMap((business) =>
      (business.posts || []).map((post) => ({
        ...post,
        businessName: post.businessName || business.name,
        businessLogo: post.businessLogo || business.logo,
        // A localização da publicação é a que foi guardada ao publicar; os
        // posts antigos que não a têm herdam a localização da própria empresa.
        neighborhood: post.neighborhood || business.neighborhood,
        ownerType: 'business',
      })),
    );
    const storedUserPosts = await getAppState('guigui_user_posts');
    const citizenPosts = Array.isArray(storedUserPosts) ? storedUserPosts : [];
    const posts = [...citizenPosts, ...companyPosts]
      .filter((post) => post && post.status === 'approved')
      .filter((post) => !neighborhood || locationMatches(post.neighborhood, neighborhood))
      .filter((post) => !query || [post.title, post.content, post.businessName, post.neighborhood]
        .some((value) => String(value || '').toLowerCase().includes(query)))
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
    // Sem `limit` devolve o feed inteiro (compatível com os clientes antigos);
    // com `limit`/`offset` devolve só a página pedida e o total disponível.
    const { items, pagination } = paginateCollection(posts, pagingResult.paging);
    res.json({
      posts: items,
      total: posts.length,
      hasMore: pagination ? pagination.hasMore : false,
      ...(pagination ? { limit: pagination.limit, offset: pagination.offset } : {}),
      filter: { neighborhood: neighborhood || null, q: query || null },
    });
  } catch (error) {
    console.error('[Guigui.com] GET /api/posts falhou:', error);
    res.status(500).json({ error: 'Não foi possível carregar o feed.' });
  }
});

app.get('/api/posts/engagements', async (req, res) => {
  const context = await sessionContext(req);
  try {
    res.json({ engagements: await listPostEngagements(context?.userId) });
  } catch (error) {
    console.error('[Guigui.com] GET /api/posts/engagements falhou:', error);
    res.status(500).json({ error: 'Não foi possível carregar as interações.' });
  }
});

app.get('/api/posts/engagements/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();
  res.write(`event: ready
data: ${JSON.stringify({ connectedAt: new Date().toISOString() })}

`);
  postEngagementStreams.add(res);
  const heartbeat = setInterval(() => { try { res.write(`: heartbeat

`); } catch { clearInterval(heartbeat); postEngagementStreams.delete(res); } }, 20000);
  req.on('close', () => { clearInterval(heartbeat); postEngagementStreams.delete(res); });
});

app.get('/api/realtime/status', requireRole('admin'), (_req, res) => {
  res.json(realtimeStatus());
});

app.post('/api/posts/:postId/reaction', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  const reaction = req.body?.reaction ?? null;
  if (reaction !== null && !isPostReactionType(reaction)) {
    return res.status(400).json({ error: 'Reação inválida.', code: 'INVALID_REACTION' });
  }
  try {
    const engagement = await setPostReaction({ postId: req.params.postId, userId: context.userId, reaction });
    broadcastPostEngagement({ postId: req.params.postId });
    if (reaction) {
      const actor = await identityAccess.findById(context.userId);
    await notifyPostInteraction({
        postId: req.params.postId,
        kind: 'like',
        actorId: context.userId,
        actorName: actor?.name || 'Um utilizador',
        dedupeKey: `reaction:${req.params.postId}:${context.userId}:${reaction}`,
      });
    }
    res.json({ engagement });
  } catch (error) {
    console.error('[Guigui.com] POST reaction falhou:', error);
    res.status(500).json({ error: 'Não foi possível registar a reação.' });
  }
});

app.post('/api/posts/:postId/comments', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  const text = String(req.body?.text ?? '').trim();
  if (!text) return res.status(400).json({ error: 'O comentário não pode estar vazio.', code: 'EMPTY_COMMENT' });
  if (text.length > 2000) return res.status(400).json({ error: 'O comentário excede 2000 caracteres.', code: 'COMMENT_TOO_LONG' });
  try {
    const actor = await identityAccess.findById(context.userId);
    const { comment, engagement } = await addPostComment({
      postId: req.params.postId,
      authorId: context.userId,
      authorName: actor?.name || 'Utilizador',
      authorAvatar: actor?.avatarUrl,
      content: text,
    });
    broadcastPostEngagement({ postId: req.params.postId });
    await notifyPostInteraction({
      postId: req.params.postId,
      kind: 'comment',
      actorId: context.userId,
      actorName: actor?.name || 'Um utilizador',
      dedupeKey: `comment:${comment.id}`,
    });
    res.status(201).json({ comment, engagement });
  } catch (error) {
    console.error('[Guigui.com] POST comment falhou:', error);
    res.status(500).json({ error: 'Não foi possível guardar o comentário.' });
  }
});

app.post('/api/posts/:postId/comments/reply', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  const text = String(req.body?.text ?? '').trim();
  const parentId = String(req.body?.parentId ?? '').trim();
  if (!text) return res.status(400).json({ error: 'A resposta não pode estar vazia.', code: 'EMPTY_REPLY' });
  if (text.length > 2000) return res.status(400).json({ error: 'A resposta excede 2000 caracteres.', code: 'REPLY_TOO_LONG' });
  if (!parentId) return res.status(400).json({ error: 'Comentário de origem em falta.', code: 'PARENT_COMMENT_REQUIRED' });
  try {
    const engagements = await listPostEngagements(context.userId);
    const parent = (engagements[req.params.postId]?.comments ?? []).find((comment) => comment.id === parentId);
    if (!parent) return res.status(404).json({ error: 'Comentário não encontrado nesta publicação.', code: 'COMMENT_NOT_FOUND' });
    const actor = await identityAccess.findById(context.userId);
    const { comment, engagement } = await registerPostReply({
      postId: req.params.postId,
      authorId: context.userId,
      authorName: actor?.name || 'Utilizador',
      authorAvatar: actor?.avatarUrl,
      content: text,
      parentId,
    });
    broadcastPostEngagement({ postId: req.params.postId });
    await notifyPostInteraction({
      postId: req.params.postId,
      kind: 'comment',
      actorId: context.userId,
      actorName: actor?.name || 'Um utilizador',
      dedupeKey: `reply:${comment.id}`,
    });
    res.status(201).json({ comment, engagement });
  } catch (error) {
    console.error('[Guigui.com] POST comment reply falhou:', error);
    res.status(500).json({ error: 'Não foi possível guardar a resposta.' });
  }
});

app.post('/api/posts/:postId/share', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  try {
    const engagement = await registerPostShare({ postId: req.params.postId, userId: context.userId });
    const actor = await identityAccess.findById(context.userId);
    broadcastPostEngagement({ postId: req.params.postId });
    await notifyPostInteraction({
      postId: req.params.postId,
      kind: 'share',
      actorId: context.userId,
      actorName: actor?.name || 'Um utilizador',
      dedupeKey: `share:${req.params.postId}:${context.userId}:${engagement.shares}`,
    });
    res.json({ engagement });
  } catch (error) {
    console.error('[Guigui.com] POST share falhou:', error);
    res.status(500).json({ error: 'Não foi possível registar a partilha.' });
  }
});

/** Métricas reais das publicações, para o painel da empresa. */
app.get('/api/businesses/:businessId/post-metrics', requireRole('business', 'admin'), async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  try {
    const businesses = await listPostgresBusinesses();
    const business = businesses.find((entry) => entry.id === req.params.businessId);
    if (!business) return res.status(404).json({ error: 'Empresa não encontrada.', code: 'BUSINESS_NOT_FOUND' });
    const storedBusinessUser = context.role === 'business'
      ? (await identityAccess.findById(context.userId) || undefined)
      : undefined;
    const scope = resolveBusinessScope(context.role, storedBusinessUser?.businessId, req.params.businessId);
    if (scope.allowed === false) {
      return res.status(scope.status).json({ error: 'Sem permissão para consultar estas métricas.', code: scope.code });
    }
    const engagements = await listPostEngagements(context.userId);
    const posts = (business.posts || []).map((post) => {
      const engagement = engagements[post.id];
      return {
        id: post.id,
        title: post.title || post.content?.slice(0, 80) || 'Publicação',
        createdAt: post.createdAt,
        status: post.status,
        likes: engagement?.likes ?? 0,
        comments: engagement?.comments.length ?? 0,
        shares: engagement?.shares ?? 0,
        latestComments: (engagement?.comments ?? []).slice(-20).map((comment) => ({
          id: comment.id,
          authorName: comment.authorName,
          content: comment.content,
          createdAt: comment.createdAt,
        })),
      };
    }).sort((left, right) => (right.likes + right.comments + right.shares) - (left.likes + left.comments + left.shares));
    const totals = posts.reduce((accumulator, post) => ({
      likes: accumulator.likes + post.likes,
      comments: accumulator.comments + post.comments,
      shares: accumulator.shares + post.shares,
    }), { likes: 0, comments: 0, shares: 0 });
    res.json({ businessId: business.id, businessName: business.name, totals, posts, topPosts: posts.slice(0, 5) });
  } catch (error) {
    console.error('[Guigui.com] GET post-metrics falhou:', error);
    res.status(500).json({ error: 'Não foi possível carregar as métricas.' });
  }
});

app.post('/api/auth/register', async (req, res) => {
  const {
    name,
    email,
    password,
    phone = '+245 955 00 00',
    neighborhood = 'Bissau',
    role = 'user',
    businessName,
    businessId,
    categoryId,
    groupGroupId,
    subcategoryId,
    description,
    businessPhone,
    businessNeighborhood,
    publicEmail,
  } = req.body || {};
  const emailCheck = normaliseEmailForAccount(email);
  if (typeof name !== 'string' || name.trim().length < 2 || !emailCheck.ok || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({
      error: 'Indique um nome, e-mail válido e palavra-passe com pelo menos 6 carateres.',
      ...(emailCheck.ok ? {} : { code: emailCheck.code }),
    });
  }
  if (role !== 'user' && role !== 'business') return res.status(400).json({ error: 'Tipo de conta inválido.' });

  const normalizedBusinessName = typeof businessName === 'string' ? businessName.trim() : '';
  const normalizedBusinessPhone = typeof businessPhone === 'string' ? businessPhone.trim() : '';
  const normalizedBusinessNeighborhood = typeof businessNeighborhood === 'string' ? businessNeighborhood.trim() : '';
  const normalizedCategoryId = typeof categoryId === 'string' ? categoryId.trim() : '';
  const normalizedGroupGroupId = typeof groupGroupId === 'string' ? groupGroupId.trim() : normalizedCategoryId;
  const normalizedSubcategoryId = typeof subcategoryId === 'string' ? subcategoryId.trim() : '';
  const normalizedDescription = typeof description === 'string' ? description.trim() : '';
  const publicEmailCheck = typeof publicEmail === 'string' && publicEmail.trim()
    ? normaliseAndValidateEmail(publicEmail)
    : null;
  const normalizedPublicEmail = publicEmailCheck?.ok ? publicEmailCheck.email : '';
  if (role === 'business') {
    const completion = getBusinessProfileCompletion({
      name: normalizedBusinessName,
      categoryId: normalizedCategoryId,
      subcategoryId: normalizedSubcategoryId,
      description: normalizedDescription,
      phone: normalizedBusinessPhone,
      neighborhood: normalizedBusinessNeighborhood,
    });
    if (completion.missingFields.length > 0) {
      return res.status(400).json({
        error: 'Preencha os campos obrigatórios do perfil empresarial.',
        code: 'BUSINESS_PROFILE_INCOMPLETE',
        missingFields: completion.missingFields,
      });
    }
    if (publicEmail !== undefined && typeof publicEmail !== 'string') {
      return res.status(400).json({ error: 'O e-mail público é inválido.', code: 'BUSINESS_PUBLIC_EMAIL_INVALID' });
    }
    if (publicEmailCheck && !publicEmailCheck.ok) {
      return res.status(400).json({ error: publicEmailCheck.message, code: 'BUSINESS_PUBLIC_EMAIL_INVALID' });
    }
  }

  const normalizedEmail = emailCheck.email ?? '';
  const businessProfile = role === 'business' ? {
    name: normalizedBusinessName,
    categoryId: normalizedCategoryId,
    groupGroupId: normalizedGroupGroupId,
    subcategoryId: normalizedSubcategoryId,
    description: normalizedDescription,
    phone: normalizedBusinessPhone,
    neighborhood: normalizedBusinessNeighborhood,
    ...(normalizedPublicEmail ? { publicEmail: normalizedPublicEmail } : {}),
  } : undefined;
  const result = await identityAccess.register({
    name: name.trim(),
    email: normalizedEmail,
    password,
    phone: String(phone),
    neighborhood: String(neighborhood),
    role,
    ...(businessProfile ? { businessProfile } : {}),
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  if (result.kind === 'invalid_profile') {
    return res.status(400).json({
      error: 'Preencha os campos obrigatórios do perfil empresarial.',
      code: 'BUSINESS_PROFILE_INCOMPLETE',
      missingFields: result.missingFields,
    });
  }
  if (result.kind === 'duplicate_account') {
    return res.status(409).json({ error: 'Já existe uma conta com este e-mail.' });
  }
  if (result.kind === 'registration_failed') {
    recordAudit({
      action: 'public_registration_failed',
      resource: 'user',
      resourceId: String(email || '').toLowerCase(),
      actorRole: 'system',
      requestId: requestIdFrom(req),
      success: false,
      metadata: {
        reason: result.error instanceof Error ? result.error.message : 'unknown',
        compensationFailures: result.compensationFailures,
      },
    });
    return res.status(500).json({
      error: 'Não foi possível concluir o registo. Tente novamente.',
      code: result.compensationFailures.length > 0 ? 'REGISTRATION_COMPENSATION_FAILED' : 'REGISTRATION_FAILED',
    });
  }

  setSessionCookie(res, result.sessionToken);
  recordAudit({
    action: 'account_registered',
    resource: 'user',
    resourceId: result.user.id,
    actorRole: role === 'user' ? 'citizen' : 'business',
    requestId: requestIdFrom(req),
    success: true,
    metadata: result.business ? { businessId: result.business.id } : undefined,
  });
  return res.status(201).json({
    success: true,
    user: result.user,
    ...(result.business ? { business: result.business } : {}),
  });
});

// Gemini AI Content Moderation Endpoint (Texto e Imagens em Português e Crioulo Guineense)
app.post('/api/moderate', requireSession, async (req, res) => {
  const moderationRequestId = requestIdFrom(req);
  const moderationContext = await sessionContext(req);
  if (!moderationContext) {
    return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  }
  if (!(await consumeAiQuota(moderationContext.userId))) {
    recordAudit({ action: 'ai_moderation_rate_limited', resource: 'moderation', actorRole: moderationContext.role === 'user' ? 'citizen' : moderationContext.role, actorName: `user:${moderationContext.userId}`, requestId: moderationRequestId, success: false });
    return res.status(429).json({ error: 'Demasiados pedidos de moderação. Tente novamente dentro de um minuto.', code: 'RATE_LIMITED' });
  }
  try {
    const { text, author, type = 'post', imageBase64 } = req.body;

    if ((text !== undefined && typeof text !== 'string') || (author !== undefined && typeof author !== 'string')) {
      return res.status(400).json({ error: 'Os campos de texto e autor devem ser strings.' });
    }
    if (imageBase64 !== undefined && (typeof imageBase64 !== 'string' || imageBase64.length > 8_000_000)) {
      return res.status(413).json({ error: 'Imagem demasiado grande ou inválida.' });
    }
    if (!text?.trim() && !imageBase64) {
      return res.status(400).json({ error: 'É necessário fornecer texto ou imagem para moderação.' });
    }

    const ai = getAIClient();
    let status: 'verde' | 'amarelo' | 'vermelho' = 'verde';
    let reason = 'Conteúdo em conformidade com as diretrizes do Guigui.com';
    let confidence = 0.95;
    let suggestedAction: 'approve' | 'flag_for_human_review' | 'reject' = 'approve';

    if (ai && (text || imageBase64)) {
      try {
        const prompt = `Você é o sistema de moderação por IA do Guigui.com (plataforma comercial e cultural da Guiné-Bissau, Grupo Gorila).
Analise o seguinte conteúdo submetido por um utilizador (pode estar em Português, Crioulo Guineense - Kriol, Francês ou Inglês).

Conteúdo a analisar:
- Tipo: ${type}
- Autor: ${author || 'Anónimo'}
- Texto: "${text || ''}"

Diretrizes de Moderação:
1. "VERDE" (Aprovar automaticamente): Anúncio legítimo, evento cultural, promoção, avaliação justa de negócio, saudações amigáveis em Português ou Crioulo.
2. "AMARELO" (Revisão Humana): Termos ambíguos, crioulo muito informal ou regional desconhecido, alegações médicas/comerciais duvidosas, divergências de preço.
3. "VERMELHO" (Rejeitar): Discurso de ódio, conteúdo sexual/nudez, fraude manifesta, incitação à violência, ofensas pessoais graves ou números de telefone expostos indevidamente em comentários.

Responda ESTRITAMENTE em formato JSON com as chaves:
{
  "status": "verde" | "amarelo" | "vermelho",
  "reason": "explicação curta em português",
  "confidence": number_0_to_1,
  "suggestedAction": "approve" | "flag_for_human_review" | "reject"
}`;

        const model = 'gemini-2.5-flash';
        let contents: any[] = [prompt];

        if (imageBase64) {
          const mimeType = imageBase64.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
          const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
          contents.push({
            inlineData: {
              data: cleanBase64,
              mimeType,
            },
          });
        }

        const response = await ai.models.generateContent({
          model,
          contents,
          config: {
            responseMimeType: 'application/json',
          },
        });

        const rawText = response.text || '';
        const parsed = JSON.parse(rawText);
        status = parsed.status || status;
        reason = parsed.reason || reason;
        confidence = parsed.confidence || confidence;
        suggestedAction = parsed.suggestedAction || suggestedAction;
      } catch (geminiError) {
        console.warn('Gemini Moderation call failed, falling back to local heuristic checks:', geminiError);
      }
    }

    // Crioulo Guineense Caution Rule (Section 9.3)
    const criouloWords = ['kuri', 'mancebo', 'fasi', 'pabu', 'djintis', 'frikundam', 'kumpu', 'kriol', 'sabi', 'djudu'];
    const isCrioulo = text && criouloWords.some((w) => text.toLowerCase().includes(w));
    if (isCrioulo && status === 'verde') {
      status = 'amarelo';
      reason = 'Conteúdo em Crioulo Guineense: Classificado como Amarelo por precaução automática de IA conforme Secção 9.3.';
      suggestedAction = 'flag_for_human_review';
    }

    // Heuristic fallbacks for Kriol & Portuguese bad words if AI was offline
    if (text) {
      const lower = text.toLowerCase();
      const redKeywords = ['fraude', 'scam', 'violencia', 'matar', 'roubo', 'ofensa', 'puta', 'caralho', 'cura definitiva'];
      const yellowKeywords = ['garantido 100%', 'cura milagrosa', 'desconto secreton', 'ganhe dinheiro'];

      if (redKeywords.some((w) => lower.includes(w))) {
        status = 'vermelho';
        reason = 'Palavras proibidas ou alegações abusivas detectadas no filtro de segurança.';
        suggestedAction = 'reject';
      } else if (yellowKeywords.some((w) => lower.includes(w))) {
        status = 'amarelo';
        reason = 'Alegações comerciais que requerem validação pela equipa Guigui.';
        suggestedAction = 'flag_for_human_review';
      }
    }

    const storedModerationUser = await identityAccess.findById(moderationContext.userId) || undefined;
    const logEntry = {
      id: 'MOD-' + Date.now(),
      authorId: moderationContext.userId,
      businessId: storedModerationUser?.businessId,
      businessName: author || 'Utilizador Guigui',
      authorName: author || 'Utilizador',
      type,
      contentSnippet: (text || '').slice(0, 150),
      imageUrl: imageBase64 ? 'Imagem Anexada' : undefined,
      result: { status, reason, confidence, suggestedAction, isCriouloLanguage: isCrioulo },
      status: status === 'verde' ? 'approved' : status === 'amarelo' ? 'pending_human' : 'rejected',
      createdAt: new Date().toISOString(),
      reviewedByHuman: false,
      auditTrail: [
        {
          timestamp: new Date().toISOString(),
          action: 'auto_classified',
          actor: 'Sistema IA Gemini',
          notes: `Classificação inicial: ${status.toUpperCase()} (${reason})`,
        },
      ],
    };

    moderationLogs.unshift(logEntry);
    persistModerationLogs();
    void persistPostgresModeration(logEntry).catch((error: unknown) => {
      console.error('postgres-moderation-persist-failed', error);
    });

    res.json(logEntry);
  } catch (error: any) {
    res.status(500).json({ error: 'Erro ao processar moderação', details: error.message });
  }
});

// Admin Moderation API Endpoints
// A fila de moderação contém conteúdo de utilizadores e decisões pendentes:
// é informação exclusiva da administração.
app.get('/api/moderation/logs', requireRole('admin'), async (req, res) => {
  if (databaseConfigured) {
    try {
      const logs = await listPostgresModeration(500);
      if (logs.length > 0) return res.json(logs);
    } catch (error) {
      console.error('[Guigui.com] /api/moderation/logs pg error:', error);
    }
  }
  res.json(moderationLogs);
});

// ----------------------------------------------------------------------------
// Moderação centralizada — modelo único de submissões (`moderation_submissions`).
// A fila do dashboard admin, o painel da empresa e o detalhe com histórico
// leem todos daqui. O endpoint /api/admin/moderation-logs fica apenas com o
// histórico legado de classificações de IA.
// ----------------------------------------------------------------------------
const DECISION_ACTIONS: DecisionAction[] = ['approve', 'reject', 'request_changes', 'in_review'];

function submissionErrorResponse(error: unknown, res: any, fallback: string) {
  if (error instanceof ModerationSubmissionError) {
    return res.status(error.status).json({ error: error.message, code: error.code });
  }
  console.error('[Guigui.com] moderation submission error:', error);
  return res.status(500).json({ error: fallback, code: 'MODERATION_SUBMISSION_FAILED' });
}

// A fila global contém conteúdo de todas as empresas: exclusiva da administração.
app.get('/api/moderation/submissions', requireRole('admin'), async (req, res) => {
  if (!databasePool) {
    return res.status(503).json({ error: 'A base de dados PostgreSQL é necessária para a fila de moderação.', code: 'DATABASE_REQUIRED' });
  }
  const query = req.query as Record<string, string | undefined>;
  const limit = query.limit ? Number(query.limit) : undefined;
  try {
    const result = await listModerationSubmissions({
      status: query.status,
      type: query.type,
      companyId: query.companyId,
      ownerUserId: query.ownerUserId,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      search: query.search,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    res.json(result);
  } catch (error) {
    console.error('[Guigui.com] /api/moderation/submissions error:', error);
    res.status(500).json({ error: 'Não foi possível carregar a fila de moderação.', code: 'MODERATION_QUEUE_FAILED' });
  }
});

// Declarado antes de /:id para "mine" não ser interpretado como um identificador.
app.get('/api/moderation/submissions/mine', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  if (!databasePool) return res.status(503).json({ error: 'A base de dados PostgreSQL é necessária.', code: 'DATABASE_REQUIRED' });
  const stored = await identityAccess.findById(context.userId) || undefined;
  try {
    const result = await listModerationSubmissions({
      ownerUserId: context.userId,
      companyId: context.role === 'admin' ? undefined : stored?.businessId,
    });
    res.json(result);
  } catch (error) {
    console.error('[Guigui.com] /api/moderation/submissions/mine error:', error);
    res.status(500).json({ error: 'Não foi possível carregar as suas submissões.', code: 'MODERATION_SUBMISSIONS_FAILED' });
  }
});

app.get('/api/moderation/submissions/:id', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  try {
    const submission = await getModerationSubmission(req.params.id);
    if (!submission) return res.status(404).json({ error: 'Submissão não encontrada.', code: 'SUBMISSION_NOT_FOUND' });
    if (context.role !== 'admin') {
      const stored = await identityAccess.findById(context.userId) || undefined;
      const ownsSubmission = submission.submittedBy === context.userId;
      const sameCompany = Boolean(stored?.businessId && submission.companyId === stored.businessId);
      if (!ownsSubmission && !sameCompany) {
        return res.status(403).json({ error: 'Não possui permissão para consultar esta submissão.', code: 'PERMISSION_DENIED' });
      }
    }
    res.json({ submission });
  } catch (error) {
    console.error('[Guigui.com] /api/moderation/submissions/:id error:', error);
    res.status(500).json({ error: 'Não foi possível carregar a submissão.', code: 'MODERATION_SUBMISSION_FAILED' });
  }
});

app.post('/api/moderation/submissions/:id/decision', requireRole('admin'), async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  const action = req.body?.action as DecisionAction | undefined;
  if (!action || !DECISION_ACTIONS.includes(action)) {
    return res.status(400).json({ error: 'Ação de decisão inválida.', code: 'INVALID_DECISION_ACTION' });
  }
  const requestId = requestIdFrom(req);
  const stored = await identityAccess.findById(context.userId) || undefined;
  try {
    const submission = await decideModerationSubmission({
      id: req.params.id,
      action,
      actorUserId: context.userId,
      actorName: stored?.name || `admin:${context.userId}`,
      reason: typeof req.body?.reason === 'string' ? req.body.reason : '',
    });
    recordAudit({
      action: `moderation_submission_${action}`,
      resource: 'moderation_submission',
      resourceId: submission.id,
      actorRole: 'admin',
      actorId: context.userId,
      actorName: stored?.name || `admin:${context.userId}`,
      requestId,
      success: true,
      metadata: { status: submission.status, type: submission.type },
    });
    res.json({ submission });
  } catch (error) {
    submissionErrorResponse(error, res, 'Não foi possível registar a decisão.');
  }
});

app.post('/api/moderation/submissions/:id/resubmit', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  const stored = await identityAccess.findById(context.userId) || undefined;
  try {
    const submission = await resubmitModerationSubmission({
      id: req.params.id,
      actorUserId: context.userId,
      actorName: stored?.name || `user:${context.userId}`,
      companyId: stored?.businessId,
      title: typeof req.body?.title === 'string' ? req.body.title : undefined,
      summary: typeof req.body?.summary === 'string' ? req.body.summary : undefined,
      payload: req.body?.payload && typeof req.body.payload === 'object' ? req.body.payload : undefined,
      changesNote: typeof req.body?.changesNote === 'string' ? req.body.changesNote : '',
    });
    res.json({ submission });
  } catch (error) {
    submissionErrorResponse(error, res, 'Não foi possível reenviar a submissão.');
  }
});

// ============================================================================
// Secção 8 — Avaliações qualitativas de 4 níveis (persistência real no servidor)
// ============================================================================

/** Lista as avaliações públicas de um negócio. */
app.get('/api/businesses/:id/reviews', async (req, res) => {
  try {
    const businessId = req.params.id;
    if (!businessId) return res.status(400).json({ error: 'Identificador de negócio obrigatório.', code: 'REVIEW_BUSINESS_REQUIRED' });
    const reviews = await listPostgresReviews(businessId);
    res.json({ reviews });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar avaliações.' });
  }
});

/** Submete uma avaliação qualitativa com validação e anti-abuso no servidor. */
app.post('/api/businesses/:id/reviews', requireSession, async (req, res) => {
  const requestId = requestIdFrom(req);
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  const businessId = req.params.id;
  if (!businessId) return res.status(400).json({ error: 'Identificador de negócio obrigatório.', code: 'REVIEW_BUSINESS_REQUIRED' });

  const validation = validateReviewInput({
    qualitativeScore: req.body?.qualitativeScore,
    comment: req.body?.comment,
    authorPhone: req.body?.authorPhone,
  });
  if (validation.ok === false) {
    return res.status(400).json({ error: validation.message, code: validation.code });
  }

  const authorName = String(req.body?.authorName || '').trim();
  if (authorName.length < 2) {
    return res.status(400).json({ error: 'Indique o seu nome ou apelido.', code: 'REVIEW_AUTHOR_REQUIRED' });
  }

  // Anti-abuso (Secção 8): 1 avaliação por telemóvel por empresa em 90 dias.
  const gate = await isReviewAllowed(businessId, validation.phone);
  if (!gate.allowed) {
    recordAudit({
      action: 'review_duplicate_blocked', resource: 'review', resourceId: businessId,
      actorRole: context.role === 'user' ? 'citizen' : context.role, actorName: `user:${context.userId}`,
      requestId, success: false,
    });
    return res.status(429).json({ error: 'Este telemóvel já avaliou este negócio nos últimos 90 dias.', code: 'REVIEW_ALREADY_EXISTS' });
  }

  const storedReview = await createPostgresReview({
    businessId,
    authorUserId: context.userId,
    authorName,
    authorPhone: validation.phone,
    qualitativeScore: validation.score,
    comment: validation.comment || undefined,
    verifiedSms: Boolean(req.body.verifiedSms),
  });

  recordAudit({
    action: 'review_created', resource: 'review', resourceId: storedReview.id,
    actorRole: context.role === 'user' ? 'citizen' : context.role, actorName: `user:${context.userId}`,
    requestId, success: true,
    metadata: { businessId, status: storedReview.status, score: storedReview.qualitativeScore },
  });

  res.status(201).json({ success: true, review: storedReview });
});

/** Denúncia de avaliação por qualquer visitante com sessão (Secção 8 / Secção 9). */
app.post('/api/reviews/:reviewId/flag', requireSession, async (req, res) => {
  const requestId = requestIdFrom(req);
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  const reason = normaliseReviewComment(req.body?.reason);
  if (reason.length < 3) {
    return res.status(400).json({ error: 'Indique o motivo da denúncia.', code: 'REVIEW_FLAG_REASON_REQUIRED' });
  }
  const flagged = await flagPostgresReview(req.params.reviewId, reason);
  if (!flagged) return res.status(404).json({ error: 'Avaliação não encontrada.', code: 'REVIEW_NOT_FOUND' });
  recordAudit({
    action: 'review_flagged', resource: 'review', resourceId: flagged.id,
    actorRole: context.role === 'user' ? 'citizen' : context.role, actorName: `user:${context.userId}`,
    requestId, success: true, metadata: { businessId: flagged.businessId, reason },
  });
  res.json({ success: true, review: flagged });
});

/** Direito de resposta pública do proprietário do negócio (Secção 8). */
app.post('/api/reviews/:reviewId/reply', requireSession, async (req, res) => {
  const requestId = requestIdFrom(req);
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  if (context.role === 'user') {
    return res.status(403).json({ error: 'Apenas a empresa proprietária ou a administração pode responder.', code: 'REVIEW_REPLY_FORBIDDEN' });
  }
  // A empresa da sessão é a única autorizada a responder; a verificação de
  // âmbito corre antes da validação do corpo.
  let sessionBusinessId: string | undefined;
  if (context.role === 'business') {
    const storedBusinessUser = await identityAccess.findById(context.userId) || undefined;
    if (!storedBusinessUser?.businessId) {
      return res.status(403).json({ error: 'A sua conta não está associada a um negócio.', code: 'REVIEW_REPLY_FORBIDDEN' });
    }
    sessionBusinessId = storedBusinessUser.businessId;
  }
  const ownerReply = normaliseReviewComment(req.body?.ownerReply);
  if (ownerReply.length < 2) {
    return res.status(400).json({ error: 'Escreva a resposta pública.', code: 'REVIEW_REPLY_REQUIRED' });
  }
  let replied;
  try {
    replied = await replyPostgresReview(req.params.reviewId, ownerReply, sessionBusinessId);
  } catch (error) {
    if (error instanceof Error && error.message === 'REVIEW_ACCESS_DENIED') {
      return res.status(403).json({ error: 'A avaliação não pertence à sua empresa.', code: 'REVIEW_REPLY_FORBIDDEN' });
    }
    throw error;
  }
  if (!replied) return res.status(404).json({ error: 'Avaliação não encontrada.', code: 'REVIEW_NOT_FOUND' });
  recordAudit({
    action: 'review_owner_replied', resource: 'review', resourceId: replied.id,
    actorRole: context.role, actorName: `user:${context.userId}`,
    requestId, success: true, metadata: { businessId: replied.businessId },
  });
  res.json({ success: true, review: replied });
});

/** Decisão humana da equipa Guigui sobre avaliações na fila de moderação (Secção 9). */
app.post('/api/reviews/:reviewId/moderate', requireRole('admin'), async (req, res) => {
  const requestId = requestIdFrom(req);
  const status = String(req.body?.status || '');
  if (!['approved', 'flagged'].includes(status)) {
    return res.status(400).json({ error: 'Estado de moderação inválido.', code: 'REVIEW_STATUS_INVALID' });
  }
  const reason = normaliseReviewComment(req.body?.reason) || undefined;
  const moderated = await moderatePostgresReview(req.params.reviewId, status as 'approved' | 'flagged', reason);
  if (!moderated) return res.status(404).json({ error: 'Avaliação não encontrada.', code: 'REVIEW_NOT_FOUND' });
  recordAudit({
    action: 'review_moderated', resource: 'review', resourceId: moderated.id,
    actorRole: 'admin', actorName: 'Admin Guigui',
    requestId, success: true, metadata: { businessId: moderated.businessId, status, reason },
  });
  res.json({ success: true, review: moderated });
});

/**
 * Revisão de moderação.
 * - Decisões (approve/reject) são exclusivas do papel `admin`.
 * - O recurso (appeal) pertence ao autor do conteúdo: basta sessão válida.
 * - A identidade do ator vem SEMPRE da sessão, nunca do corpo do pedido.
 */
app.post('/api/moderation/review', requireSession, async (req, res) => {
  const requestId = requestIdFrom(req);
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });

  const { id, action, notes } = req.body;
  const isDecision = action === 'approve' || action === 'reject';
  // A simulação de recurso é uma ferramenta de administração: fica separada do
  // recurso real do titular (que exige titularidade) e é marcada como simulada.
  const isSimulatedAppeal = action === 'simulate-appeal';

  if ((isDecision || isSimulatedAppeal) && context.role !== 'admin') {
    recordAudit({ action: 'authorization_denied', resource: req.path, actorRole: context.role === 'user' ? 'citizen' : context.role, requestId, success: false, metadata: { requiredRoles: ['admin'], attemptedAction: action } });
    return res.status(403).json({ error: 'Não possui permissão para esta operação.', code: 'PERMISSION_DENIED' });
  }

  let log = moderationLogs.find((m) => m.id === id);
  // Item que existe apenas no PostgreSQL (ex.: decidido noutra sessão): carrega da BD.
  if (!log && databaseConfigured) {
    log = (await findPostgresModeration(String(id))) || undefined;
  }

  if (!log) {
    return res.status(404).json({ error: 'Item de moderação não encontrado.' });
  }

  const actorLabel = context.role === 'admin' ? `admin:${context.userId}` : `user:${context.userId}`;

  if (action === 'approve') {
    log.status = 'approved';
    log.reviewedByHuman = true;
    log.reviewedAt = new Date().toISOString();
    log.reviewedBy = actorLabel;
    log.auditTrail.push({
      timestamp: new Date().toISOString(),
      action: 'human_approved',
      actor: actorLabel,
      notes: notes || 'Aprovado por revisão humana para exibição pública.',
    });
  } else if (action === 'reject') {
    log.status = 'rejected';
    log.reviewedByHuman = true;
    log.reviewedAt = new Date().toISOString();
    log.reviewedBy = actorLabel;
    log.auditTrail.push({
      timestamp: new Date().toISOString(),
      action: 'human_rejected',
      actor: actorLabel,
      notes: notes || 'Rejeitado por violação de políticas de conteúdo.',
    });
  } else if (isSimulatedAppeal) {
    log.status = 'appealed';
    log.appealReason = `[SIMULAÇÃO] ${notes || 'Recurso simulado pela administração.'}`;
    log.auditTrail.push({
      timestamp: new Date().toISOString(),
      action: 'appeal_simulated',
      actor: actorLabel,
      notes: 'Recurso SIMULADO pela administração; não foi submetido por um autor real.',
    });
  } else if (action === 'appeal') {
    // Apenas o titular do conteudo ou um representante da empresa pode apelar.
    const storedUser = await identityAccess.findById(context.userId) || undefined;
    const sessionBusinessId = storedUser?.businessId;
    const isOwner = log.authorId === context.userId;
    const isCompanyRepresentative = Boolean(sessionBusinessId) && log.businessId === sessionBusinessId;
    if (!isOwner && !isCompanyRepresentative) {
      return res.status(403).json({ error: 'Não possui permissão para apelar este conteúdo.', code: 'MODERATION_APPEAL_FORBIDDEN' });
    }
    log.status = 'appealed';
    log.appealReason = notes;
    log.auditTrail.push({
      timestamp: new Date().toISOString(),
      action: 'appealed_by_user',
      actor: actorLabel,
      notes: notes || 'Recurso/Contestação submetida pelo autor para reapreciação.',
    });
  } else {
    return res.status(400).json({ error: 'Ação de revisão inválida.' });
  }

  if (isDecision) {
    recordAudit({
      action: action === 'approve' ? 'moderation_content_approved' : 'moderation_content_rejected',
      resource: 'moderation',
      resourceId: String(id),
      actorRole: 'admin',
      actorId: context.userId,
      actorName: actorLabel,
      requestId,
      success: true,
      metadata: { notes: notes || null },
    });
  } else if (isSimulatedAppeal) {
    recordAudit({
      action: 'moderation_appeal_simulated',
      resource: 'moderation',
      resourceId: String(id),
      actorRole: 'admin',
      actorId: context.userId,
      actorName: actorLabel,
      requestId,
      success: true,
      metadata: { notes: notes || null, simulated: true },
    });
  } else {
    // O recurso também é uma decisão registada: fica na auditoria do servidor
    // com a identidade da sessão e o request ID, não com dados do cliente.
    recordAudit({
      action: 'moderation_content_appealed',
      resource: 'moderation',
      resourceId: String(id),
      actorRole: context.role === 'user' ? 'citizen' : context.role,
      actorId: context.userId,
      actorName: actorLabel,
      requestId,
      success: true,
      metadata: { notes: notes || null },
    });
  }

  persistModerationLogs();
  void persistPostgresModerationReview(log).catch((error: unknown) => {
    console.error('postgres-moderation-review-persist-failed', error);
  });
  res.json({ success: true, log });
});

// Regra 4.7 do Regulamento de Bilhética: prazo da reserva temporária de
// bilhetes durante a confirmação do pagamento (15 minutos). Decorrido o prazo
// sem pagamento confirmado, a quantidade reservada é libertada.
const TICKET_RESERVATION_TTL_MS = 15 * 60 * 1000;

/**
 * Regra 4.7: liberta em memória as reservas de bilhetes cujo prazo expirou
 * sem pagamento confirmado, devolvendo a quantidade ao inventário.
 */
function releaseExpiredTicketReservationsInMemory(): void {
  const now = Date.now();
  const expiredIds = new Set<string>();
  for (const ticket of Array.from(ticketsDb.values())) {
    if (ticket?.status === 'pending' && ticket.reservedUntil && Date.parse(ticket.reservedUntil) < now) {
      expiredIds.add(ticket.id as string);
    }
  }
  if (expiredIds.size === 0) return;
  for (const [key, ticket] of Array.from(ticketsDb.entries())) {
    if (ticket && expiredIds.has(ticket.id as string)) ticketsDb.delete(key);
  }
  persistTickets();
  recordAudit({ action: 'ticket_reservation_released', resource: 'ticket', actorRole: 'system', requestId: `reservation-cleanup-${Date.now()}`, success: true, metadata: { released: expiredIds.size, ticketIds: Array.from(expiredIds) } });
}

// Varredura periódica da reserva (memória + base de dados) — Regra 4.7.
setInterval(() => {
  try {
    releaseExpiredTicketReservationsInMemory();
  } catch (error) {
    console.error('ticket-reservation-cleanup-failed', error);
  }
  if (databaseConfigured) {
    void releaseExpiredPostgresTicketReservations(Math.floor(TICKET_RESERVATION_TTL_MS / 60_000)).catch((error) => console.error('ticket-reservation-cleanup-db-failed', error));
  }
}, 60_000);

function ticketPurchaseHttpResponse(
  result: TicketPurchaseResult,
  requestId: string,
): { status: number; body: Record<string, unknown> } {
  if (result.status === 'confirmed') {
    const ticket = result.tickets[0];
    if (!ticket) throw new Error('A confirmação do pagamento não produziu bilhetes.');
    return {
      status: 200,
      body: {
        success: true,
        ticket,
        tickets: result.tickets,
        feeBreakdown: result.quote.feeBreakdown,
        quote: result.quote,
        transaction: result.transaction,
        sms: {
          mode: result.delivery.sms.mode,
          state: result.delivery.sms.state,
        },
        delivery: {
          email: result.delivery.email,
          notification: result.delivery.notification,
          sms: { state: result.delivery.sms.state, mode: result.delivery.sms.mode },
        },
      },
    };
  }

  if (result.status === 'pending') {
    return {
      status: 202,
      body: {
        success: false,
        paymentPending: true,
        transaction: result.transaction,
        reservationExpiresAt: result.reservationExpiresAt,
        message: result.transaction.paymentInstructions || 'Pagamento pendente. Os bilhetes ficam reservados até à confirmação da operadora.',
        requestId,
      },
    };
  }

  const status = result.reason === 'invalid_offer'
    ? 404
    : result.reason === 'inventory_unavailable'
      ? 409
      : result.reason === 'payment_failed'
        ? 502
        : 400;
  const code = result.reason === 'invalid_offer'
    ? 'TICKET_OFFER_NOT_FOUND'
    : result.reason === 'invalid_policy'
      ? 'TICKET_POLICY_REQUIRED'
      : result.reason === 'invalid_quantity'
        ? 'INVALID_TICKET_QUANTITY'
        : result.reason === 'payment_failed'
          ? 'TICKET_PAYMENT_FAILED'
          : 'TICKET_INVENTORY_UNAVAILABLE';

  return {
    status,
    body: {
      success: false,
      error: result.message,
      code,
      ...(result.transaction ? { transaction: result.transaction } : {}),
      requestId,
    },
  };
}

// Ticket Purchase API (Generates Ticket + Simulates SMS Notification)
app.post('/api/tickets/purchase', async (req, res) => {
  let idempotencyKey: string | undefined;
  let releaseIdempotencyLock: (() => void) | undefined;
  const requestId = requestIdFrom(req);
  try {
    // A compra exige sessão de cidadão; sem ela a resposta é 401, mesmo com
    // corpo inválido (a autenticação precede a validação).
    const purchaseSession = await sessionContext(req);
    if (!purchaseSession || purchaseSession.role !== 'user') {
      return res.status(401).json({ error: 'Inicie sessão para comprar bilhetes.', code: 'AUTHENTICATION_REQUIRED', requestId });
    }
    const validation = validatePurchaseInput({
      ...req.body,
      buyerName: 'Utilizador autenticado',
      buyerPhone: '+24500000000',
      priceXOF: req.body?.priceXOF ?? 5000,
    });
    if (!validation.ok) {
      recordAudit({
        action: 'purchase_validation_failed',
        resource: 'purchase',
        actorRole: 'citizen',
        requestId,
        success: false,
        metadata: { issues: validation.issues },
      });
      return res.status(400).json({
        error: firstIssueMessage(validation.issues, 'Dados de compra inválidos.'),
        code: 'VALIDATION_ERROR',
        issues: validation.issues,
        requestId,
      });
    }

    const account = await identityAccess.findById(purchaseSession.userId) || findDemoUserById(purchaseSession.userId);
    if (!account) {
      return res.status(401).json({ error: 'A conta da sessão não está disponível.', code: 'AUTHENTICATION_REQUIRED', requestId });
    }
    const buyerValidation = validatePurchaseInput({
      ...req.body,
      buyerName: account.name,
      buyerPhone: account.phone,
      priceXOF: req.body?.priceXOF ?? 5000,
    });
    if (!buyerValidation.ok) {
      return res.status(400).json({
        error: firstIssueMessage(buyerValidation.issues, 'Os dados da conta não permitem concluir a compra.'),
        code: 'VALIDATION_ERROR',
        issues: buyerValidation.issues,
        requestId,
      });
    }

    if (isProduction && !ticketSigningSecret) {
      return res.status(503).json({
        error: 'Emissão temporariamente indisponível: TICKET_SIGNING_SECRET não configurado.',
        code: 'TICKET_SECURITY_NOT_CONFIGURED',
        requestId,
      });
    }

    cleanupIdempotency();
    const requestIdempotencyKey = req.header('idempotency-key')?.trim();
    if (requestIdempotencyKey) {
      if (requestIdempotencyKey.length > 160) {
        return res.status(400).json({ error: 'Chave de idempotência inválida.', code: 'INVALID_IDEMPOTENCY_KEY', requestId });
      }
      idempotencyKey = `${purchaseSession.userId}:${requestIdempotencyKey}`;
      let previous = purchaseIdempotency.get(idempotencyKey);
      if (previous) return res.status(previous.status).json(previous.response);
      const pendingRequest = purchaseIdempotencyLocks.get(idempotencyKey);
      if (pendingRequest) {
        await pendingRequest;
        previous = purchaseIdempotency.get(idempotencyKey);
        if (previous) return res.status(previous.status).json(previous.response);
      }
      let resolveLock!: () => void;
      const lock = new Promise<void>((resolve) => { resolveLock = resolve; });
      purchaseIdempotencyLocks.set(idempotencyKey, lock);
      releaseIdempotencyLock = () => {
        if (purchaseIdempotencyLocks.get(idempotencyKey!) === lock) {
          purchaseIdempotencyLocks.delete(idempotencyKey!);
        }
        resolveLock();
      };
    }

    const {
      eventId,
      ticketTypeId,
      quantity: ticketQuantity,
      holderName,
      holderPhone,
      paymentMethod,
    } = buyerValidation.value!;
    const offer = await getTicketOffer(eventId, ticketTypeId);
    if (!offer) {
      return res.status(404).json({ error: 'O evento ou tipo de bilhete já não está disponível.', code: 'TICKET_OFFER_NOT_FOUND', requestId });
    }

    let monetizationCatalog = normaliseMonetizationCatalog(monetizationCatalogStore);
    try {
      const databaseTicketPolicy = await getLegacyTicketFeePolicy();
      if (databaseTicketPolicy) {
        monetizationCatalog = {
          ...monetizationCatalog,
          ticketFeePolicy: {
            ...monetizationCatalog.ticketFeePolicy,
            ...databaseTicketPolicy,
            feePayer: databaseTicketPolicy.feePayer as typeof monetizationCatalog.ticketFeePolicy.feePayer,
            billingModel: databaseTicketPolicy.billingModel as typeof monetizationCatalog.ticketFeePolicy.billingModel,
          },
        };
      }
    } catch (error) {
      console.error('[Guigui.com] Falha ao carregar a política de taxas de bilheteira:', error);
    }
    const quoteResult = quoteTicketPurchase({ offer, quantity: ticketQuantity, catalog: monetizationCatalog });
    if ('reason' in quoteResult) {
      const unavailable = quoteResult.reason === 'sold_out' || quoteResult.reason === 'insufficient_inventory';
      return res.status(unavailable ? 409 : 400).json({
        error: quoteResult.reason === 'sales_closed'
          ? 'As vendas deste tipo de bilhete estão encerradas.'
          : quoteResult.reason === 'invalid_quantity'
            ? 'A quantidade de bilhetes não é válida.'
            : 'Não há bilhetes suficientes disponíveis.',
        code: quoteResult.reason === 'invalid_quantity' ? 'INVALID_TICKET_QUANTITY' : 'TICKET_INVENTORY_UNAVAILABLE',
        requestId,
      });
    }
    if (req.body?.ticketTypeName !== undefined && req.body.ticketTypeName !== offer.ticketTypeName) {
      return res.status(409).json({ error: 'A categoria selecionada foi alterada. Actualize o checkout.', code: 'TICKET_TYPE_MISMATCH', requestId });
    }
    const submittedPrice = req.body?.pricePerTicketXOF ?? req.body?.priceXOF;
    if (submittedPrice !== undefined
      && (!Number.isSafeInteger(Number(submittedPrice)) || Number(submittedPrice) !== offer.unitPriceXOF)) {
      return res.status(409).json({ error: 'O preço do bilhete foi alterado. Actualize o checkout.', code: 'TICKET_PRICE_MISMATCH', requestId });
    }
    const ticketFeeBreakdown = quoteResult.quote.feeBreakdown;
    const chargedAmountXOF = quoteResult.quote.buyerTotalXOF;
    if (req.body?.chargedAmountXOF !== undefined && Number(req.body.chargedAmountXOF) !== chargedAmountXOF) {
      return res.status(409).json({ error: 'O total do checkout não corresponde à política de taxas actual.', code: 'TICKET_TOTAL_MISMATCH', expectedAmountXOF: chargedAmountXOF, requestId });
    }

    const catalogSettings = monetizationCatalog;
    const result = await executeTicketPurchase({
      buyer: {
        userId: purchaseSession.userId,
        name: account.name,
        phone: account.phone,
        email: account.email,
      },
      eventId,
      ticketTypeId,
      quantity: ticketQuantity,
      holderName,
      holderPhone,
      paymentMethod,
      policyAccepted: buyerValidation.value!.policyAccepted,
      policyVersion: buyerValidation.value!.policyVersion,
      policyAcceptedAt: buyerValidation.value!.policyAcceptedAt,
      idempotencyKey,
    }, {
      catalog: { getOffer: async () => offer },
      inventory: ticketInventory,
      tickets: {
        async issue(reservationId, tickets, buyerUserId) {
          for (const ticket of tickets) {
            ticketsDb.set(ticket.qrToken, ticket);
            if (ticket.pinCode) ticketsDb.set(ticket.pinCode, ticket);
            ticketsDb.set(ticket.ticketCode, ticket);
          }
          await persistPostgresTickets(tickets, buyerUserId);
          persistTickets();
          return tickets;
        },
      },
      idempotency: {
        async get(key) {
          return purchaseIdempotency.get(key)?.result || null;
        },
        async store(key, storedResult) {
          const response = ticketPurchaseHttpResponse(storedResult, requestId);
          purchaseIdempotency.set(key, {
            createdAt: Date.now(),
            result: storedResult,
            response: response.body,
            status: response.status,
          });
        },
      },
      payments: paymentAdapters,
      ticketFactory({ offer: purchaseOffer, buyer, quantity, holderName: purchaseHolderName, holderPhone: purchaseHolderPhone, paymentMethod: purchasePaymentMethod, purchasedAt, feeSnapshot }) {
        return Array.from({ length: quantity }, (_, index) => {
          const { ticketCode, qrToken, pinCode } = generateTicketIdentifiers();
          const ticket: TicketForValidation = {
            id: `TKT-${Date.now()}-${index + 1}-${randomBytes(2).toString('hex').toUpperCase()}`,
            ticketCode,
            ticketTypeId: purchaseOffer.ticketTypeId,
            buyerUserId: buyer.userId,
            eventId: purchaseOffer.eventId,
            ...(purchaseOffer.businessId ? { businessId: purchaseOffer.businessId } : {}),
            eventTitle: purchaseOffer.eventTitle,
            ticketTypeName: purchaseOffer.ticketTypeName,
            priceXOF: purchaseOffer.unitPriceXOF,
            buyerName: buyer.name,
            buyerPhone: buyer.phone,
            ...(purchaseHolderName && purchaseHolderPhone
              ? { holderName: purchaseHolderName, holderPhone: purchaseHolderPhone }
              : {}),
            qrToken,
            pinCode,
            status: 'valid',
            purchasedAt,
            expiresAt: calculateTicketExpiry(purchaseOffer.eventDate, purchaseOffer.eventTime),
            paymentMethod: purchasePaymentMethod,
            fee: ticketFeeSnapshotForUnit(feeSnapshot, index, quantity),
          };
          if (ticketSigningSecret) ticket.signature = signTicket(ticket, ticketSigningSecret);
          return ticket;
        });
      },
      transactions: {
        async persist(transaction) {
          const existing = paymentTransactions.find((item) => item.id === transaction.id);
          if (existing) Object.assign(existing, transaction);
          else paymentTransactions.push(transaction);
          persistPayments();
          // A central financeira lê a base de dados, não o ficheiro local. A
          // primeira gravação de uma cobrança confirmada acontece antes da
          // emissão dos bilhetes; nesse caso o serviço adia-a até existir a
          // ligação pedido → evento → empresa.
          await persistPostgresPayment({
            ...transaction,
            ticketIds: transaction.ticketIds,
            eventId: transaction.ticketDraft?.eventId,
            companyId: transaction.businessId,
            buyerUserId: transaction.ticketDraft?.buyerUserId,
          });
        },
        async recordFulfillment(transaction) {
          recordMonetizationFulfillment(transaction);
        },
      },
      async delivery(input) {
        return deliverConfirmedTicketPurchase({
          transactionId: input.transactionId,
          accountUserId: input.accountUserId,
          accountEmail: input.accountEmail,
          accountName: input.accountName,
          eventId: input.eventId,
          eventTitle: input.eventTitle,
          totalAmountXOF: input.totalAmountXOF,
          tickets: input.tickets,
        }, { email: emailDelivery, sms: smsDelivery });
      },
      catalogSettings,
      createTransactionId: () => `TXN-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`,
      reservationTtlMs: TICKET_RESERVATION_TTL_MS,
      now: () => new Date(),
    });

    const cachedResponse = idempotencyKey ? purchaseIdempotency.get(idempotencyKey) : undefined;
    const httpResponse = cachedResponse
      ? { status: cachedResponse.status, body: cachedResponse.response }
      : ticketPurchaseHttpResponse(result, requestId);

    if (result.status === 'pending') {
      recordAudit({
        action: 'ticket_payment_pending',
        resource: 'payment',
        resourceId: result.transaction.id,
        actorRole: 'citizen',
        requestId,
        success: true,
        metadata: {
          provider: result.transaction.provider,
          providerRef: result.transaction.providerRef,
          reservedUntil: result.reservationExpiresAt,
        },
      });
    } else if (result.status === 'confirmed') {
      const ticket = result.tickets[0];
      if (!ticket) throw new Error('A confirmação do pagamento não produziu bilhetes.');
      recordAudit({
        action: 'ticket_sms_dispatch',
        resource: 'ticket',
        resourceId: result.transaction.id,
        actorRole: 'system',
        requestId,
        success: result.delivery.sms.state !== 'failed',
        metadata: {
          mode: result.delivery.sms.mode,
          state: result.delivery.sms.state,
          referenceCount: result.delivery.sms.references.length,
          emailState: result.delivery.email.state,
          notificationState: result.delivery.notification.state,
        },
      });
      recordAudit({
        action: 'ticket_issued',
        resource: 'ticket',
        resourceId: result.transaction.id,
        actorRole: 'citizen',
        requestId,
        success: true,
        metadata: {
          eventId: ticket.eventId,
          paymentMethod: ticket.paymentMethod,
          amountXOF: result.transaction.amountXOF,
          ticketIds: result.tickets.map((issuedTicket) => issuedTicket.id),
        },
      });
    }

    return res.status(httpResponse.status).json(httpResponse.body);
  } catch (error) {
    console.error('ticket-purchase-failed', {
      requestId,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
    return res.status(500).json({ error: 'Não foi possível concluir a compra do bilhete.', code: 'TICKET_PURCHASE_FAILED', requestId });
  } finally {
    releaseIdempotencyLock?.();
  }
});

app.get('/api/tickets/mine', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  const tickets = databaseConfigured
    ? await listPostgresTicketsForUser(context.userId)
    : listOwnedTickets(ticketsDb.values() as Iterable<TicketForValidation>, context.userId);
  res.json({ tickets });
});

// Guest ticket recovery. It requires both phone and the ticket PIN/code and never reveals whether a phone has tickets.
app.post('/api/tickets/lookup', async (req, res) => {
  const requestId = requestIdFrom(req);
  const phone = normalizeLookupPhone(req.body?.phone);
  const recoveryCode = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
  if (phone.length < 8 || recoveryCode.length < 4 || recoveryCode.length > 64) {
    return res.status(400).json({ success: false, code: 'INVALID_LOOKUP_INPUT', message: 'Introduza um telemóvel e o código do bilhete.', requestId });
  }
  if (!await allowTicketLookup(phone)) {
    recordAudit({ action: 'ticket_lookup_rate_limited', resource: 'ticket', actorRole: 'citizen', requestId, success: false });
    return res.status(429).json({ success: false, code: 'LOOKUP_RATE_LIMITED', message: 'Demasiadas tentativas. Tente novamente mais tarde.', requestId });
  }
  const ticket = databaseConfigured
    ? await findPostgresTicket(recoveryCode, phone)
    : (Array.from(new Map(Array.from(ticketsDb.values()).map((ticket: any) => [ticket.id, ticket])).values()) as TicketForValidation[]).find((candidate) => (normalizeLookupPhone(candidate.buyerPhone) === phone || normalizeLookupPhone(candidate.holderPhone) === phone) && (String(candidate.pinCode || '').toUpperCase() === recoveryCode || String(candidate.ticketCode || '').toUpperCase() === recoveryCode));
  if (!ticket) {
    recordAudit({ action: 'ticket_lookup_failed', resource: 'ticket', actorRole: 'citizen', requestId, success: false });
    return res.status(404).json({ success: false, code: 'TICKET_NOT_FOUND', message: 'Não foi possível localizar um bilhete com os dados fornecidos.', requestId });
  }
  recordAudit({ action: 'ticket_lookup_success', resource: 'ticket', resourceId: ticket.id, actorRole: 'citizen', requestId, success: true });
  return res.json({ success: true, ticket: { id: ticket.id, ticketCode: ticket.ticketCode, eventId: ticket.eventId, eventTitle: ticket.eventTitle, ticketTypeName: ticket.ticketTypeName, buyerName: ticket.buyerName, buyerPhone: ticket.buyerPhone, status: ticket.status, purchasedAt: ticket.purchasedAt, expiresAt: ticket.expiresAt, viewPath: `/bilhete/${encodeURIComponent(ticket.qrToken)}` }, requestId });
});

// Reenvio de SMS com cooldown e limite diário, atualmente sempre simulado.
app.post('/api/tickets/resend-sms', async (req, res) => {
  const requestId = requestIdFrom(req);
  const phone = normalizeLookupPhone(req.body?.phone);
  const recoveryCode = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
  if (phone.length < 8 || recoveryCode.length < 4 || recoveryCode.length > 64) return res.status(400).json({ success: false, code: 'INVALID_SMS_INPUT', message: 'Introduza o telemóvel e o código do bilhete.', requestId });
  const uniqueTickets = Array.from(new Map(Array.from(ticketsDb.values()).map((ticket: any) => [ticket.id, ticket])).values()) as TicketForValidation[];
  const ticket = uniqueTickets.find((candidate) => (normalizeLookupPhone(candidate.buyerPhone) === phone || normalizeLookupPhone(candidate.holderPhone) === phone) && (String(candidate.pinCode || '').toUpperCase() === recoveryCode || String(candidate.ticketCode || '').toUpperCase() === recoveryCode));
  if (!ticket) {
    recordAudit({ action: 'ticket_sms_resend_failed', resource: 'ticket', actorRole: 'citizen', requestId, success: false });
    return res.status(404).json({ success: false, code: 'TICKET_NOT_FOUND', message: 'Não foi possível localizar um bilhete com os dados fornecidos.', requestId });
  }
  const now = Date.now();
  const dayKey = new Date(now).toISOString().slice(0, 10);
  const key = `${phone}:${ticket.id}`;
  const current = smsResendWindows.get(key);
  if (current && now - current.lastSentAt < SMS_RESEND_COOLDOWN_MS) return res.status(429).json({ success: false, code: 'SMS_COOLDOWN', message: 'Aguarde 60 segundos antes de pedir novo envio.', retryAfterSeconds: Math.ceil((SMS_RESEND_COOLDOWN_MS - (now - current.lastSentAt)) / 1000), requestId });
  const count = current?.dayKey === dayKey ? current.count : 0;
  if (count >= SMS_RESEND_DAILY_MAX) return res.status(429).json({ success: false, code: 'SMS_DAILY_LIMIT', message: 'O limite diário de reenvios foi atingido.', requestId });
  smsResendWindows.set(key, { lastSentAt: now, dayKey, count: count + 1 });
  const resendMessage = `[Guigui.com] Reenvio do seu bilhete ${ticket.ticketCode} para ${ticket.eventTitle || 'o evento'}. Código: ${ticket.ticketCode}.`;
  const resendDelivery = await smsDelivery.send({ to: phone, text: resendMessage, reference: `resend-${ticket.id}` });
  recordAudit({
    action: 'ticket_sms_resend_requested',
    resource: 'ticket',
    resourceId: ticket.id,
    actorRole: 'citizen',
    requestId,
    success: true,
    metadata: { mode: resendDelivery.mode, state: resendDelivery.state, attempt: count + 1, reference: resendDelivery.reference },
  });
  return res.json({
    success: true,
    simulated: true,
    smsState: resendDelivery.state,
    mode: resendDelivery.mode,
    message: 'Pedido de reenvio registado em modo simulado; o SMS não foi enviado.',
    delivery: { ticketLink: `/bilhete/${encodeURIComponent(ticket.qrToken)}`, pinSent: false },
    requestId,
  });
});

// ============================================================================
app.get('/api/tickets/sold', requireRole('business', 'admin'), async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  const stored = context.role === 'business'
    ? (await identityAccess.findById(context.userId) || undefined)
    : null;
  const companyId = context.role === 'admin'
    ? (typeof req.query.companyId === 'string' ? req.query.companyId : undefined)
    : stored?.businessId;
  if (context.role === 'business' && !companyId) {
    return res.status(403).json({ error: 'A sua conta não está associada a uma empresa.', code: 'BUSINESS_ACCOUNT_REQUIRED' });
  }
  const eventId = typeof req.query.eventId === 'string' && req.query.eventId.trim() ? req.query.eventId.trim() : undefined;
  // A vista é paginada por natureza: pede-se um registo a mais do que o limite
  // para conseguir sinalizar truncagem (nunca devolver dados parciais sem aviso).
  const TICKET_LIST_LIMIT = 500;
  const fetched = companyId && databaseConfigured
    ? await listPostgresTicketsForCompany(companyId, eventId, TICKET_LIST_LIMIT + 1)
    : [];
  const truncated = fetched.length > TICKET_LIST_LIMIT;
  const tickets = truncated ? fetched.slice(0, TICKET_LIST_LIMIT) : fetched;
  const totals = tickets.reduce((acc, ticket) => {
    acc.total += 1;
    if (ticket.status === 'valid') acc.valid += 1;
    if (ticket.status === 'used') acc.used += 1;
    if (ticket.status === 'cancelled') acc.cancelled += 1;
    if (ticket.status === 'pending') acc.pending += 1;
    if (ticket.refundStatus) acc.refunded += 1;
    // Regra 12: só bilhetes emitidos e pagos (valid/used) contam como receita —
    // reservas pendentes (Regra 4.7) e cancelamentos ficam de fora.
    acc.revenueXOF += ticket.status === 'valid' || ticket.status === 'used' ? ticket.priceXOF : 0;
    return acc;
  }, { total: 0, valid: 0, used: 0, cancelled: 0, pending: 0, refunded: 0, revenueXOF: 0 });
  res.json({ tickets, totals, limit: TICKET_LIST_LIMIT, truncated });
});
// Exportação CSV da lista de compradores de um evento. A agregação (quantidade,
// tipos e total por comprador) é feita na base de dados, sem o limite de 500 da
// vista paginada, e o browser só descarrega o ficheiro pronto.
app.get('/api/tickets/sold/export', requireRole('business', 'admin'), async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  const stored = context.role === 'business'
    ? (await identityAccess.findById(context.userId) || undefined)
    : null;
  const companyId = context.role === 'admin'
    ? (typeof req.query.companyId === 'string' ? req.query.companyId : undefined)
    : stored?.businessId;
  if (context.role === 'business' && !companyId) {
    return res.status(403).json({ error: 'A sua conta não está associada a uma empresa.', code: 'BUSINESS_ACCOUNT_REQUIRED' });
  }
  if (!companyId) {
    return res.status(400).json({ error: 'Indique a empresa (companyId) a exportar.', code: 'COMPANY_REQUIRED' });
  }
  const eventId = typeof req.query.eventId === 'string' && req.query.eventId.trim() ? req.query.eventId.trim() : undefined;

  const aggregated = databaseConfigured ? await exportPostgresTicketsByBuyer(companyId, eventId) : [];
  // Sem `eventId` a exportação cobre todos os eventos da empresa: cada linha é
  // por comprador E por evento, com uma coluna extra com o nome do evento.
  const includeEventColumn = !eventId;
  type BuyerLine = {
    name: string;
    phone: string;
    eventId: string;
    eventTitle: string;
    quantity: number;
    types: Map<string, number>;
    totalXOF: number;
    paid: boolean;
    pending: boolean;
    cancelled: boolean;
  };
  const buyers = new Map<string, BuyerLine>();
  for (const row of aggregated) {
    const key = `${row.eventId}|${row.buyerName.toLowerCase()}|${row.buyerPhone}`;
    const line = buyers.get(key) || {
      name: row.buyerName,
      phone: row.buyerPhone,
      eventId: row.eventId,
      eventTitle: row.eventTitle,
      quantity: 0,
      types: new Map<string, number>(),
      totalXOF: 0,
      paid: false,
      pending: false,
      cancelled: false,
    };
    line.quantity += row.quantity;
    line.totalXOF += row.totalXOF;
    line.paid = line.paid || row.paid;
    line.pending = line.pending || row.pending;
    line.cancelled = line.cancelled || row.cancelled;
    line.types.set(row.ticketTypeName, (line.types.get(row.ticketTypeName) || 0) + row.quantity);
    buyers.set(key, line);
  }

  const statusLabel = (line: BuyerLine) => {
    const parts: string[] = [];
    if (line.paid) parts.push('Pago');
    if (line.pending) parts.push('Pendente');
    if (line.cancelled) parts.push('Cancelado');
    return parts.join(' + ') || '—';
  };
  const cell = (value: string | number) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const lines = Array.from(buyers.values())
    .sort((left, right) => left.name.localeCompare(right.name, 'pt') || left.eventTitle.localeCompare(right.eventTitle, 'pt'))
    .map((line) => [
      line.name,
      line.phone || '—',
      ...(includeEventColumn ? [line.eventTitle] : []),
      line.quantity,
      Array.from(line.types.entries()).map(([type, count]) => `${type} x${count}`).join(' + '),
      line.totalXOF,
      statusLabel(line),
    ].map(cell).join(';'));
  const header = includeEventColumn
    ? '"Comprador";"Telefone";"Evento";"Bilhetes";"Tipos de bilhete";"Total pago (XOF)";"Estado"'
    : '"Comprador";"Telefone";"Bilhetes";"Tipos de bilhete";"Total pago (XOF)";"Estado"';
  const csv = [header, ...lines].join('\r\n');

  const eventTitle = eventId && databaseConfigured
    ? await findPostgresEventTitleForCompany(companyId, eventId)
    : null;
  const slug = (eventTitle || (includeEventColumn ? 'todos-os-eventos' : 'compradores'))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 60) || 'compradores';
  const filename = `compradores-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(`\uFEFF${csv}`);
});

// Cancelamento operacional pela empresa organizadora (ou administração).
// A empresa vem da sessão; o id do bilhete no corpo só é lido depois de
// confirmada a associação da conta a uma empresa.
app.post('/api/tickets/cancel', requireRole('business', 'admin'), async (req, res) => {
  const requestId = requestIdFrom(req);
  const context = await sessionContext(req);
  if (!context) {
    return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  }

  const stored = context.role === 'business'
    ? (await identityAccess.findById(context.userId) || undefined)
    : undefined;
  const companyId = context.role === 'admin'
    ? (typeof req.body?.companyId === 'string' ? req.body.companyId.trim() : '')
    : stored?.businessId;
  if (context.role === 'business' && !companyId) {
    return res.status(403).json({ error: 'A sua conta não está associada a uma empresa.', code: 'BUSINESS_ACCOUNT_REQUIRED' });
  }

  const ticketReference = typeof req.body?.id === 'string' ? req.body.id.trim() : '';
  if (!ticketReference) {
    return res.status(400).json({ error: 'Indique o bilhete a cancelar.', code: 'TICKET_ID_REQUIRED', requestId });
  }
  if (!databaseConfigured) {
    return res.status(503).json({ error: 'O cancelamento exige base de dados configurada.', code: 'DATABASE_REQUIRED', requestId });
  }

  const ticket = await findPostgresTicketForLifecycle(ticketReference);
  if (!ticket) {
    return res.status(404).json({ error: 'Bilhete não encontrado.', code: 'TICKET_NOT_FOUND', requestId });
  }
  if (context.role !== 'admin' && ticket.companyId !== companyId) {
    recordAudit({ action: 'ticket_cancel_denied', resource: 'ticket', resourceId: ticket.id, actorRole: 'business', requestId, success: false });
    return res.status(403).json({ error: 'O bilhete pertence a outra empresa.', code: 'PERMISSION_DENIED', requestId });
  }

  const reason = typeof req.body?.reason === 'string' ? req.body.reason.trim() : '';
  const cancelled = await cancelPostgresTicket(
    ticket.id,
    reason || (context.role === 'admin' ? 'Cancelado pela administração.' : 'Cancelado pela empresa organizadora.'),
  );
  if (!cancelled) {
    return res.status(409).json({ error: 'O bilhete já foi usado, cancelado ou não está válido.', code: 'TICKET_NOT_CANCELLABLE', requestId });
  }

  recordAudit({
    action: 'ticket_cancelled',
    resource: 'ticket',
    resourceId: ticket.id,
    actorRole: context.role === 'admin' ? 'admin' : 'business',
    requestId,
    success: true,
    metadata: { reason: reason || null },
  });
  return res.json({ success: true, ticketId: ticket.id, status: 'cancelled', requestId });
});

// Scanner authorization endpoint. The frontend must not decide access locally.
app.post('/api/tickets/scanner-auth', requireRole('business'), async (req, res) => {
  const requestId = requestIdFrom(req);
  const eventId = typeof req.body?.eventId === 'string' ? req.body.eventId.trim() : '';
  const businessId = typeof req.body?.businessId === 'string' ? req.body.businessId.trim() : '';
  // O código de portaria é a primeira barreira: inválido responde sempre 403.
  if (!matchesScannerDoorCode(req.body?.doorCode)) {
    recordAudit({ action: 'scanner_login_denied', resource: 'scanner', actorRole: 'scanner', requestId, success: false });
    return res.status(403).json({ authorized: false, code: 'SCANNER_UNAUTHORIZED', message: 'Código de portaria inválido.', requestId });
  }
  if (!eventId || !businessId) {
    recordAudit({ action: 'scanner_login_denied', resource: 'scanner', actorRole: 'scanner', requestId, success: false, metadata: { reason: 'missing_scope' } });
    return res.status(400).json({ authorized: false, code: 'SCANNER_SCOPE_REQUIRED', message: 'O scanner deve indicar o evento e a empresa organizadora.', requestId });
  }
  const context = await sessionContext(req);
  const storedBusinessUser = context ? await identityAccess.findById(context.userId) || undefined : undefined;
  const scope = resolveBusinessScope(context?.role, storedBusinessUser?.businessId, businessId);
  if (scope.allowed === false) {
    recordAudit({ action: 'scanner_login_denied', resource: 'scanner', actorRole: 'scanner', actorId: context?.userId, requestId, success: false, metadata: { reason: scope.code } });
    return res.status(scope.status).json({ authorized: false, code: 'BUSINESS_SCOPE_REQUIRED', message: 'A empresa indicada não pertence à conta autenticada.', requestId });
  }
  recordAudit({ action: 'scanner_login_authorized', resource: 'scanner', actorRole: 'scanner', requestId, success: true });
  return res.json({ authorized: true, code: 'SCANNER_AUTHORIZED', requestId });
});
/**
 * Manifesto offline do scanner (GUI-3.5.09). Descarregado antes de a equipa
 * ficar sem rede, contém apenas os bilhetes válidos do evento.
 */
app.post('/api/tickets/offline-manifest', requireRole('business'), async (req, res) => {
  const requestId = requestIdFrom(req);
  const eventId = typeof req.body?.eventId === 'string' ? req.body.eventId.trim() : '';
  const doorCode = typeof req.body?.doorCode === 'string' ? req.body.doorCode : '';
  if (!matchesScannerDoorCode(doorCode)) {
    recordAudit({ action: 'scanner_manifest_denied', resource: 'scanner', actorRole: 'scanner', requestId, success: false });
    return res.status(403).json({ error: 'Scanner não autorizado.', code: 'SCANNER_UNAUTHORIZED' });
  }
  if (!eventId) return res.status(400).json({ error: 'Indique o evento.', code: 'SCANNER_SCOPE_REQUIRED' });
  if (!ticketSigningSecret) return res.status(503).json({ error: 'Assinatura de bilhetes não configurada.', code: 'TICKET_SIGNING_UNAVAILABLE' });

  // A empresa organizadora vem da sessão, nunca do corpo do pedido.
  const context = await sessionContext(req);
  const stored = context ? await identityAccess.findById(context.userId) || undefined : undefined;
  const sessionBusinessId = stored?.businessId || '';
  if (!sessionBusinessId) {
    recordAudit({ action: 'scanner_manifest_denied', resource: 'scanner', actorRole: 'scanner', actorId: context?.userId, requestId, success: false, metadata: { reason: 'missing_business' } });
    return res.status(403).json({ error: 'A conta não está associada a uma empresa.', code: 'BUSINESS_ACCOUNT_REQUIRED' });
  }
  const ownedEvent = (await listPostgresEvents()).find((candidate) => candidate.id === eventId && candidate.businessId === sessionBusinessId);
  if (!ownedEvent) {
    recordAudit({ action: 'scanner_manifest_denied', resource: 'scanner', actorRole: 'scanner', actorId: context?.userId, requestId, success: false, metadata: { reason: 'event_scope_mismatch', eventId } });
    return res.status(403).json({ error: 'O evento indicado não pertence à sua empresa.', code: 'EVENT_SCOPE_REQUIRED' });
  }
  const manifest = await buildOfflineManifest(eventId, sessionBusinessId, ticketSigningSecret);
  recordAudit({ action: 'scanner_manifest_downloaded', resource: 'scanner', actorRole: 'scanner', actorId: context?.userId, requestId, success: true, metadata: { eventId, tickets: manifest.tickets.length } });
  res.json({ manifest, requestId });
});

/**
 * Sincroniza as entradas validadas offline (GUI-3.5.10). O servidor é a
 * autoridade e devolve os casos de duplicação para o scanner corrigir.
 */
app.post('/api/tickets/validate-batch', requireRole('business'), async (req, res) => {
  const requestId = requestIdFrom(req);
  const doorCode = typeof req.body?.doorCode === 'string' ? req.body.doorCode : '';
  const records = Array.isArray(req.body?.records) ? req.body.records : [];
  if (!matchesScannerDoorCode(doorCode)) {
    recordAudit({ action: 'scanner_batch_denied', resource: 'scanner', actorRole: 'scanner', requestId, success: false });
    return res.status(403).json({ error: 'Scanner não autorizado.', code: 'SCANNER_UNAUTHORIZED' });
  }
  if (records.length === 0) return res.json({ outcomes: [], duplicates: 0, requestId });
  if (records.length > 2000) return res.status(413).json({ error: 'Lote demasiado grande.', code: 'BATCH_TOO_LARGE' });

  // O lote só pode marcar bilhetes da empresa autenticada.
  const context = await sessionContext(req);
  const stored = context ? await identityAccess.findById(context.userId) || undefined : undefined;
  if (!stored?.businessId) {
    recordAudit({ action: 'scanner_batch_denied', resource: 'scanner', actorRole: 'scanner', actorId: context?.userId, requestId, success: false, metadata: { reason: 'missing_business' } });
    return res.status(403).json({ error: 'A conta não está associada a uma empresa.', code: 'BUSINESS_ACCOUNT_REQUIRED' });
  }
  const outcomes = await syncOfflineValidations(records as OfflineValidationRecord[], stored.businessId);
  const duplicates = outcomes.filter((outcome) => outcome.result !== 'accepted').length;
  recordAudit({ action: 'scanner_batch_synced', resource: 'scanner', actorRole: 'scanner', requestId, success: true, metadata: { total: outcomes.length, duplicates } });
  res.json({ outcomes, duplicates, requestId });
});

// Door Scanner API (Validates Ticket via QR Code or 4-digit PIN)
app.post('/api/tickets/validate', requireRole('business'), async (req, res) => {
  try {
    const requestId = requestIdFrom(req);
    const { codeOrToken, doorCode } = req.body;
    const eventId = typeof req.body?.eventId === 'string' ? req.body.eventId.trim() : '';
    const businessId = typeof req.body?.businessId === 'string' ? req.body.businessId.trim() : '';

    // O código de portaria é a primeira barreira: inválido responde sempre 403.
    if (!matchesScannerDoorCode(doorCode)) {
      recordAudit({ action: 'scanner_denied', resource: 'ticket', actorRole: 'scanner', requestId, success: false });
      return res.status(403).json({ valid: false, status: 'unauthorized_scanner', code: 'SCANNER_UNAUTHORIZED', message: 'Scanner não autorizado para validar bilhetes.', requestId });
    }

    if (!eventId || !businessId) {
      recordAudit({ action: 'scanner_denied', resource: 'ticket', actorRole: 'scanner', requestId, success: false, metadata: { reason: 'missing_scope' } });
      return res.status(400).json({ valid: false, status: 'unauthorized_scanner', code: 'SCANNER_SCOPE_REQUIRED', message: 'A validação exige o evento e a empresa organizadora.', requestId });
    }

    // A empresa organizadora tem de ser a da sessão; o cliente não pode
    // validar (nem consumir) bilhetes de outra empresa.
    const context = await sessionContext(req);
    const storedBusinessUser = context ? await identityAccess.findById(context.userId) || undefined : undefined;
    const scope = resolveBusinessScope(context?.role, storedBusinessUser?.businessId, businessId);
    if (scope.allowed === false) {
      recordAudit({ action: 'scanner_denied', resource: 'ticket', actorRole: 'scanner', actorId: context?.userId, requestId, success: false, metadata: { reason: scope.code, eventId } });
      return res.status(scope.status).json({ valid: false, status: 'unauthorized_scanner', code: 'BUSINESS_SCOPE_REQUIRED', message: 'A empresa indicada não pertence à conta autenticada.', requestId });
    }
    if (typeof codeOrToken !== 'string' || !codeOrToken.trim() || codeOrToken.length > 512) {
      recordAudit({ action: 'ticket_validation_rejected', resource: 'ticket', actorRole: 'scanner', requestId, success: false, metadata: { reason: 'invalid_input' } });
      return res.status(400).json({ valid: false, code: 'INVALID_TICKET_INPUT', message: 'Código ou QR Token inválido.', requestId });
    }

    const cleanInput = normalizeScannerLookup(codeOrToken);
    const foundTicket = await findTicketByLookup(cleanInput);

    if (!foundTicket) {
      recordAudit({ action: 'ticket_not_found', resource: 'ticket', actorRole: 'scanner', requestId, success: false, metadata: { lookup: cleanInput.slice(0, 80) } });
      return res.status(404).json({
        valid: false,
        status: 'invalid',
        code: 'TICKET_NOT_FOUND',
        message: 'BILHETE INVÁLIDO OU NÃO ENCONTRADO NO SISTEMA',
        requestId,
      });
    }

    if (foundTicket.eventId !== eventId || foundTicket.businessId !== businessId) {
      recordAudit({ action: 'ticket_scope_mismatch', resource: 'ticket', resourceId: foundTicket.id, actorRole: 'scanner', requestId, success: false, metadata: { eventId, businessId } });
      return res.status(403).json({ valid: false, status: 'scope_mismatch', code: 'TICKET_SCOPE_MISMATCH', message: 'Este bilhete não pertence ao evento ou à empresa seleccionada.', requestId });
    }

    const ticketValidation = validateTicketForEntry(foundTicket as TicketForValidation, {
      production: isProduction,
      signingSecret: ticketSigningSecret,
    });
    const securityIssue = ticketValidation.issues.find((item) => ['invalid_signature', 'unsigned_ticket', 'missing_ticket_secret', 'expired_ticket', 'invalid_status', 'pending_ticket'].includes(item.code));
    if (securityIssue) {
      recordAudit({ action: 'ticket_validation_rejected', resource: 'ticket', resourceId: foundTicket.id, actorRole: 'scanner', requestId, success: false, metadata: { reason: securityIssue.code } });
      return res.status(securityIssue.code === 'expired_ticket' ? 410 : 422).json({ valid: false, status: securityIssue.code, code: 'TICKET_SECURITY_VALIDATION_FAILED', message: securityIssue.message, requestId });
    }

    if (foundTicket.status === 'used') {
      recordAudit({ action: 'ticket_reuse_blocked', resource: 'ticket', resourceId: foundTicket.id, actorRole: 'scanner', requestId, success: false });
      return res.status(409).json({
        valid: false,
        status: 'already_used',
        code: 'TICKET_ALREADY_USED',
        message: `BILHETE JÁ UTILIZADO em ${new Date(foundTicket.validatedAt).toLocaleTimeString('pt-PT')}`,
        ticket: foundTicket,
        requestId,
      });
    }

    if (foundTicket.status === 'cancelled') {
      recordAudit({ action: 'cancelled_ticket_blocked', resource: 'ticket', resourceId: foundTicket.id, actorRole: 'scanner', requestId, success: false });
      return res.status(400).json({
        valid: false,
        status: 'cancelled',
        code: 'TICKET_CANCELLED',
        message: 'BILHETE CANCELADO / REEMBOLSADO',
        ticket: foundTicket,
        requestId,
      });
    }

    // Mark as used instantly after all validations pass.
    if (databaseConfigured) {
      if (!(await markPostgresTicketUsed(foundTicket.id))) {
        return res.status(409).json({ valid: false, status: 'already_used', code: 'TICKET_ALREADY_USED', message: 'Este bilhete já foi utilizado ou expirou.', requestId });
      }
    }
    foundTicket.status = 'used';
    foundTicket.validatedAt = new Date().toISOString();
    persistTickets();
    recordAudit({ action: 'ticket_validated', resource: 'ticket', resourceId: foundTicket.id, actorRole: 'scanner', requestId, success: true, metadata: { lookupType: foundTicket.qrToken === cleanInput ? 'qr' : foundTicket.pinCode === cleanInput ? 'pin' : 'ticket_code' } });

    res.json({
      valid: true,
      status: 'success',
      code: 'TICKET_VALIDATED',
      message: 'ENTRADA PERMITIDA! BILHETE VÁLIDO',
      ticket: foundTicket,
      requestId,
    });
  } catch (err: any) {
    res.status(500).json({ valid: false, message: 'Erro no servidor de validação', details: err.message });
  }
});

// Payment Transactions Store (Section 10)
const paymentTransactions: any[] = [
  {
    id: 'TXN-2026-9011',
    useCase: 'subscription_initial',
    useCaseLabel: 'Subscrição Plano Profissional (1 Ano)',
    businessId: 'biz-1',
    businessName: 'Restaurant Coqueiros',
    payerName: 'Mamadu Djaló',
    payerPhone: '+245 955 12 34 56',
    amountXOF: 35000,
    provider: 'orange_money',
    providerRef: 'OM-2026-88192',
    status: 'confirmed_api',
    isApiIntegrationReady: false,
    createdAt: '2026-08-01 10:15',
    confirmedAt: '2026-08-01 10:16',
    confirmedBy: 'Orange Money Push API (Sandbox)',
  },
  {
    id: 'TXN-2026-9012',
    useCase: 'extra_posts',
    useCaseLabel: 'Pacote Extra +10 Posts Sociais',
    businessId: 'biz-2',
    businessName: 'Hotel Coqueiros Bissau',
    payerName: 'Soraia Gomes',
    payerPhone: '+245 966 44 33 22',
    amountXOF: 15000,
    provider: 'telecel',
    providerRef: 'TEL-245-00918',
    status: 'pending_manual_confirmation',
    isApiIntegrationReady: false,
    manualProofReference: 'Ref. SMS Telecel: 772819001 - Enviado para +245 966 00 00',
    createdAt: '2026-08-04 14:20',
  },
  {
    id: 'TXN-2026-9013',
    useCase: 'event_tickets',
    useCaseLabel: 'Compra de 2 Bilhetes VIP Festival de Bissau',
    businessId: 'biz-1',
    businessName: 'Bar Restaurant Coqueiros',
    payerName: 'Adama Baldé',
    payerPhone: '+245 955 99 88 77',
    amountXOF: 10000,
    provider: 'orange_money',
    providerRef: 'OM-2026-99201',
    status: 'confirmed_api',
    isApiIntegrationReady: false,
    createdAt: '2026-08-04 16:05',
    confirmedAt: '2026-08-04 16:05',
    confirmedBy: 'Orange Money Push API (Sandbox)',
  },
];

const persistedPaymentTransactions = loadJson<any[]>('payments.json', []);
if (persistedPaymentTransactions.length > 0) {
  paymentTransactions.splice(0, paymentTransactions.length, ...persistedPaymentTransactions);
}
const persistPayments = () => saveJson('payments.json', paymentTransactions);

function applySubscriptionPaymentMetadata(transaction: any, confirmedAt = new Date()) {
  if (transaction.useCase !== 'subscription_initial' && transaction.useCase !== 'subscription_renewal' && transaction.useCase !== 'subscription_upgrade') return;
  const interval = transaction.subscriptionInterval === 'annual' ? 'annual' : 'monthly';
  transaction.subscriptionInterval = interval;
  transaction.subscriptionStartedAt = confirmedAt.toISOString();
  transaction.subscriptionRenewDate = addSubscriptionPeriod(confirmedAt, interval).toISOString();
}

async function issueTicketForConfirmedTransaction(transaction: any, requestId: string): Promise<TicketForValidation | null> {
  if (transaction.ticketId) {
    // Regra 4.3: a confirmação do pagamento emite (activa) os bilhetes reservados.
    const ids: string[] = Array.isArray(transaction.ticketIds) && transaction.ticketIds.length > 0
      ? transaction.ticketIds
      : [transaction.ticketId];
    const reserved = ids
      .map((id) => Array.from(ticketsDb.values()).find((ticket: any) => ticket.id === id))
      .filter((ticket): ticket is TicketForValidation => Boolean(ticket));
    if (reserved.length > 0) {
      const draft = transaction.ticketDraft;
      let activatedAny = false;
      for (const ticket of reserved) {
        if (ticket.status === 'pending') {
          ticket.status = 'valid';
          ticket.reservedUntil = undefined;
          if (draft) ticket.expiresAt = calculateTicketExpiry(draft.eventDate, draft.eventTime);
          activatedAny = true;
        }
      }
      if (activatedAny) {
        persistTickets();
        if (databaseConfigured) {
          const activatedIds = await activatePostgresTicketReservations(ids);
          recordAudit({ action: 'ticket_reservation_activated', resource: 'ticket', resourceId: reserved[0].id, actorRole: 'system', requestId, success: true, metadata: { paymentId: transaction.id, activated: activatedIds } });
        }
      }
      return reserved[0];
    }
    // Reserva libertada antes da confirmação (Regra 4.7): recupera a emissão
    // pelo rascunho, sem nova cobrança ao comprador (Regra 4.5).
    if (!transaction.ticketDraft || transaction.useCase !== 'event_tickets') return null;
  }
  const draft = transaction.ticketDraft;
  if (!draft || transaction.useCase !== 'event_tickets') return null;
  const quantity = Math.max(1, Math.min(100, Number(draft.quantity) || 1));
  const issued: TicketForValidation[] = [];
  for (let index = 0; index < quantity; index += 1) {
    const identifiers = generateTicketIdentifiers();
    const ticket: TicketForValidation = {
      id: `TKT-${Date.now()}-${index + 1}-${randomBytes(3).toString('hex').toUpperCase()}`,
      ticketCode: identifiers.ticketCode,
      qrToken: identifiers.qrToken,
      pinCode: identifiers.pinCode,
      businessId: typeof transaction.businessId === 'string' ? transaction.businessId : undefined,
      eventId: String(draft.eventId || 'evt-1'),
      eventTitle: String(draft.eventTitle || 'Evento Cultural Guigui'),
      ticketTypeName: String(draft.ticketTypeName || 'Entrada Geral'),
      priceXOF: Number(transaction.amountXOF),
      buyerName: transaction.payerName,
      buyerPhone: transaction.payerPhone,
      status: 'valid',
      purchasedAt: new Date().toISOString(),
      expiresAt: calculateTicketExpiry(draft.eventDate, draft.eventTime),
      paymentMethod: transaction.provider,
      // A taxa é a que foi calculada no checkout, mesmo que a confirmação
      // do pagamento aconteça depois de uma alteração à política.
      ...(draft.feeSnapshot ? { fee: ticketFeeSnapshotForUnit(draft.feeSnapshot, index, quantity) } : {}),
    };
    if (ticketSigningSecret) ticket.signature = signTicket(ticket, ticketSigningSecret);
    ticketsDb.set(ticket.qrToken, ticket);
    ticketsDb.set(ticket.ticketCode, ticket);
    ticketsDb.set(ticket.pinCode!, ticket);
    issued.push(ticket);
  }
  const primary = issued[0];
  transaction.ticketId = primary.id;
  transaction.ticketIds = issued.map((ticket) => ticket.id);
  transaction.ticketCode = primary.ticketCode;
  transaction.ticketCodes = issued.map((ticket) => ticket.ticketCode);
  transaction.qrToken = primary.qrToken;
  transaction.qrTokens = issued.map((ticket) => ticket.qrToken);
  // A reemissão também tem de existir na base de dados: sem isto o pagamento
  // ficaria sem pedidos e não seria rastreável até ao evento.
  if (databaseConfigured) {
    await persistPostgresTickets(issued, draft.buyerUserId);
  }
  persistTickets();
  persistPayments();
  recordAudit({ action: 'ticket_issued_after_payment_webhook', resource: 'ticket', resourceId: primary.id, actorRole: 'system', requestId, success: true, metadata: { paymentId: transaction.id, providerRef: transaction.providerRef, quantity: issued.length } });
  return primary;
}

// Admin Moderation Logs Endpoint
app.get('/api/admin/moderation-logs', requireRole('admin'), async (req, res) => {
  if (databaseConfigured) {
    try {
      const logs = await listPostgresModeration(500);
      if (logs.length > 0) return res.json(logs);
    } catch (error) {
      console.error('[Guigui.com] /api/admin/moderation-logs pg error:', error);
    }
  }
  res.json(moderationLogs);
});

// Section 10 Payment Integration Endpoints
app.get('/api/payments/transactions', requireRole('admin', 'business'), async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.' });
  const storedBusinessUser = context.role === 'business'
    ? (await identityAccess.findById(context.userId) || undefined)
    : null;
  const access = resolveTransactionAccess(context.role, req.query.businessId, storedBusinessUser?.businessId);
  if (!access.allowed) {
    const accountWithoutBusiness = access.reason === 'ACCOUNT_WITHOUT_BUSINESS';
    return res.status(403).json({
      error: accountWithoutBusiness
        ? 'A conta autenticada não está associada a uma empresa.'
        : 'O businessId não corresponde à empresa autenticada.',
      code: accountWithoutBusiness ? 'BUSINESS_ACCOUNT_REQUIRED' : 'BUSINESS_SCOPE_REQUIRED',
    });
  }
  res.json(paymentTransactions.filter((transaction) => Boolean(transaction.businessId) && canViewTransaction(transaction, context.role, access.businessId)));
});

app.get('/api/payments/operators', requireRole('admin', 'business'), (req, res) => {
  res.json([
    {
      id: 'orange_money',
      name: 'Orange Money Guiné-Bissau',
      shortName: 'Orange Money',
      dedicatedPhone: '+245 955 00 00',
      status: 'negotiating_api',
      onboardingWindow: '2 a 4 meses',
      supportsAutoPushOtp: true,
      activeTransactionsCount: paymentTransactions.filter((t) => t.provider === 'orange_money').length,
      totalVolumeXOF: paymentTransactions
        .filter((t) => t.provider === 'orange_money')
        .reduce((acc, t) => acc + t.amountXOF, 0),
    },
    {
      id: 'telecel',
      name: 'Telecel Guiné-Bissau (Teletaco)',
      shortName: 'Telecel (Teletaco)',
      dedicatedPhone: '+245 966 00 00',
      status: 'negotiating_api',
      onboardingWindow: '2 a 4 meses',
      supportsAutoPushOtp: true,
      activeTransactionsCount: paymentTransactions.filter((t) => t.provider === 'telecel').length,
      totalVolumeXOF: paymentTransactions
        .filter((t) => t.provider === 'telecel')
        .reduce((acc, t) => acc + t.amountXOF, 0),
    },
  ]);
});

app.post('/api/payments/webhook/:provider', async (req, res) => {
  const requestId = requestIdFrom(req);
  const provider = req.params.provider as keyof typeof paymentAdapters;
  const adapter = paymentAdapters[provider];
  if (!adapter) return res.status(404).json({ error: 'Operadora não configurada.', code: 'PAYMENT_PROVIDER_NOT_CONFIGURED', requestId });
  if (adapter.mode === 'simulated') {
    return res.status(409).json({ error: 'Webhooks estão desactivados enquanto o pagamento estiver em modo de simulação.', code: 'PAYMENT_PROVIDER_NOT_ACTIVE', requestId });
  }
  if (isProduction && !paymentWebhookSecret) return res.status(503).json({ error: 'Webhook de pagamentos não configurado no servidor.', code: 'PAYMENT_WEBHOOK_NOT_CONFIGURED', requestId });
  const signature = req.header('x-payment-signature') || req.header('x-webhook-signature');
  if (!adapter.verifyWebhook(req.body, signature)) {
    recordAudit({ action: 'payment_webhook_rejected', resource: 'payment', actorRole: 'system', requestId, success: false, metadata: { provider, reason: 'invalid_signature' } });
    return res.status(401).json({ error: 'Assinatura do webhook inválida.', code: 'INVALID_WEBHOOK_SIGNATURE', requestId });
  }
  const webhook = adapter.parseWebhook(req.body);
  if (!webhook) return res.status(400).json({ error: 'Payload de webhook inválido.', code: 'INVALID_WEBHOOK_PAYLOAD', requestId });
  const transaction = paymentTransactions.find((item) => item.providerRef === webhook.providerRef || item.id === webhook.transactionId);
  if (!transaction) return res.status(404).json({ error: 'Transacção associada ao webhook não encontrada.', code: 'PAYMENT_NOT_FOUND', requestId });
  await recordPostgresPaymentEvent(provider, transaction.id, req.body, true, webhook.providerRef || webhook.transactionId);
  if (webhook.amountXOF !== undefined && webhook.amountXOF !== transaction.amountXOF) {
    recordAudit({ action: 'payment_webhook_rejected', resource: 'payment', resourceId: transaction.id, actorRole: 'system', requestId, success: false, metadata: { provider, reason: 'amount_mismatch', expected: transaction.amountXOF, received: webhook.amountXOF } });
    return res.status(409).json({ error: 'O valor do webhook não corresponde à transacção.', code: 'PAYMENT_AMOUNT_MISMATCH', requestId });
  }
  if (transaction.status === 'refunded' || transaction.status === 'reconciled') {
    return res.status(409).json({ error: 'A transacção já foi encerrada e não aceita alterações.', code: 'PAYMENT_ALREADY_CLOSED', requestId });
  }
  if (webhook.state === 'failed') {
    transaction.status = 'failed';
    transaction.failedAt = new Date().toISOString();
  } else if (webhook.state === 'confirmed') {
    const wasAlreadyConfirmed = transaction.status === 'confirmed_api' || transaction.status === 'confirmed_manual';
    transaction.status = 'confirmed_api';
    transaction.confirmedAt = transaction.confirmedAt || new Date().toISOString().replace('T', ' ').substring(0, 16);
    transaction.confirmedBy = transaction.confirmedBy || `${provider} (webhook verificado)`;
    if (!wasAlreadyConfirmed) applySubscriptionPaymentMetadata(transaction, new Date());
    const ticket = await issueTicketForConfirmedTransaction(transaction, requestId);
    recordMonetizationFulfillment(transaction);
    await persistPostgresPayment(transaction);
    persistPayments();
    recordAudit({ action: 'payment_confirmed_webhook', resource: 'payment', resourceId: transaction.id, actorRole: 'system', requestId, success: true, metadata: { provider, providerRef: webhook.providerRef, ticketId: ticket?.id } });
    return res.json({ success: true, transaction, ...(ticket ? { ticket } : {}), requestId });
  }
  persistPayments();
  await persistPostgresPayment(transaction);
  recordAudit({ action: 'payment_status_updated_webhook', resource: 'payment', resourceId: transaction.id, actorRole: 'system', requestId, success: true, metadata: { provider, state: webhook.state } });
  res.json({ success: true, transaction, requestId });
});

app.post('/api/payments/create', async (req, res) => {
  try {
    const requestId = requestIdFrom(req);
    const {
      useCase,
      useCaseLabel,
      businessId,
      businessName,
      payerName,
      payerPhone,
      amountXOF,
      provider,
    } = req.body;

    // A rota deixou de ser pública: sem sessão não há pagamento nem fulfillment.
    const paymentSession = await sessionContext(req);
    if (!paymentSession) {
      recordAudit({ action: 'payment_authentication_required', resource: 'payment', actorRole: 'citizen', requestId, success: false });
      return res.status(401).json({ error: 'Inicie sessão para criar um pagamento.', code: 'AUTHENTICATION_REQUIRED', requestId });
    }
    const paymentAccount = await identityAccess.findById(paymentSession.userId) || findDemoUserById(paymentSession.userId);
    if (!paymentAccount) {
      return res.status(401).json({ error: 'A conta da sessão não está disponível.', code: 'AUTHENTICATION_REQUIRED', requestId });
    }

    const requestedUseCase = String(useCase || 'subscription_initial');
    const requestedBusinessId = typeof businessId === 'string' && businessId.trim() ? businessId.trim() : undefined;
    const accountBusinessId = typeof (paymentAccount as { businessId?: unknown }).businessId === 'string'
      ? String((paymentAccount as { businessId: string }).businessId)
      : undefined;
    let effectiveBusinessId = requestedBusinessId;

    // Bilhetes: evento e categoria são resolvidos no servidor. O preço cobrado
    // é o total calculado pelo domínio, nunca o valor enviado pelo cliente.
    let validatedTicket: {
      offer: NonNullable<Awaited<ReturnType<typeof getTicketOffer>>>;
      feeSnapshot: ReturnType<typeof buildTicketFeeSnapshot>;
      quantity: number;
    } | undefined;
    if (requestedUseCase === 'event_tickets') {
      const eventId = typeof req.body.eventId === 'string' ? req.body.eventId.trim() : '';
      const ticketTypeId = typeof req.body.ticketTypeId === 'string' ? req.body.ticketTypeId.trim() : '';
      const quantity = Number(req.body.quantity ?? 1);
      if (!eventId || !ticketTypeId || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) {
        return res.status(400).json({ error: 'Indique o evento, a categoria e uma quantidade válida de bilhetes.', code: 'TICKET_SELECTION_REQUIRED', requestId });
      }
      const offer = await getTicketOffer(eventId, ticketTypeId);
      if (!offer) {
        return res.status(404).json({ error: 'O evento ou tipo de bilhete já não está disponível.', code: 'TICKET_OFFER_NOT_FOUND', requestId });
      }
      if (requestedBusinessId && offer.businessId && requestedBusinessId !== offer.businessId) {
        return res.status(403).json({ error: 'O evento não pertence à empresa indicada.', code: 'BUSINESS_ACCESS_DENIED', requestId });
      }

      let ticketCatalog = normaliseMonetizationCatalog(monetizationCatalogStore);
      try {
        const databaseTicketPolicy = await getLegacyTicketFeePolicy();
        if (databaseTicketPolicy) {
          ticketCatalog = {
            ...ticketCatalog,
            ticketFeePolicy: {
              ...ticketCatalog.ticketFeePolicy,
              ...databaseTicketPolicy,
              feePayer: databaseTicketPolicy.feePayer as typeof ticketCatalog.ticketFeePolicy.feePayer,
              billingModel: databaseTicketPolicy.billingModel as typeof ticketCatalog.ticketFeePolicy.billingModel,
            },
          };
        }
      } catch (error) {
        console.error('[Guigui.com] Falha ao carregar a política de taxas de bilheteira:', error);
      }
      const quoteResult = quoteTicketPurchase({ offer, quantity, catalog: ticketCatalog });
      if ('reason' in quoteResult) {
        return res.status(409).json({
          error: quoteResult.reason === 'sales_closed' ? 'As vendas deste tipo de bilhete estão encerradas.' : 'Não há bilhetes suficientes disponíveis.',
          code: 'TICKET_INVENTORY_UNAVAILABLE',
          requestId,
        });
      }
      if (req.body.ticketTypeName !== undefined && req.body.ticketTypeName !== offer.ticketTypeName) {
        return res.status(409).json({ error: 'A categoria selecionada foi alterada. Actualize o checkout.', code: 'TICKET_TYPE_MISMATCH', requestId });
      }
      if (req.body.eventTitle !== undefined && req.body.eventTitle !== offer.eventTitle) {
        return res.status(409).json({ error: 'O evento selecionado foi alterado. Actualize o checkout.', code: 'EVENT_TITLE_MISMATCH', requestId });
      }
      const submittedUnitPrice = req.body.pricePerTicketXOF ?? req.body.priceXOF;
      if (submittedUnitPrice !== undefined
        && (!Number.isSafeInteger(Number(submittedUnitPrice)) || Number(submittedUnitPrice) !== offer.unitPriceXOF)) {
        return res.status(409).json({ error: 'O preço do bilhete foi alterado. Actualize o checkout.', code: 'TICKET_PRICE_MISMATCH', requestId });
      }
      const expectedAmountXOF = quoteResult.quote.buyerTotalXOF;
      if (!Number.isSafeInteger(Number(amountXOF)) || Number(amountXOF) !== expectedAmountXOF) {
        recordAudit({ action: 'payment_price_mismatch', resource: 'payment', requestId, success: false, metadata: { useCase: requestedUseCase, eventId, ticketTypeId, expectedAmountXOF } });
        return res.status(409).json({ error: 'O total do checkout não corresponde à política de taxas actual.', code: 'TICKET_TOTAL_MISMATCH', expectedAmountXOF, requestId });
      }
      effectiveBusinessId = offer.businessId || requestedBusinessId;
      validatedTicket = {
        offer,
        feeSnapshot: buildTicketFeeSnapshot(ticketCatalog, quoteResult.quote.feeBreakdown, new Date()),
        quantity,
      };
    } else {
      // Fora dos bilhetes, a empresa indicada tem de pertencer à sessão. O
      // Super Admin mantém acesso de gestão, mas nunca por conta de terceiros.
      if (requestedBusinessId
        && paymentSession.role !== 'admin'
        && requestedBusinessId !== accountBusinessId) {
        recordAudit({ action: 'payment_business_forbidden', resource: 'payment', requestId, success: false, metadata: { requestedBusinessId } });
        return res.status(403).json({ error: 'Não possui acesso a esta empresa.', code: 'BUSINESS_ACCESS_DENIED', requestId });
      }
      if (paymentSession.role !== 'admin') effectiveBusinessId = requestedBusinessId || accountBusinessId;
    }

    const commercialValidation = await resolveCommercialPayment(req.body as Record<string, unknown>);
    if (!commercialValidation.ok) {
      recordAudit({ action: 'commercial_payment_rejected', resource: 'payment', actorRole: 'citizen', requestId: requestIdFrom(req), success: false, metadata: { code: commercialValidation.code, expectedAmountXOF: commercialValidation.expectedAmountXOF } });
      return res.status(commercialValidation.status).json({ error: commercialValidation.error, code: commercialValidation.code, ...(commercialValidation.expectedAmountXOF ? { expectedAmountXOF: commercialValidation.expectedAmountXOF } : {}) });
    }

    cleanupIdempotency();
    const idempotencyKey = req.header('idempotency-key')?.trim();
    if (idempotencyKey && idempotencyKey.length > 160) {
      return res.status(400).json({ error: 'Chave de idempotência inválida.', code: 'INVALID_IDEMPOTENCY_KEY', requestId });
    }
    const scopedIdempotencyKey = idempotencyKey ? `${paymentSession.userId}:${idempotencyKey}` : undefined;
    if (scopedIdempotencyKey) {
      const previous = paymentIdempotency.get(scopedIdempotencyKey);
      if (previous) return res.status(200).json(previous.response);
    }

    const paymentValidation = validatePaymentInput({ payerName: payerName || 'Cliente Guigui', payerPhone, amountXOF, provider });
    if (!paymentValidation.ok) {
      recordAudit({ action: 'payment_validation_failed', resource: 'payment', actorRole: 'citizen', requestId, success: false, metadata: { issues: paymentValidation.issues } });
      return res.status(400).json({ error: firstIssueMessage(paymentValidation.issues, 'Dados de pagamento inválidos.'), code: 'VALIDATION_ERROR', issues: paymentValidation.issues, requestId });
    }
    const normalizedPayment = paymentValidation.value!;
    const identityValidation = validateUserIdentity({
      name: normalizedPayment.payerName,
      phone: normalizedPayment.payerPhone,
      role: 'citizen',
    });
    if (!identityValidation.ok) {
      recordAudit({ action: 'identity_validation_failed', resource: 'user', actorRole: 'citizen', requestId, success: false, metadata: { issues: identityValidation.issues } });
      return res.status(400).json({ error: firstIssueMessage(identityValidation.issues, 'Identidade do pagador inválida.'), code: 'IDENTITY_VALIDATION_ERROR', issues: identityValidation.issues, requestId });
    }

    const txnId = `TXN-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const paymentAdapter = paymentAdapters[normalizedPayment.provider];
    const chargedAmountXOF = validatedTicket?.feeSnapshot.buyerTotalXOF ?? normalizedPayment.amountXOF;
    const paymentIntent = await paymentAdapter.createIntent({
      transactionId: txnId,
      amountXOF: chargedAmountXOF,
      payerName: normalizedPayment.payerName,
      payerPhone: normalizedPayment.payerPhone,
      description: useCaseLabel || 'Pagamento Guigui.com',
      provider: normalizedPayment.provider,
      metadata: { useCase: requestedUseCase, businessId: String(effectiveBusinessId || '') },
    });
    const requiresLiveSettlement = requestedUseCase === 'event_tickets'
      || requestedUseCase === 'subscription_initial'
      || requestedUseCase === 'subscription_renewal'
      || requestedUseCase === 'subscription_upgrade';
    const canFulfill = paymentIntent.state === 'confirmed'
      && (!requiresLiveSettlement || paymentAdapter.mode === 'live');
    const effectiveIntentState = paymentIntent.state === 'confirmed' && !canFulfill ? 'pending' : paymentIntent.state;
    const paymentStatus = effectiveIntentState === 'confirmed' ? 'confirmed_api' : effectiveIntentState === 'failed' ? 'failed' : 'pending_provider';
    const paymentTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const newTxn = {
      id: txnId,
      useCase: requestedUseCase,
      useCaseLabel: useCaseLabel || 'Pagamento Guigui.com',
      businessId: effectiveBusinessId,
      businessName,
      payerName: normalizedPayment.payerName,
      payerPhone: normalizedPayment.payerPhone,
      amountXOF: chargedAmountXOF,
      provider: normalizedPayment.provider,
      providerRef: paymentIntent.providerRef,
      status: paymentStatus,
      isApiIntegrationReady: paymentAdapter.mode === 'live',
      providerMode: paymentAdapter.mode,
      checkoutUrl: paymentIntent.checkoutUrl,
      paymentInstructions: paymentIntent.instructions,
      ...(commercialValidation.code ? { productId: commercialValidation.productId, productCode: commercialValidation.code, quantity: commercialValidation.quantity } : {}),
      ...(requestedUseCase === 'subscription_initial' || requestedUseCase === 'subscription_renewal' || requestedUseCase === 'subscription_upgrade' ? {
        subscriptionInterval: req.body.subscriptionInterval === 'annual' ? 'annual' : 'monthly',
      } : {}),
      ticketId: undefined as string | undefined,
      ticketIds: undefined as string[] | undefined,
      ticketCode: undefined as string | undefined,
      qrToken: undefined as string | undefined,
      ...(validatedTicket ? {
        ticketDraft: {
          eventId: validatedTicket.offer.eventId,
          eventTitle: validatedTicket.offer.eventTitle,
          ticketTypeId: validatedTicket.offer.ticketTypeId,
          ticketTypeName: validatedTicket.offer.ticketTypeName,
          unitPriceXOF: validatedTicket.offer.unitPriceXOF,
          buyerUserId: paymentSession.userId,
          eventDate: validatedTicket.offer.eventDate,
          eventTime: validatedTicket.offer.eventTime,
          quantity: validatedTicket.quantity,
          feeSnapshot: validatedTicket.feeSnapshot,
        },
      } : {}),
      createdAt: paymentTimestamp,
      ...(canFulfill ? { confirmedAt: paymentTimestamp, confirmedBy: `${paymentAdapter.provider} (${paymentAdapter.mode})` } : {}),
    };

    if (canFulfill) applySubscriptionPaymentMetadata(newTxn, new Date());
    if (canFulfill) recordMonetizationFulfillment(newTxn);
    paymentTransactions.unshift(newTxn);
    // O pagamento pendente de bilhetes tem de ficar atribuído ao evento e ao
    // comprador na base; sem isto a transacção não é conciliável nem aparece
    // no Centro de Controlo do evento enquanto aguarda confirmação.
    await persistPostgresPayment({
      ...newTxn,
      eventId: newTxn.ticketDraft?.eventId,
      companyId: newTxn.businessId,
      buyerUserId: newTxn.ticketDraft?.buyerUserId,
    }, scopedIdempotencyKey);
    persistPayments();
    recordAudit({
      action: 'payment_created',
      resource: 'payment',
      resourceId: newTxn.id,
      actorRole: 'citizen',
      requestId,
      success: true,
      metadata: { provider: newTxn.provider, amountXOF: newTxn.amountXOF, useCase: newTxn.useCase },
    });

    if (requestedUseCase === 'event_tickets' && !canFulfill) {
      const pendingResponse = {
        success: false,
        simulated: paymentAdapter.mode !== 'live',
        settlement: paymentAdapter.mode === 'live' ? 'provider' : 'simulated',
        paymentPending: effectiveIntentState === 'pending',
        transaction: newTxn,
        message: paymentAdapter.mode !== 'live'
          ? 'Modo simulado: nenhum bilhete foi emitido e nenhuma operadora foi contactada.'
          : paymentIntent.instructions || 'Pagamento pendente. O bilhete será emitido depois da confirmação.',
        requestId,
      };
      if (scopedIdempotencyKey) paymentIdempotency.set(scopedIdempotencyKey, { createdAt: Date.now(), response: pendingResponse });
      return res.status(effectiveIntentState === 'pending' ? 202 : 402).json(pendingResponse);
    }

    // Só se cria um bilhete quando a intenção de pagamento foi confirmada e
    // liquidada por um adaptador live.
    if (validatedTicket && canFulfill) {
      const { ticketCode, qrToken, pinCode } = generateTicketIdentifiers();
      const newTicket: TicketForValidation = {
        id: `TKT-${Date.now()}`,
        ticketCode,
        ticketTypeId: validatedTicket.offer.ticketTypeId,
        buyerUserId: paymentSession.userId,
        ...(validatedTicket.offer.businessId ? { businessId: validatedTicket.offer.businessId } : {}),
        eventId: validatedTicket.offer.eventId,
        eventTitle: validatedTicket.offer.eventTitle,
        ticketTypeName: validatedTicket.offer.ticketTypeName,
        priceXOF: validatedTicket.offer.unitPriceXOF,
        buyerName: normalizedPayment.payerName,
        buyerPhone: normalizedPayment.payerPhone,
        qrToken,
        pinCode,
        status: 'valid',
        purchasedAt: new Date().toISOString(),
        expiresAt: calculateTicketExpiry(validatedTicket.offer.eventDate, validatedTicket.offer.eventTime),
        paymentMethod: normalizedPayment.provider,
      };
      if (ticketSigningSecret) {
        newTicket.signature = signTicket(newTicket, ticketSigningSecret);
      }
      ticketsDb.set(qrToken, newTicket);
      ticketsDb.set(pinCode, newTicket);
      ticketsDb.set(ticketCode, newTicket);
      newTxn.ticketId = newTicket.id;
      newTxn.ticketIds = [newTicket.id];
      newTxn.ticketCode = newTicket.ticketCode;
      newTxn.qrToken = newTicket.qrToken;
      persistTickets();
      persistPayments();
      if (databaseConfigured) {
        await persistPostgresTickets([newTicket], paymentSession.userId);
        await persistPostgresPayment(newTxn, scopedIdempotencyKey);
      }
      const successResponse = {
        success: true,
        simulated: paymentAdapter.mode !== 'live',
        settlement: paymentAdapter.mode === 'live' ? 'provider' : 'simulated',
        ...(paymentAdapter.mode !== 'live' ? { message: 'Pagamento confirmado em modo simulado; nenhuma operadora foi contactada e não houve liquidação real.' } : {}),
        transaction: newTxn,
        ticket: newTicket,
        requestId,
      };
      if (scopedIdempotencyKey) paymentIdempotency.set(scopedIdempotencyKey, { createdAt: Date.now(), response: successResponse });
      return res.json(successResponse);
    }

    const successResponse = {
      success: true,
      simulated: paymentAdapter.mode !== 'live',
      settlement: paymentAdapter.mode === 'live' ? 'provider' : 'simulated',
      paymentPending: effectiveIntentState === 'pending',
      ...(requiresLiveSettlement && paymentAdapter.mode !== 'live'
        ? { message: 'Modo simulado: nenhuma operadora foi contactada e a assinatura não foi activada.' }
        : paymentAdapter.mode !== 'live' ? { message: 'Pagamento confirmado em modo simulado; nenhuma operadora foi contactada e não houve liquidação real.' } : {}),
      transaction: newTxn,
      requestId,
    };
    if (scopedIdempotencyKey) paymentIdempotency.set(scopedIdempotencyKey, { createdAt: Date.now(), response: successResponse });
    res.json(successResponse);
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao processar transação de pagamento', details: err.message });
  }
});

app.post('/api/payments/confirm', requireRole('admin'), async (req, res) => {
  const requestId = requestIdFrom(req);
  const { id, adminName = 'Admin Guigui' } = req.body;
  const txn = paymentTransactions.find((t) => t.id === id);

  if (!txn) {
    return res.status(404).json({ error: 'Transação não encontrada.' });
  }
  if (txn.provider === 'manual_transfer' || txn.manualProofReference) {
    recordAudit({ action: 'manual_payment_confirmation_rejected', resource: 'payment', resourceId: txn.id, actorRole: 'admin', requestId, success: false, metadata: { reason: 'manual_payments_disabled' } });
    return res.status(409).json({ error: 'Pagamentos manuais históricos são apenas de leitura e não podem ser confirmados.', code: 'MANUAL_PAYMENT_DISABLED', requestId });
  }
  if (txn.useCase === 'event_tickets' || txn.useCase === 'event_refund') {
    return res.status(403).json({ error: 'Operação reservada à empresa organizadora.', code: 'TICKET_OPERATION_FORBIDDEN' });
  }
  if (txn.status === 'confirmed_api' || txn.status === 'confirmed_manual' || txn.status === 'reconciled') {
    recordMonetizationFulfillment(txn);
    return res.status(200).json({ success: true, immutable: true, transaction: txn, requestId });
  }

  txn.status = 'confirmed_manual';
  txn.confirmedAt = txn.confirmedAt || new Date().toISOString().replace('T', ' ').substring(0, 16);
  txn.confirmedBy = txn.confirmedBy || adminName;
  applySubscriptionPaymentMetadata(txn, new Date());
  recordMonetizationFulfillment(txn);
  await persistPostgresPayment(txn);
  persistPayments();
  recordAudit({ action: 'payment_confirmed', resource: 'payment', resourceId: txn.id, actorRole: 'admin', actorName: adminName, requestId, success: true });

  res.json({ success: true, transaction: txn, requestId });
});

app.post('/api/payments/reconcile', requireRole('admin'), async (req, res) => {
  const { ids, adminName = 'Equipa Financeira Guigui' } = req.body;
  const targetIds: string[] = Array.isArray(ids) ? ids : [ids];

  const forbiddenTransaction = targetIds
    .map((id) => paymentTransactions.find((transaction) => transaction.id === id))
    .find((transaction) => transaction?.useCase === 'event_tickets' || transaction?.useCase === 'event_refund');
  if (forbiddenTransaction) {
    return res.status(403).json({ success: false, error: 'Operação reservada à empresa organizadora.', code: 'TICKET_OPERATION_FORBIDDEN' });
  }

  let updatedCount = 0;
  for (const id of targetIds) {
    const txn = paymentTransactions.find((t) => t.id === id);
    if (txn && (txn.status === 'confirmed_api' || txn.status === 'confirmed_manual')) {
      txn.status = 'reconciled';
      txn.reconciledAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
      txn.reconciledBy = adminName;
      await persistPostgresPayment(txn);
      updatedCount++;
    }
  }

  persistPayments();
  res.json({ success: true, reconciledCount: updatedCount });
});

app.post('/api/payments/refund', requireRole('admin'), async (req, res) => {
  const requestId = requestIdFrom(req);
  const { id, reason = 'Cancelamento do evento ou pedido do cliente' } = req.body;
  const txn = paymentTransactions.find((t) => t.id === id);

  if (!txn) {
    return res.status(404).json({ error: 'Transação não encontrada.' });
  }
  if (txn.useCase === 'event_tickets' || txn.useCase === 'event_refund') {
    return res.status(403).json({ error: 'Operação reservada à empresa organizadora.', code: 'TICKET_OPERATION_FORBIDDEN' });
  }

  txn.status = 'refunded';
  txn.refundedAt = new Date().toISOString().replace('T', ' ').substring(0, 16);
  txn.refundReason = reason;
  markMonetizationRefunded(txn.id);
  await persistPostgresPayment(txn);
  persistPayments();
  recordAudit({ action: 'payment_refunded', resource: 'payment', resourceId: txn.id, actorRole: 'admin', requestId, success: true, metadata: { reason } });

  res.json({ success: true, transaction: txn, requestId });
});


// ==========================================
// SECTION 11: TECHNICAL ARCHITECTURE & INFRASTRUCTURE ENDPOINTS
// ==========================================

const termsConsentLogs = [
  {
    id: 'CONSENT-2026-001',
    userName: 'Mamadu Djaló',
    phone: '+245 955 12 34 56',
    ipAddress: '197.214.42.10',
    acceptedAt: '2026-08-01 10:14:22',
    termsVersion: 'v2.4_GDPR_Guigui_2026',
    diasporaGdprCompliant: true,
  },
  {
    id: 'CONSENT-2026-002',
    userName: 'Soraia Gomes',
    phone: '+245 966 44 33 22',
    ipAddress: '82.155.192.4', // Portugal Diaspora IP
    acceptedAt: '2026-08-04 14:18:02',
    termsVersion: 'v2.4_GDPR_Guigui_2026',
    diasporaGdprCompliant: true,
  }
];

// Sem cópias reais registadas, a lista começa vazia: um histórico de backups
// com entradas fictícias daria uma falsa sensação de cópias de segurança.
const backupLogsHistory: Array<Record<string, unknown>> = [];

const persistedConsentLogs = loadJson<any[]>('consent-logs.json', []);
if (persistedConsentLogs.length > 0) termsConsentLogs.splice(0, termsConsentLogs.length, ...persistedConsentLogs);
const persistConsentLogs = () => saveJson('consent-logs.json', termsConsentLogs);

const persistedBackupLogs = loadJson<any[]>('backup-logs.json', []);
if (persistedBackupLogs.length > 0) backupLogsHistory.splice(0, backupLogsHistory.length, ...persistedBackupLogs);
const persistBackupLogs = () => saveJson('backup-logs.json', backupLogsHistory);

app.get('/api/system/architecture', requireRole('admin'), (req, res) => {
  res.json({
    stack: {
      frontend: 'React 19 + Vite + Tailwind CSS v4 + TypeScript',
      backend: 'Node.js REST API + Express + TypeScript',
      database: 'JSON em data/ + localStorage no modo de desenvolvimento; base relacional recomendada para produção',
      hostingPrimary: 'DigitalOcean Cloud Nodes (Frankfurt fra1 - Latency optimized for West Africa)',
      hostingSecondary: 'Hetzner Cloud (Amsterdam ams3 - Cold Backup Replication)',
      localBissauStatus: 'Servidor Local Bissau (Grupo Gorila) apenas como posto de trabalho/cópia secundária. Produção 100% na Nuvem para eliminar riscos elétricos/rede.',
      appFormat: 'PWA (Progressive Web App - Instalável, Push, Cache Offline 3G/4G)',
      gateScanner: 'Web-App scanner de bilhetes com câmara PWA + Opção App Android APK para equipas de controlo de entrada',
    },
    security: {
      ticketTokens: 'Tokens Cryptográficos de Uso Único Assinados (HMAC-SHA256)',
      passwords: 'Hash + Salt com scrypt no backend de desenvolvimento',
      twoFactorAuth: '2FA obrigatório para Super Admin no módulo administrativo; entrega externa ainda simulada na demo',
      gdprCompliance: 'Conformidade com Proteção de Dados (RGPD para Diáspora e Legislação Local)',
      termsConsentLogCount: termsConsentLogs.length,
      smsGateway: describeSmsGateway(),
      automaticBackups: process.env.GUIGUI_BACKUP_INTERVAL_HOURS
        ? `Agendado a cada ${process.env.GUIGUI_BACKUP_INTERVAL_HOURS}h; cifragem ${process.env.GUIGUI_BACKUP_ENCRYPTION_KEY ? 'AES-256-GCM activa' : 'DESACTIVADA (defina GUIGUI_BACKUP_ENCRYPTION_KEY)'}; réplica externa ${process.env.GUIGUI_BACKUP_REPLICA_DIR ? 'configurada' : 'NAO CONFIGURADA (defina GUIGUI_BACKUP_REPLICA_DIR)'}.`
        : 'NAO AGENDADO. Defina GUIGUI_BACKUP_INTERVAL_HOURS para copias periodicas automaticas.',
    },
    nonFunctional: {
      languagesSupported: [...LANGUAGE_CYCLE],
      lowBandwidthOptimized: true, // 3G/4G Bissau
      offlineResilience: 'A aplicação guarda estado localmente, mas a validação de bilhetes do scanner exige sempre ligação ao servidor: não existe cache local de bilhetes, para impedir reutilização.',
      scalabilityTier: 'Preparado para expansão de dezenas para milhares de utilizadores simultâneos',
    },
    recentConsentLogs: termsConsentLogs,
    recentBackups: backupLogsHistory,
  });
});

app.post('/api/system/backup/trigger', requireRole('admin'), async (req, res) => {
  const requestId = requestIdFrom(req);
  const outcome = await triggerLocalBackup();
  const newBackup = {
    id: `BKP-${Date.now()}`,
    type: 'manual_on_demand',
    engine: outcome.engine,
    status: outcome.status,
    file: outcome.file,
    sizeMB: outcome.sizeMB,
    encrypted: outcome.encrypted,
    sha256: outcome.sha256,
    ...(outcome.replicatedTo ? { replicatedTo: outcome.replicatedTo } : {}),
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    ...(outcome.error ? { note: outcome.error } : {}),
  };
  backupLogsHistory.unshift(newBackup);
  persistBackupLogs();
  recordAudit({
    action: 'backup_triggered',
    resource: 'backup',
    resourceId: newBackup.id,
    actorRole: 'admin',
    actorName: 'Admin Guigui',
    requestId,
    success: outcome.status === 'completed',
    metadata: { engine: outcome.engine, sizeMB: outcome.sizeMB, status: outcome.status, encrypted: outcome.encrypted, replicated: Boolean(outcome.replicatedTo) },
  });

  if (outcome.status === 'not_configured') {
    return res.status(503).json({ success: false, code: 'BACKUP_NOT_CONFIGURED', error: outcome.error, backup: newBackup });
  }
  if (outcome.status === 'failed') {
    return res.status(500).json({ success: false, code: 'BACKUP_FAILED', error: outcome.error, backup: newBackup });
  }
  res.json({ success: true, backup: newBackup });
});

app.post('/api/system/gdpr/consent', requireSession, (req, res) => {
  const { userName, phone, termsVersion = 'v2.4_GDPR_Guigui_2026' } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '197.214.40.1';
  const newConsent = {
    id: `CONSENT-${Date.now()}`,
    userName: userName || 'Utilizador Anónimo',
    phone: phone || 'N/A',
    ipAddress: String(ip),
    acceptedAt: new Date().toISOString().replace('T', ' ').substring(0, 19),
    termsVersion,
    diasporaGdprCompliant: true,
  };
  termsConsentLogs.unshift(newConsent);
  persistConsentLogs();
  res.json({ success: true, consentLog: newConsent });
});

// Deliberately refuse the legacy admin token-verification endpoint. Ticket tokens are
// validated only by the company scanner route, which requires event and business scope.
app.post('/api/system/security/verify-token', requireRole('admin', 'business'), (req, res) => {
  const requestId = requestIdFrom(req);
  recordAudit({
    action: 'admin_ticket_verification_blocked',
    resource: 'ticket',
    actorRole: 'admin',
    requestId,
    success: false,
    metadata: { reason: 'company_scanner_only' },
  });
  res.status(403).json({
    error: 'A validação de bilhetes é exclusiva do scanner da empresa organizadora.',
    code: 'TICKET_OPERATION_FORBIDDEN',
    requestId,
  });
});

app.get('/robots.txt', (_req, res) => {
  const baseUrl = (runtimeConfig.appUrl || 'http://127.0.0.1:3000').replace(/\/$/, '');
  res.type('text/plain').send(`User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin
Sitemap: ${baseUrl}/sitemap.xml
`);
});

app.get('/sitemap.xml', (_req, res) => {
  const baseUrl = (runtimeConfig.appUrl || 'http://127.0.0.1:3000').replace(/\/$/, '');
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${baseUrl}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>
  <url><loc>${baseUrl}/?section=directory</loc><changefreq>daily</changefreq><priority>0.8</priority></url>
  <url><loc>${baseUrl}/?section=events</loc><changefreq>daily</changefreq><priority>0.8</priority></url>
  <url><loc>${baseUrl}/?section=promotions</loc><changefreq>daily</changefreq><priority>0.7</priority></url>
</urlset>`);
});

// Servir Service Worker vazio ANTES do Vite para substituir qualquer SW antigo
app.get('/sw.js', (_req, res) => {
  res.type('application/javascript').sendFile(path.join(process.cwd(), 'sw.js'));
});

// Ficheiros carregados em runtime (fotografias e vídeos das stories).
app.use('/uploads', express.static(path.join(process.cwd(), 'public', 'uploads'), {
  maxAge: '7d',
  fallthrough: true,
}));

// Guard de API: qualquer /api/* que não tenha sido tratado acima responde 404
// JSON. Sem isto o catch-all do SPA devolvia index.html com 200 e os clientes
// falhavam ao fazer JSON.parse (erros silenciosos nos painéis).
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'Endpoint de API não encontrado.',
    code: 'API_ROUTE_NOT_FOUND',
    method: req.method,
    path: (req.originalUrl || req.url).split('?')[0],
  });
});

async function startServer() {
  // Vite middleware in dev mode
  if (!runtimeConfig.isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      // O Express não expõe o servidor HTTP interno do Vite, logo o HMR está
      // desligado. Em middlewareMode, `hmr: false` não impede a criação de um
      // servidor WebSocket standalone; `ws: false` desativa esse servidor.
      server: { middlewareMode: true, hmr: false, ws: false, watch: null },
      // Workaround Vite 6.4: crash "Cannot read properties of undefined
      // (reading 'imports')" na otimização de dependências quando a cache
      // fica inconsistente após mudanças de código (depsInfo[id] undefined).
      // Desligar a pré-otimização evita o crash; o transform on-demand continua.
      // Vite 6.4 não aceita `disabled`; usar `noDiscovery: true` em vez disso.
      optimizeDeps: {
        include: ['pako', 'jsqr', 'qrcode', 'react-dom/client', 'recharts'],
        noDiscovery: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // SPA fallback: serve index.html para todas as rotas não-API no modo dev
    app.get('*', (_req, res) => {
      res.sendFile(path.join(process.cwd(), 'index.html'));
    });
  } else if (!runtimeConfig.isVercel) {
    const distPath = path.join(process.cwd(), 'dist');
    // Bloqueia exposição de fontes, sourcemaps e endpoints de desenvolvimento em produção.
    app.use((req, res, next) => {
      const p = req.path || '';
      if (p.endsWith('.map') || p === '/server.ts' || p.startsWith('/src/') || p.startsWith('/@vite/') || p.startsWith('/@fs/')) {
        return res.status(404).end();
      }
      next();
    });
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (runtimeConfig.isVercel) {
    return;
  }

  await ensureDemoScheduledItems();
  void processDueScheduledItems().catch((error) => console.error('scheduled-items-startup-failed', error));
  setInterval(() => {
    void processDueScheduledItems().catch((error) => console.error('scheduled-items-processing-failed', error));
  }, 30_000);

  await startRealtimeListener();
  // Recolha periódica de métricas reais + avaliação dos limites configurados.
  startSystemMonitor();
  app.listen(PORT, runtimeConfig.host, () => {
    console.log(`[Guigui.com] Servidor a rodar na porta ${PORT} em http://${runtimeConfig.host}:${PORT}`);
  });

  // Cópias de segurança periódicas, cifradas e replicadas (ver backupService).
  startBackupScheduler((outcome) => {
    const level = outcome.status === 'completed' ? 'log' : 'error';
    console[level](`[Guigui.com] backup automático: ${outcome.status} (${outcome.engine}, ${outcome.sizeMB} MB, cifrado=${outcome.encrypted})`);
  });
}

export default app;
void startServer();
