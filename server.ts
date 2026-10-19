import 'dotenv/config';
import './server/bootstrapVercel.js';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomBytes, randomInt, randomUUID, timingSafeEqual } from 'crypto';
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
import { acceptTeamInvitation, changeDemoPassword, changeUserPassword, createPasswordReset, createTeamInvitation, createUser, deactivateUserAccount, deleteUserAccount, findUserByEmail, findUserById, inspectTeamInvitation, resetPassword, toPublicUser, verifyDemoPassword, verifyPassword, PublicUser } from './server/authService';
import { loadJson, saveJson } from './server/runtimeStore';
import { createPaymentAdapters } from './server/paymentService';
import { localizeApiPayload, resolveRequestLanguage } from './server/i18n';
import { LANGUAGE_CYCLE } from './src/utils/i18n';
import { addSubscriptionPeriod } from './src/utils/subscriptions';
import { sendTeamInvitation } from './server/emailService';
import { createSession, getSession, revokeAllUserSessions, revokeSession, SESSION_COOKIE_NAME } from './server/sessionService';
import { checkDatabaseConnection, databaseConfigured, databasePool } from './server/db';
import { classifyHealth } from './server/healthService';
import { changePostgresUserPassword, createPostgresUser, deactivatePostgresUser, deletePostgresUser, findPostgresUserByEmail, findPostgresUserById } from './server/postgresAuthService';
import { activatePostgresTicketReservations, findPostgresTicket, listPostgresTicketsForUser, markPostgresTicketUsed, persistPostgresTickets, releaseExpiredPostgresTicketReservations } from './server/postgresTicketService';
import { listPostgresTicketsForCompany } from './server/postgresTicketLifecycleService';
import { buildOfflineManifest, syncOfflineValidations, type OfflineValidationRecord } from './server/offlineScannerService';
import { listPostgresPayments, persistPostgresPayment, recordPostgresPaymentEvent } from './server/postgresPaymentService';
import { persistPostgresAudit } from './server/postgresAuditService';
import { findPostgresModeration, listPostgresModeration, persistPostgresModeration, persistPostgresModerationReview } from './server/postgresModerationService';
import { createPostgresConversation, createPostgresConversationMessage, createPostgresSupportReply, listPostgresConversations, listPostgresNotifications, listPostgresSupportTickets, markPostgresConversationRead, markPostgresNotificationRead, persistPostgresNotification, persistPostgresSupportTicket, updatePostgresSupportStatus } from './server/postgresCommunicationService';
import { markPostgresMonetizationRefunded, persistPostgresMonetization } from './server/postgresMonetizationService';
import { persistPostgresCatalog } from './server/postgresCatalogService';
import { createPostgresReview, flagPostgresReview, isReviewAllowed, listPostgresReviews, moderatePostgresReview, replyPostgresReview } from './server/postgresReviewService';
import { normaliseReviewComment, validateReviewInput } from './src/utils/reviews';
import { assignPostgresBusinessOwner, decidePostgresBusiness, getAppState, listPendingPostgresBusinesses, listPostgresBusinesses, listPostgresEvents, persistPostgresBusiness, persistPostgresEvent, setAppState } from './server/postgresBusinessService';

import { beginMfaSetup, enableMfa, hasEnabledMfa, verifyUserMfa } from './server/mfaService';
import { consumeDistributedRateLimit } from './server/rateLimitService';
import { getDatabaseObservability, persistRequestMetric } from './server/observabilityService';
import { renderPrometheusMetrics } from './server/prometheusService';
import { getProductFunnel, persistProductEvent } from './server/productAnalyticsService';
import { canViewTransaction, resolveTransactionAccess } from './server/paymentAccessService';
import { resolveAppStateValue, resolveAppStateWrite, resolveBusinessWrite, resolveEventWrite } from './server/platformWriteAccess';
import { startBackupScheduler, triggerLocalBackup } from './server/backupService';
import { describeSmsGateway, sendSms } from './server/smsGatewayService';
import { createScheduledItem, ensureDemoScheduledItems, listScheduledItems, processDueScheduledItems, updateScheduledItem, SCHEDULING_TIMEZONE } from './server/schedulingService';
import type { ScheduledItem } from './src/types';
import type { MonetizationCatalog, MonetizationLedgerEntry, MonetizationWallet } from './src/types';
import { DEFAULT_MONETIZATION_CATALOG, calculateTicketFees, createLedgerEntry, getCommercialProduct, normaliseMonetizationCatalog, resolveProductPrice } from './src/data/monetizationCatalog';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const communicationStreams = new Set<import('express').Response>();
const broadcastCommunication = (event: string, payload: Record<string, unknown>) => {
  const data = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  communicationStreams.forEach((stream) => {
    try { stream.write(data); } catch { communicationStreams.delete(stream); }
  });
};
const PORT = Number(process.env.PORT) || 3000;
const isProduction = process.env.NODE_ENV === 'production';
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

const requestMetrics = {
  total: 0,
  errors: 0,
  byRoute: new Map<string, { count: number; errors: number; totalMs: number }>(),
};

app.disable('x-powered-by');
// Middleware anti-cache para forçar o navegador a buscar tudo novo (resolve tela branca por cache/Service Worker)
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});
app.use((req, res, next) => {
  const startedAt = performance.now();
  const requestId = requestIdFrom(req);
  res.setHeader('X-Request-Id', requestId);
  res.on('finish', () => {
    const durationMs = Math.round((performance.now() - startedAt) * 100) / 100;
    const route = req.route?.path || req.path;
    const current = requestMetrics.byRoute.get(route) || { count: 0, errors: 0, totalMs: 0 };
    current.count += 1;
    current.totalMs += durationMs;
    if (res.statusCode >= 500) {
      current.errors += 1;
      requestMetrics.errors += 1;
    }
    requestMetrics.byRoute.set(route, current);
    requestMetrics.total += 1;
    void persistRequestMetric(route, res.statusCode, durationMs).catch((error: unknown) => {
      console.error(JSON.stringify({ event: 'observability_persist_failed', requestId, message: error instanceof Error ? error.message : 'unknown_error' }));
    });
    if (res.statusCode >= 400 || durationMs >= 1000) {
      console.log(JSON.stringify({ event: 'http_request', requestId, method: req.method, route, status: res.statusCode, durationMs }));
    }
  });
  next();
});
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
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
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
  (process.env.CORS_ALLOWED_ORIGINS || process.env.APP_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);
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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Request-Id, Idempotency-Key, X-Payment-Signature, X-Webhook-Signature');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  } else if (origin && req.method === 'OPTIONS') {
    return res.status(403).json({ error: 'Origem não autorizada.', code: 'CORS_ORIGIN_DENIED' });
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const requestWindows = new Map<string, { startedAt: number; count: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
// Em produção o limite protege a API. Em desenvolvimento/teste (Playwright com
// 8 workers paralelos a carregar páginas e logins pelo mesmo IP) o limite
// padrão gerava respostas 429 em cascata e pendurava os testes de e2e.
const RATE_LIMIT_MAX_REQUESTS = isProduction ? 1000 : 30_000;
// Endpoints de app-state são chamadas de leitura em lote da SPA; excluindo-os
// do rate limit geral evitamos 429 em cascata no carregamento inicial.
const APP_STATE_PREFIX = '/api/app-state/';
app.use('/api', async (req, res, next) => {
  if (req.url.startsWith(APP_STATE_PREFIX)) return next();
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

app.use(express.json({ limit: '10mb' }));
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
const moderationLogs: any[] = loadJson<any[]>('moderation-logs.json', []);
const securityAuditLogs: AuditEntry[] = loadJson<AuditEntry[]>('audit-logs.json', []);
const persistTickets = () => saveJson('tickets.json', Array.from(ticketsDb.entries()));
const persistModerationLogs = () => saveJson('moderation-logs.json', moderationLogs);
const persistAuditLogs = () => saveJson('audit-logs.json', securityAuditLogs);
const purchaseIdempotency = new Map<string, { createdAt: number; response: unknown }>();
const paymentIdempotency = new Map<string, { createdAt: number; response: unknown }>();
const ticketLookupWindows = new Map<string, { startedAt: number; count: number }>();
const smsResendWindows = new Map<string, { lastSentAt: number; dayKey: string; count: number }>();
const TICKET_LOOKUP_WINDOW_MS = 10 * 60_000;
const SMS_RESEND_COOLDOWN_MS = 60_000;
const SMS_RESEND_DAILY_MAX = 3;
const TICKET_LOOKUP_MAX_ATTEMPTS = 5;
const normalizeLookupPhone = (value: unknown) => String(value || '').replace(/\D/g, '').slice(-9);
const allowTicketLookup = (phone: string) => {
  const now = Date.now();
  const current = ticketLookupWindows.get(phone);
  if (!current || now - current.startedAt >= TICKET_LOOKUP_WINDOW_MS) {
    ticketLookupWindows.set(phone, { startedAt: now, count: 1 });
    return true;
  }
  if (current.count >= TICKET_LOOKUP_MAX_ATTEMPTS) return false;
  current.count += 1;
  return true;
};
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

function resolveCommercialPayment(body: Record<string, unknown>) {
  const useCase = String(body.useCase || '');
  const code = getCommercialCodeForUseCase(useCase, body.productCode);
  const commercialUseCase = ['extra_posts', 'extra_promotions', 'advertising_purchase', 'content_service_request', 'extra_credit_purchase'].includes(useCase);
  if (!commercialUseCase || !code) return { ok: true as const, code: undefined, quantity: 1, price: Number(body.amountXOF || 0) };
  const quantity = Number.isInteger(Number(body.quantity)) ? Math.min(1000, Math.max(1, Number(body.quantity))) : 1;
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

type SessionRole = 'user' | 'business' | 'admin';

async function sessionContext(req: express.Request): Promise<{ userId: string; role: SessionRole } | null> {
  const session = await getSession(sessionTokenFromRequest(req));
  if (!session || !session.role) return null;
  return { userId: session.userId, role: session.role };
}

async function requireSession(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!(await sessionContext(req))) {
    return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  }
  next();
}

function requireRole(...roles: SessionRole[]) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const context = await sessionContext(req);
    if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
    if (!roles.includes(context.role)) {
      recordAudit({ action: 'authorization_denied', resource: req.path, actorRole: context.role === 'user' ? 'citizen' : context.role, requestId: requestIdFrom(req), success: false, metadata: { requiredRoles: roles } });
      return res.status(403).json({ error: 'Não possui permissão para esta operação.', code: 'PERMISSION_DENIED' });
    }
    next();
  };
}

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
app.get('/api/health', async (req, res) => {
  let database = { configured: databaseConfigured, connected: false };
  if (databaseConfigured) {
    try {
      database = await checkDatabaseConnection();
    } catch (error) {
      console.error(
        '[Guigui.com] health database check failed:',
        error instanceof Error ? error.message : 'unknown_error',
      );
      database = { configured: true, connected: false };
    }
  }
  res.json({
    status: classifyHealth(database),
    app: 'Guigui.com Bissau',
    timestamp: new Date().toISOString(),
    geminiActive: !!getAIClient(),
    database,
    observability: { inProcess: true, persistent: Boolean(database.connected) },
  });
});

app.get('/api/marketing/scheduled-items', requireRole('business', 'admin'), async (req, res) => {
    const context = await sessionContext(req);
    const businessId = typeof req.query.businessId === 'string' ? req.query.businessId : undefined;
    if (context?.role === 'business' && !businessId) return res.status(400).json({ error: 'businessId é obrigatório.' });
    res.json({ timezone: SCHEDULING_TIMEZONE, items: await listScheduledItems(businessId) });
  });

app.post('/api/marketing/campaigns', requireRole('business'), async (req, res) => {
  const context = await sessionContext(req);
  const campaign = req.body;
  if (!context || !campaign?.id || !campaign?.businessId || !campaign?.name) {
    return res.status(400).json({ error: 'id, businessId e name são obrigatórios.' });
  }
  const storedUser = databaseConfigured ? await findPostgresUserById(context.userId) : findUserById(context.userId) || undefined;
  if (!storedUser?.businessId || storedUser.businessId !== String(campaign.businessId)) {
    return res.status(403).json({ error: 'A campanha não pertence à empresa autenticada.' });
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
      CREATE TABLE IF NOT EXISTS marketing_campaigns (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `);
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
  const promotion = req.body;
  if (!context || !promotion?.id || !promotion?.businessId || !promotion?.title) {
    return res.status(400).json({ error: 'id, businessId e title são obrigatórios.' });
  }
  const storedUser = databaseConfigured ? await findPostgresUserById(context.userId) : findUserById(context.userId) || undefined;
  if (!storedUser?.businessId || storedUser.businessId !== String(promotion.businessId)) {
    return res.status(403).json({ error: 'A promoção não pertence à empresa autenticada.' });
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
      CREATE TABLE IF NOT EXISTS marketing_promotions (
        id TEXT PRIMARY KEY,
        business_id TEXT NOT NULL,
        payload JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL
      )
    `);
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

    const storedUser = databaseConfigured ? await findPostgresUserById(context.userId) : findUserById(context.userId) || undefined;
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

app.get('/api/app-state/:key', async (req, res) => {
  try {
    const value = await getAppState(req.params.key);
    res.json({ key: req.params.key, value });
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
    const { value: incoming } = req.body || {};

    // Uma empresa envia a colecção inteira: o servidor repõe os registos que
    // não lhe pertencem, para que não possa apagar concorrentes nem reescrever
    // o catálogo de preços da plataforma.
    if (context.role === 'business') {
      const storedBusinessUser = databaseConfigured
        ? await findPostgresUserById(context.userId)
        : findUserById(context.userId) || undefined;
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

app.get('/api/sync/bootstrap', async (_req, res) => {
  try {
    const businesses = await listPostgresBusinesses();
    const events = await listPostgresEvents();
    const userPosts = await getAppState('guigui_user_posts');
    const promotions = await getAppState('guigui_promotions');
    const stories = await getAppState('guigui_stories');
    res.json({
      success: true,
      database: { connected: Boolean(databasePool) },
      data: {
        businesses: businesses.length > 0 ? businesses : null,
        events: events.length > 0 ? events : null,
        userPosts,
        promotions,
        stories,
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao sincronizar dados iniciais do banco.' });
  }
});

app.get('/api/businesses', async (_req, res) => {
  try {
    const businesses = await listPostgresBusinesses();
    res.json({ businesses });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar empresas.' });
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
app.get('/api/admin/categories', async (_req, res) => {
  try {
    const pool = databasePool;
    if (!pool) {
      return res.status(503).json({ error: 'Database not configured.' });
    }
    const result = await pool.query(
      `SELECT id, name, parent_id, is_active FROM categories
        WHERE parent_id IS NOT NULL
        ORDER BY
        CASE
          WHEN id IN ('cat-1','cat-2','cat-3','cat-4','cat-5') THEN 1
          WHEN id IN ('cat-6','cat-7','cat-8') THEN 2
          WHEN id IN ('cat-9','cat-10','cat-11','cat-12','cat-13') THEN 3
          ELSE 4
        END, name`
    );
    const categories = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      groupId: row.parent_id || null,
      is_active: row.is_active,
    }));
    res.json({ categories });
  } catch (error) {
    console.error('[Guigui.com] /api/admin/categories error:', error);
    res.status(500).json({ error: 'Failed to load categories.' });
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
      revenueAgg, revenueByMonth, supportByStatus, moderationByStatus,
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
      rows(`SELECT COALESCE(sum(gross_amount_xof),0)::bigint AS total, COALESCE(sum(commission_amount_xof),0)::bigint AS commission FROM payment_transactions WHERE status = 'paid'`),
      rows(`SELECT to_char(created_at,'YYYY-MM') AS month, COALESCE(sum(gross_amount_xof),0)::bigint AS revenue, COALESCE(sum(commission_amount_xof),0)::bigint AS commission FROM payment_transactions WHERE status = 'paid' GROUP BY month ORDER BY month`),
      group(`SELECT status AS key, count(*)::int AS n FROM support_tickets GROUP BY status`),
      group(`SELECT status AS key, count(*)::int AS n FROM moderation_items GROUP BY status`),
    ]);
    const sum = (obj: Record<string, number>) => Object.values(obj).reduce((a, b) => a + b, 0);
    res.json({
      users: { total: sum(usersByRole), byRole: usersByRole, byStatus: usersByStatus, byMonth: usersByMonth },
      companies: { total: sum(companiesByStatus), byStatus: companiesByStatus, byMonth: companiesByMonth },
      events: { total: sum(eventsByStatus), byStatus: eventsByStatus },
      orders: { total: sum(ordersByStatus), byStatus: ordersByStatus },
      tickets: { total: sum(ticketsByStatus), byStatus: ticketsByStatus },
      payments: { total: sum(paymentsByStatus), byStatus: paymentsByStatus, byUseCase: paymentsByUseCase },
      revenue: { grossXOF: Number(revenueAgg[0]?.total ?? 0), commissionXOF: Number(revenueAgg[0]?.commission ?? 0), byMonth: revenueByMonth },
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
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const params: any[] = [];
  const where: string[] = [];
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where.push(`(lower(u.name) LIKE $${params.length} OR lower(u.email) LIKE $${params.length})`);
  }
  if (role && ['user', 'business', 'admin'].includes(role)) {
    params.push(role);
    where.push(`u.role = $${params.length}`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  try {
    const countResult = await pool.query(`SELECT count(*)::int AS total FROM users u ${whereSql}`, params);
    params.push(limit, offset);
    const rowsResult = await pool.query(
      `SELECT u.id, u.name, u.email, u.phone, u.neighborhood, u.role, u.account_status, u.created_at,
              c.id AS company_id, c.name AS company_name
         FROM users u
         LEFT JOIN company_members cm ON cm.user_id = u.id
         LEFT JOIN companies c ON c.id = cm.company_id
         ${whereSql}
         ORDER BY u.created_at DESC
         LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({
      total: countResult.rows[0].total,
      limit,
      offset,
      users: rowsResult.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phone,
        neighborhood: row.neighborhood,
        role: row.role,
        accountStatus: row.account_status,
        createdAt: row.created_at,
        companyId: row.company_id,
        companyName: row.company_name,
      })),
    });
  } catch (error) {
    console.error('[Guigui.com] /api/admin/users error:', error);
    res.status(500).json({ error: 'Não foi possível carregar os utilizadores.', code: 'ADMIN_USERS_FAILED' });
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

app.post('/api/businesses', requireSession, async (req, res) => {
  const requestId = requestIdFrom(req);
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });

  const business = req.body;
  if (!business || !business.id || !business.name) {
    return res.status(400).json({ error: 'id e name são obrigatórios para a empresa.' });
  }

  // A empresa nunca escolhe o seu próprio id: uma conta de negócio só pode
  // gravar a ficha a que está associada, impedindo criação ou sequestro de fichas.
  const targetBusinessId = String(context.role === 'admin' ? business.id : (business.businessId || business.id));
  const storedBusinessUser = context.role === 'business'
    ? (databaseConfigured ? await findPostgresUserById(context.userId) : findUserById(context.userId) || undefined)
    : null;
  const decision = resolveBusinessWrite(context.role, storedBusinessUser?.businessId, targetBusinessId);
  if (decision.allowed === false) {
    recordAudit({
      action: 'business_write_denied',
      resource: 'company',
      resourceId: String(business.id),
      actorRole: context.role === 'user' ? 'citizen' : context.role,
      requestId,
      success: false,
      metadata: { code: decision.code },
    });
    return res.status(decision.status).json({ error: 'Não possui permissão para gravar esta empresa.', code: decision.code });
  }

  try {
    await persistPostgresBusiness({ ...business, id: targetBusinessId });
    res.json({ success: true, business: { ...business, id: targetBusinessId } });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao persistir empresa no banco.' });
  }
});

app.get('/api/events', async (_req, res) => {
  try {
    const events = await listPostgresEvents();
    res.json({ events });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar eventos.' });
  }
});

app.post('/api/events', requireSession, async (req, res) => {
  const requestId = requestIdFrom(req);
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });

  const event = req.body;
  if (!event || !event.id || !event.title) {
    return res.status(400).json({ error: 'id e title são obrigatórios para o evento.' });
  }

  // Um evento é sempre propriedade da empresa organizadora: o businessId vem da
  // sessão, nunca do corpo do pedido, para impedir eventos em nome de terceiros.
  const storedBusinessUser = context.role === 'business'
    ? (databaseConfigured ? await findPostgresUserById(context.userId) : findUserById(context.userId) || undefined)
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
      resourceId: String(event.id),
      actorRole: context.role === 'user' ? 'citizen' : context.role,
      requestId,
      success: false,
      metadata: { code: decision.code },
    });
    return res.status(decision.status).json({ error: 'Não possui permissão para gravar este evento.', code: decision.code });
  }

  try {
    const storedEvent = { ...event, businessId: resolvedBusinessId };
    await persistPostgresEvent(storedEvent);
    res.json({ success: true, event: storedEvent });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao persistir evento no banco.' });
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

app.get('/api/metrics', requireRole('admin'), async (_req, res) => {
  const routes = Array.from(requestMetrics.byRoute.entries()).map(([route, metrics]) => ({
    route,
    count: metrics.count,
    errors: metrics.errors,
    averageMs: metrics.count ? Math.round((metrics.totalMs / metrics.count) * 100) / 100 : 0,
  }));
  res.json({ totalRequests: requestMetrics.total, errors: requestMetrics.errors, routes, database: await getDatabaseObservability() });
});

app.get('/metrics', async (_req, res) => {
  res.type('text/plain').send(await renderPrometheusMetrics(requestMetrics.total, requestMetrics.errors, requestMetrics.byRoute));
});

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
app.post('/api/monetization/requests', requireRole('business'), (req, res) => {
  const { kind, businessId, businessName, serviceId, serviceName, productId, productCode, productName, notes } = req.body || {};
  if (!['content_service', 'advertising'].includes(String(kind)) || typeof businessId !== 'string' || !businessId.trim() || typeof (serviceName || productName) !== 'string') {
    return res.status(400).json({ error: 'Pedido comercial inválido.', code: 'INVALID_MONETIZATION_REQUEST' });
  }
  const request = { id: `MON-REQ-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`, kind, businessId: businessId.trim(), businessName: String(businessName || ''), serviceId, serviceName, productId, productCode, productName, notes: String(notes || '').slice(0, 2000), status: 'requested', createdAt: new Date().toISOString() };
  monetizationRequests.unshift(request);
  persistMonetizationRequests();
  recordAudit({ action: 'monetization_request_created', resource: 'monetization_request', resourceId: request.id, actorRole: 'business', success: true, metadata: { kind, businessId: request.businessId, serviceId, productCode } });
  res.status(201).json({ success: true, request });
});
app.get('/api/monetization/wallet/:businessId', requireRole('admin', 'business'), (req, res) => res.json(monetizationWallets[req.params.businessId] || { postsExtraPurchased: 0, promotionsExtraPurchased: 0, postsExtraUsed: 0, promotionsExtraUsed: 0 }));

const demoUsers: Array<PublicUser & { password: string }> = [
  { id: 'demo-citizen', name: 'Malam Bacar', email: 'cidadao.teste@guigui.com', role: 'user', phone: '+245 955 12 34', neighborhood: 'Bissau Velho', avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80', password: 'Guigui@2026!' },
  { id: 'demo-business', name: 'Coqueiros Bissau', email: 'empresa.teste@guigui.com', role: 'business', phone: '+245 955 88 99', neighborhood: 'Praça dos Heróis', avatarUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=200&q=80', businessId: 'biz-1', businessName: 'Coqueiros Bissau', password: 'Guigui@2026!' },
  { id: 'demo-admin', name: 'Administração Guigui', email: 'admin.teste@guigui.com', role: 'admin', phone: '+245 955 00 00', neighborhood: 'Centro Administrativo', avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80', password: 'Guigui@2026!' },
];

app.post('/api/auth/login', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!email || password.length < 6) return res.status(400).json({ error: 'Indique um e-mail e uma palavra-passe válida.' });

  const stored = databaseConfigured ? await findPostgresUserByEmail(email) : findUserByEmail(email);
  if (stored?.accountStatus === 'deactivated') return res.status(403).json({ error: 'Esta conta está desativada. Contacte o suporte para reativá-la.' });
  if (stored && verifyPassword(password, stored.passwordHash)) {
    if (stored.role === 'admin' && await hasEnabledMfa(stored.id)) {
      const mfaCode = typeof req.body?.mfaCode === 'string' ? req.body.mfaCode : '';
      if (!mfaCode) return res.status(401).json({ error: 'Código MFA obrigatório.', code: 'MFA_REQUIRED' });
      if (!await verifyUserMfa(stored.id, mfaCode)) return res.status(401).json({ error: 'Código MFA inválido ou já utilizado.', code: 'MFA_INVALID' });
    }
    setSessionCookie(res, await createSession({ userId: stored.id, role: stored.role, ipAddress: req.ip, userAgent: req.get('user-agent') }));
    return res.json({ success: true, user: toPublicUser(stored) });
  }
  const demo = demoAccountsEnabled ? demoUsers.find((user) => user.email === email && verifyDemoPassword(user.email, password, user.password)) : undefined;
  if (demo) {
    const { password: _password, ...user } = demo;
    const databaseUser = databaseConfigured
      ? await createPostgresUser({
          name: user.name,
          email: user.email,
          phone: user.phone,
          neighborhood: user.neighborhood,
          role: user.role,
          avatarUrl: user.avatarUrl,
          password,
          ...(user.businessId ? { businessId: user.businessId } : {}),
          ...(user.businessName ? { businessName: user.businessName } : {}),
        }) || await findPostgresUserByEmail(user.email)
      : null;
    const sessionUser = databaseUser ? { ...user, ...toPublicUser(databaseUser) } : user;
    setSessionCookie(res, await createSession({ userId: sessionUser.id, role: sessionUser.role, ipAddress: req.ip, userAgent: req.get('user-agent') }));
    return res.json({ success: true, user: sessionUser });
  }
  res.status(401).json({ error: 'E-mail ou palavra-passe incorretos.' });
});

app.post('/api/auth/mfa/setup', requireRole('admin'), async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : 'admin.teste@guigui.com';
  const setup = await beginMfaSetup(context.userId, email);
  res.json({ success: true, ...setup, warning: 'Guarde o segredo apenas para concluir a configuração. Nunca o publique.' });
});

app.post('/api/auth/mfa/enable', requireRole('admin'), async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  const code = typeof req.body?.code === 'string' ? req.body.code : '';
  if (!await enableMfa(context.userId, code)) return res.status(400).json({ error: 'Código MFA inválido.', code: 'MFA_INVALID' });
  recordAudit({ action: 'mfa_enabled', resource: 'user', resourceId: context.userId, actorRole: 'admin', requestId: requestIdFrom(req), success: true });
  res.json({ success: true });
});

app.post('/api/auth/logout', async (req, res) => {
  const token = sessionTokenFromRequest(req);
  const revoked = await revokeSession(token);
  clearSessionCookie(res);
  res.json({ success: true, revoked });
});

app.post('/api/auth/sessions/revoke-all', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  const revoked = await revokeAllUserSessions(context.userId);
  clearSessionCookie(res);
  recordAudit({ action: 'sessions_revoked_all', resource: 'session', actorRole: context.role === 'user' ? 'citizen' : context.role, requestId: requestIdFrom(req), success: true, metadata: { revoked } });
  res.json({ success: true, revoked });
});

app.get('/api/auth/session', async (req, res) => {
  const session = await getSession(sessionTokenFromRequest(req));
  res.json({ authenticated: Boolean(session && session.role), ...(session && session.role ? { userId: session.userId, role: session.role, expiresAt: session.expiresAt } : {}) });
});

app.post('/api/business/team/invitations', requireRole('business'), async (req, res) => {
  const { recipientEmail, recipientName, businessId, businessName, role, permissions, roleLabel, token } = req.body || {};
  if (
    typeof recipientEmail !== 'string'
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail.trim())
    || typeof recipientName !== 'string'
    || typeof businessName !== 'string'
    || typeof businessId !== 'string'
    || !['manager', 'editor', 'finance', 'support'].includes(role)
    || !permissions || typeof permissions !== 'object'
    || typeof roleLabel !== 'string'
    || typeof token !== 'string'
    || token.trim().length < 32
  ) {
    return res.status(400).json({ error: 'Dados do convite inválidos.', code: 'INVALID_TEAM_INVITATION' });
  }
  try {
    createTeamInvitation({ email: recipientEmail, name: recipientName, businessId, businessName, role, permissions }, token);
    await sendTeamInvitation({
      recipientEmail: recipientEmail.trim().toLowerCase(),
      recipientName: recipientName.trim(),
      businessName: businessName.trim(),
      roleLabel: roleLabel.trim(),
      token: token.trim(),
    });
    return res.status(201).json({ success: true, message: 'Convite enviado por e-mail.' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Não foi possível enviar o convite por e-mail.';
    return res.status(503).json({ error: message, code: 'TEAM_INVITATION_EMAIL_FAILED' });
  }
});

app.get('/api/business/team/invitations/:token', (req, res) => {
  const invitation = inspectTeamInvitation(req.params.token);
  if (!invitation) return res.status(404).json({ error: 'Convite inválido, expirado ou já utilizado.', code: 'INVALID_TEAM_INVITATION' });
  res.json({ invitation });
});

app.post('/api/business/team/invitations/accept', (req, res) => {
  const { token, password, phone, neighborhood } = req.body || {};
  if (typeof token !== 'string' || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'O convite e uma palavra-passe com pelo menos 6 caracteres são obrigatórios.', code: 'INVALID_TEAM_ACCEPTANCE' });
  }
  const user = acceptTeamInvitation(token, password, typeof phone === 'string' ? phone : '', typeof neighborhood === 'string' ? neighborhood : 'Bissau');
  if (!user) return res.status(409).json({ error: 'Convite inválido, expirado, já utilizado ou e-mail já registado.', code: 'TEAM_INVITATION_UNAVAILABLE' });
  res.status(201).json({ success: true, user: toPublicUser(user) });
});

app.post('/api/auth/change-password', async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  if (!email || currentPassword.length < 6 || newPassword.length < 6) {
    return res.status(400).json({ error: 'Indique a conta e passwords com pelo menos 6 carateres.' });
  }
  const updated = databaseConfigured
    ? await changePostgresUserPassword(email, currentPassword, newPassword)
    : changeUserPassword(email, currentPassword, newPassword) || changeDemoPassword(email, currentPassword, newPassword);
  if (!updated) return res.status(401).json({ error: 'A palavra-passe actual não corresponde à conta.' });
  res.json({ success: true, message: 'Palavra-passe actualizada com sucesso.' });
});

app.post('/api/account/deactivate', requireSession, async (req, res) => {
  const requestId = requestIdFrom(req);
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  if (!currentPassword) return res.status(400).json({ error: 'Confirme a palavra-passe atual.' });
  const stored = databaseConfigured ? await findPostgresUserById(context.userId) : findUserById(context.userId) || undefined;
  if (!stored) return res.status(404).json({ error: 'Conta não encontrada no backend.' });
  const requestedEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (requestedEmail && requestedEmail !== stored.email.toLowerCase()) {
    recordAudit({ action: 'account_deactivation_denied', resource: 'user', resourceId: context.userId, actorRole: context.role === 'user' ? 'citizen' : context.role, requestId, success: false, metadata: { reason: 'session_account_mismatch' } });
    return res.status(403).json({ error: 'A operação deve ser executada na conta autenticada.', code: 'ACCOUNT_IDENTITY_MISMATCH' });
  }
  if (!verifyPassword(currentPassword, stored.passwordHash)) return res.status(401).json({ error: 'A palavra-passe atual não corresponde à conta.' });
  if (!(databaseConfigured ? await deactivatePostgresUser(stored.email) : deactivateUserAccount(stored.email))) return res.status(404).json({ error: 'Não foi possível desativar a conta.' });
  const revoked = await revokeAllUserSessions(context.userId);
  clearSessionCookie(res);
  recordAudit({ action: 'account_deactivated', resource: 'user', resourceId: context.userId, actorRole: context.role === 'user' ? 'citizen' : context.role, actorName: `user:${context.userId}`, requestId, success: true, metadata: { revoked } });
  res.json({ success: true, message: 'Conta desativada temporariamente.' });
});

app.post('/api/account/delete', requireSession, async (req, res) => {
  const requestId = requestIdFrom(req);
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
  if (!currentPassword) return res.status(400).json({ error: 'Confirme a palavra-passe atual.' });
  const stored = databaseConfigured ? await findPostgresUserById(context.userId) : findUserById(context.userId) || undefined;
  if (!stored) return res.status(404).json({ error: 'Conta não encontrada no backend.' });
  const requestedEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (requestedEmail && requestedEmail !== stored.email.toLowerCase()) {
    recordAudit({ action: 'account_deletion_denied', resource: 'user', resourceId: context.userId, actorRole: context.role === 'user' ? 'citizen' : context.role, requestId, success: false, metadata: { reason: 'session_account_mismatch' } });
    return res.status(403).json({ error: 'A operação deve ser executada na conta autenticada.', code: 'ACCOUNT_IDENTITY_MISMATCH' });
  }
  if (!verifyPassword(currentPassword, stored.passwordHash)) return res.status(401).json({ error: 'A palavra-passe atual não corresponde à conta.' });
  if (!(databaseConfigured ? await deletePostgresUser(stored.email) : deleteUserAccount(stored.email))) return res.status(404).json({ error: 'Não foi possível eliminar a conta.' });
  const revoked = await revokeAllUserSessions(context.userId);
  clearSessionCookie(res);
  recordAudit({ action: 'account_deleted', resource: 'user', resourceId: context.userId, actorRole: context.role === 'user' ? 'citizen' : context.role, actorName: `user:${context.userId}`, requestId, success: true, metadata: { revoked } });
  res.json({ success: true, message: 'Conta eliminada permanentemente.' });
});

app.post('/api/auth/request-password-reset', (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Indique um e-mail válido.' });
  const token = createPasswordReset(email);
  const response: { success: boolean; message: string; resetToken?: string } = {
    success: true,
    message: 'Se existir uma conta com este e-mail, receberá instruções para recuperar a palavra-passe.',
  };
  if (token && !isProduction) response.resetToken = token;
  res.json(response);
});

app.post('/api/auth/reset-password', (req, res) => {
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
  if (!token || newPassword.length < 8) return res.status(400).json({ error: 'O código e a nova palavra-passe são obrigatórios. Use pelo menos 8 carateres.' });
  if (!resetPassword(token, newPassword)) return res.status(400).json({ error: 'O código expirou ou já foi utilizado.' });
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
    ? (databaseConfigured ? await findPostgresUserById(context.userId) : findUserById(context.userId) || undefined)
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
  communicationStreams.add(res);
  const heartbeat = setInterval(() => { try { res.write(': heartbeat\n\n'); } catch { clearInterval(heartbeat); communicationStreams.delete(res); } }, 20000);
  req.on('close', () => { clearInterval(heartbeat); communicationStreams.delete(res); });
});

app.get('/api/conversations', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.' });
  if (context.role !== 'user' && context.role !== 'business') return res.status(403).json({ error: 'As mensagens comerciais estão disponíveis apenas para cidadãos e empresas.' });
  const stored = context.role === 'business'
    ? (databaseConfigured ? await findPostgresUserById(context.userId) : findUserById(context.userId) || undefined)
    : null;
  const result = await listPostgresConversations(context.userId, context.role, stored?.businessId);
  res.json(result);
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
  broadcastCommunication('conversation', { conversationId: conversationId || id, type: 'new_message' });
  res.status(201).json({ id: conversationId || id });
});

app.post('/api/conversations/:id/read', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  if (!context || (context.role !== 'user' && context.role !== 'business')) return res.status(401).json({ error: 'Sessão autenticada necessária.' });
  const stored = context.role === 'business'
    ? (databaseConfigured ? await findPostgresUserById(context.userId) : findUserById(context.userId) || undefined)
    : null;
  const marked = await markPostgresConversationRead({ conversationId: req.params.id, userId: context.userId, role: context.role, businessId: stored?.businessId });
  if (!marked) return res.status(403).json({ error: 'Não participa nesta conversa.' });
  broadcastCommunication('conversation', { conversationId: req.params.id, type: 'read' });
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
    ? (databaseConfigured ? await findPostgresUserById(context.userId) : findUserById(context.userId) || undefined)
    : null;
  try {
    await createPostgresConversationMessage({ id: `MSG-${randomUUID()}`, conversationId: req.params.id, senderId: context.userId, senderRole: context.role, businessId: stored?.businessId, text, clientMessageId, replyToId, messageType });
  } catch (error) {
    if (error instanceof Error && error.message === 'CONVERSATION_ACCESS_DENIED') return res.status(403).json({ error: 'Não participa nesta conversa.' });
    throw error;
  }
  broadcastCommunication('conversation', { conversationId: req.params.id, type: 'new_message' });
  res.status(201).json({ success: true });
});

app.get('/api/support/tickets/mine', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.' });
  const stored = context.role === 'business'
    ? (databaseConfigured ? await findPostgresUserById(context.userId) : findUserById(context.userId) || undefined)
    : null;
  res.json({ tickets: await listPostgresSupportTickets(context.userId, context.role, stored?.businessId) });
});

app.post('/api/support/tickets/:id/replies', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  const text = String(req.body?.text || '').trim();
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.' });
  if (!text || !['user', 'business', 'admin'].includes(context.role)) return res.status(400).json({ error: 'Resposta inválida.' });
  const stored = context.role === 'business'
    ? (databaseConfigured ? await findPostgresUserById(context.userId) : findUserById(context.userId) || undefined)
    : null;
  try {
    await createPostgresSupportReply({ id: `REP-${randomUUID()}`, ticketId: req.params.id, senderId: context.userId, senderRole: context.role, businessId: stored?.businessId, text, status: context.role === 'admin' ? 'in_progress' : undefined });
  } catch (error) {
    if (error instanceof Error && error.message === 'SUPPORT_ACCESS_DENIED') return res.status(403).json({ error: 'Sem acesso a este pedido de suporte.' });
    throw error;
  }
  broadcastCommunication('support', { ticketId: req.params.id, type: 'new_reply' });
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
  broadcastCommunication('support', { ticketId: req.params.id, type: 'status_changed', status });
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

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, phone = '+245 955 00 00', neighborhood = 'Bissau', role = 'user', businessName, businessId } = req.body || {};
  if (typeof name !== 'string' || name.trim().length < 2 || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) || typeof password !== 'string' || password.length < 6) {
    return res.status(400).json({ error: 'Indique um nome, e-mail válido e palavra-passe com pelo menos 6 carateres.' });
  }
  if (role !== 'user' && role !== 'business') return res.status(400).json({ error: 'Tipo de conta inválido.' });

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const newBusinessId = role === 'business' ? `biz-${Date.now()}-${randomBytes(3).toString('hex')}` : undefined;
    const normalizedBusinessName = role === 'business' ? String(businessName || name).trim() : undefined;
    const existingUser = databaseConfigured ? await findPostgresUserByEmail(normalizedEmail) : findUserByEmail(normalizedEmail);
    if (existingUser) return res.status(409).json({ error: 'Já existe uma conta com este e-mail.' });
    if (newBusinessId && normalizedBusinessName) {
      await persistPostgresBusiness({
        id: newBusinessId,
        name: normalizedBusinessName,
        status: 'pending',
        createdAt: new Date().toISOString(),
        data: { email: normalizedEmail, phone: String(phone), neighborhood: String(neighborhood), ownerEmail: normalizedEmail },
      });
    }
    const user = databaseConfigured
      ? await createPostgresUser({ name, email, password, phone: String(phone), neighborhood: String(neighborhood), role, ...(newBusinessId ? { businessId: newBusinessId, businessName: normalizedBusinessName } : {}) })
      : createUser({ name, email, password, phone: String(phone), neighborhood: String(neighborhood), role, ...(newBusinessId ? { businessId: newBusinessId, businessName: normalizedBusinessName } : {}) });
    if (!user) return res.status(409).json({ error: 'Já existe uma conta com este e-mail.' });
    if (databaseConfigured && newBusinessId) await assignPostgresBusinessOwner(newBusinessId, user.id);
    const publicUser = { ...toPublicUser(user), ...(newBusinessId ? { businessId: newBusinessId, businessName: normalizedBusinessName } : {}) };
    setSessionCookie(res, await createSession({ userId: publicUser.id, role: publicUser.role, ipAddress: req.ip, userAgent: req.get('user-agent') }));
    recordAudit({ action: 'account_registered', resource: 'user', resourceId: publicUser.id, actorRole: role === 'user' ? 'citizen' : 'business', requestId: requestIdFrom(req), success: true, metadata: newBusinessId ? { businessId: newBusinessId } : undefined });
    res.status(201).json({ success: true, user: publicUser, ...(newBusinessId ? { business: { id: newBusinessId, name: normalizedBusinessName, status: 'pending' } } : {}) });
  } catch (error) {
    // Uma falha de base de dados nunca pode derrubar o servidor: o registo é público.
    recordAudit({
      action: 'public_registration_failed',
      resource: 'user',
      resourceId: String(email || '').toLowerCase(),
      actorRole: 'system',
      requestId: requestIdFrom(req),
      success: false,
      metadata: { reason: error instanceof Error ? error.message : 'unknown' },
    });
    res.status(400).json({ error: 'Não foi possível concluir o registo. Verifique os dados e tente novamente.', code: 'REGISTRATION_FAILED' });
  }
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

    const logEntry = {
      id: 'MOD-' + Date.now(),
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
  const ownerReply = normaliseReviewComment(req.body?.ownerReply);
  if (ownerReply.length < 2) {
    return res.status(400).json({ error: 'Escreva a resposta pública.', code: 'REVIEW_REPLY_REQUIRED' });
  }
  if (context.role === 'business') {
    const storedBusinessUser = databaseConfigured ? await findPostgresUserById(context.userId) : findUserById(context.userId) || undefined;
    if (!storedBusinessUser?.businessId) {
      return res.status(403).json({ error: 'A sua conta não está associada a um negócio.', code: 'REVIEW_REPLY_FORBIDDEN' });
    }
  }
  const replied = await replyPostgresReview(req.params.reviewId, ownerReply);
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

  if (isDecision && context.role !== 'admin') {
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
  } else if (action === 'appeal') {
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

// Ticket Purchase API (Generates Ticket + Simulates SMS Notification)
app.post('/api/tickets/purchase', async (req, res) => {
  try {
    const requestId = requestIdFrom(req);
    const validation = validatePurchaseInput({ ...req.body, priceXOF: req.body?.priceXOF ?? 5000 });
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

    if (isProduction && !ticketSigningSecret) {
      return res.status(503).json({
        error: 'Emissão temporariamente indisponível: TICKET_SIGNING_SECRET não configurado.',
        code: 'TICKET_SECURITY_NOT_CONFIGURED',
        requestId,
      });
    }

    cleanupIdempotency();
    const idempotencyKey = req.header('idempotency-key')?.trim();
    if (idempotencyKey) {
      if (idempotencyKey.length > 160) {
        return res.status(400).json({ error: 'Chave de idempotência inválida.', code: 'INVALID_IDEMPOTENCY_KEY', requestId });
      }
      const previous = purchaseIdempotency.get(idempotencyKey);
      if (previous) return res.status(200).json(previous.response);
    }

    const { eventId, businessId, eventTitle, ticketTypeName, priceXOF, buyerName, buyerPhone, holderName, holderPhone, paymentMethod } = validation.value!;
    const monetizationCatalog = normaliseMonetizationCatalog(monetizationCatalogStore);
    const ticketQuantity = Number.isInteger(Number(req.body?.quantity)) ? Math.min(100, Math.max(1, Number(req.body.quantity))) : 1;
    const ticketUnitPrice = Number(req.body?.pricePerTicketXOF || (Number(priceXOF || 5000) / ticketQuantity));
    const ticketFeeBreakdown = calculateTicketFees(monetizationCatalog, ticketUnitPrice, ticketQuantity);
    const chargedAmountXOF = Number(req.body?.chargedAmountXOF ?? ticketFeeBreakdown.buyerTotal);
    if (chargedAmountXOF !== ticketFeeBreakdown.buyerTotal) {
      return res.status(409).json({ error: 'O total do checkout não corresponde à política de taxas actual.', code: 'TICKET_TOTAL_MISMATCH', expectedAmountXOF: ticketFeeBreakdown.buyerTotal, requestId });
    }
    const purchaseTimestamp = new Date().toISOString();
    const newTickets: TicketForValidation[] = Array.from({ length: ticketQuantity }, (_, index) => {
      const { ticketCode, qrToken, pinCode } = generateTicketIdentifiers();
      const ticket: TicketForValidation = {
        id: `TKT-${Date.now()}-${index + 1}-${randomBytes(2).toString('hex').toUpperCase()}`,
        ticketCode,
        eventId,
        ...(businessId ? { businessId } : {}),
        eventTitle: eventTitle || 'Evento Cultural Guigui',
        ticketTypeName: ticketTypeName || 'Entrada Geral',
        priceXOF: ticketUnitPrice,
        buyerName,
        buyerPhone,
        ...(holderName && holderPhone ? { holderName, holderPhone } : {}),
        qrToken,
        pinCode,
        status: 'valid',
        purchasedAt: purchaseTimestamp,
        expiresAt: calculateTicketExpiry(req.body?.eventDate, req.body?.eventTime),
        paymentMethod,
      };
      if (ticketSigningSecret) ticket.signature = signTicket(ticket, ticketSigningSecret);
      return ticket;
    });
    const primaryTicket = newTickets[0];

    const txnId = `TXN-${Date.now()}-${randomBytes(3).toString('hex').toUpperCase()}`;
    const paymentAdapter = paymentAdapters[paymentMethod];
    const paymentIntent = paymentAdapter.createIntent({
      transactionId: txnId,
          amountXOF: chargedAmountXOF,
          payerName: primaryTicket.buyerName,
      payerPhone: primaryTicket.buyerPhone,
      description: `${primaryTicket.ticketTypeName} - ${primaryTicket.eventTitle} (${ticketQuantity} unidade${ticketQuantity === 1 ? '' : 's'})`,
      provider: paymentMethod,
      metadata: { eventId: primaryTicket.eventId || 'evt-1', businessId: primaryTicket.businessId || '', ticketQuantity: String(ticketQuantity) },
    });
    const paymentTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const newTxn = {
      id: txnId,
      useCase: 'event_tickets',
      useCaseLabel: `Bilhete ${primaryTicket.ticketTypeName} - ${primaryTicket.eventTitle}`,
      businessId: primaryTicket.businessId,
      businessName: primaryTicket.eventTitle,
      payerName: primaryTicket.buyerName,
      payerPhone: primaryTicket.buyerPhone,
      amountXOF: chargedAmountXOF,
      ticketBaseAmountXOF: ticketUnitPrice * ticketQuantity,
      platformFeeXOF: ticketFeeBreakdown.platformRevenue,
      provider: paymentMethod,
      providerRef: paymentIntent.providerRef,
      productId: 'product-ticket-fee',
      productCode: 'TICKET_FEE',
      quantity: ticketQuantity,
      status: paymentIntent.state === 'confirmed' ? 'confirmed_api' : paymentIntent.state === 'failed' ? 'failed' : 'pending_provider',
      isApiIntegrationReady: paymentAdapter.mode === 'live',
      providerMode: paymentAdapter.mode,
      checkoutUrl: paymentIntent.checkoutUrl,
      paymentInstructions: paymentIntent.instructions,
      ticketId: undefined as string | undefined,
      ticketIds: [] as string[],
      ticketCode: undefined as string | undefined,
      ticketCodes: [] as string[],
      qrToken: undefined as string | undefined,
      qrTokens: [] as string[],
      ticketDraft: undefined as
        | { eventId?: string; eventTitle?: string; ticketTypeName?: string; eventDate?: string; eventTime?: string; quantity?: number }
        | undefined,
      createdAt: paymentTimestamp,
      ...(paymentIntent.state === 'confirmed' ? { confirmedAt: paymentTimestamp, confirmedBy: `${paymentAdapter.provider} (${paymentAdapter.mode})` } : {}),
    };
    paymentTransactions.push(newTxn);
    if (paymentIntent.state === 'confirmed') recordMonetizationFulfillment(newTxn);
    persistPayments();

    if (paymentIntent.state !== 'confirmed') {
      // Regra 4.7: reserva temporária com prazo definido. Os bilhetes ficam em
      // 'pending' (Regra 11) até o pagamento confirmar; se o prazo expirar sem
      // confirmação, a quantidade reservada é libertada pelo job de limpeza.
      const reservedUntil = new Date(Date.now() + TICKET_RESERVATION_TTL_MS).toISOString();
      for (const ticket of newTickets) {
        ticket.status = 'pending';
        ticket.reservedUntil = reservedUntil;
      }
      newTickets.forEach((ticket) => {
        ticketsDb.set(ticket.qrToken, ticket);
        ticketsDb.set(ticket.pinCode!, ticket);
        ticketsDb.set(ticket.ticketCode, ticket);
      });
      const reservationSession = await sessionContext(req);
      await persistPostgresTickets(newTickets, reservationSession?.role === 'user' ? reservationSession.userId : undefined);
      newTxn.ticketId = primaryTicket.id;
      newTxn.ticketIds = newTickets.map((ticket) => ticket.id);
      newTxn.ticketCode = primaryTicket.ticketCode;
      newTxn.ticketCodes = newTickets.map((ticket) => ticket.ticketCode);
      newTxn.qrToken = primaryTicket.qrToken;
      newTxn.qrTokens = newTickets.map((ticket) => ticket.qrToken);
      // Rascunho de recuperação: se a reserva expirar antes da confirmação,
      // o webhook consegue emitir bilhetes novos sem cobrar duas vezes (Regra 4.5).
      newTxn.ticketDraft = {
        eventId,
        eventTitle: eventTitle || 'Evento Cultural Guigui',
        ticketTypeName: ticketTypeName || 'Entrada Geral',
        eventDate: req.body?.eventDate,
        eventTime: req.body?.eventTime,
        quantity: ticketQuantity,
      };
      persistTickets();
      recordAudit({ action: 'ticket_payment_pending', resource: 'payment', resourceId: txnId, actorRole: 'citizen', requestId, success: true, metadata: { provider: paymentMethod, providerRef: paymentIntent.providerRef, reservedUntil, ticketIds: newTxn.ticketIds } });
      return res.status(202).json({
        success: false,
        paymentPending: true,
        transaction: newTxn,
        reservationExpiresAt: reservedUntil,
        message: paymentIntent.instructions || 'Pagamento pendente. Os bilhetes ficam reservados até à confirmação da operadora.',
        requestId,
      });
    }

    newTickets.forEach((ticket) => {
      ticketsDb.set(ticket.qrToken, ticket);
      ticketsDb.set(ticket.pinCode!, ticket); // allow QR token, código e PIN a localizar o bilhete
      ticketsDb.set(ticket.ticketCode, ticket);
    });
    const purchaseSession = await sessionContext(req);
    await persistPostgresTickets(newTickets, purchaseSession?.role === 'user' ? purchaseSession.userId : undefined);
    newTxn.ticketId = primaryTicket.id;
    newTxn.ticketIds = newTickets.map((ticket) => ticket.id);
    newTxn.ticketCode = primaryTicket.ticketCode;
    newTxn.ticketCodes = newTickets.map((ticket) => ticket.ticketCode);
    newTxn.qrToken = primaryTicket.qrToken;
    newTxn.qrTokens = newTickets.map((ticket) => ticket.qrToken);
    persistTickets();
    persistPayments();
    if (purchaseSession?.role === 'user') {
      await persistPostgresNotification({
        id: `notif-ticket-${txnId}`,
        userId: purchaseSession.userId,
        category: 'order_redemption',
        title: 'O seu bilhete está disponível',
        message: `A compra para ${primaryTicket.eventTitle} foi confirmada. O código e o QR Code estão disponíveis em Área pessoal > Meus bilhetes.`,
        metadata: {
          orderId: txnId,
          transactionId: txnId,
          ticketId: primaryTicket.id,
          ticketCode: primaryTicket.ticketCode,
          eventId: primaryTicket.eventId,
        },
        createdAt: new Date().toISOString(),
      });

    }

    // Entrega real do bilhete por SMS. O estado devolvido pelo gateway viaja
    // na resposta, para o cliente saber se o SMS saiu ou ficou por entregar.
    const message1 = `[Guigui.com] ${ticketQuantity > 1 ? `${ticketQuantity} bilhetes confirmados` : 'Bilhete confirmado'} para ${primaryTicket.eventTitle}! ${ticketQuantity > 1 ? `Códigos: ${newTickets.map((ticket) => ticket.ticketCode).join(', ')}` : `Seu código: ${primaryTicket.ticketCode}`}.`;
    const message2 = `[Guigui.com] ${ticketQuantity > 1 ? `Foram gerados ${ticketQuantity} PINs individuais. O primeiro é ${primaryTicket.pinCode}; consulte os restantes na sua conta.` : `O seu código PIN de segurança para a porta do evento é: ${primaryTicket.pinCode}.`} Não partilhe com terceiros.`;
    const smsDelivery1 = await sendSms({ to: primaryTicket.buyerPhone, text: message1, reference: `${txnId}-1` });
    const smsDelivery2 = await sendSms({ to: primaryTicket.buyerPhone, text: message2, reference: `${txnId}-2` });
    recordAudit({
      action: 'ticket_sms_dispatch',
      resource: 'ticket',
      resourceId: txnId,
      actorRole: 'system',
      requestId,
      success: smsDelivery1.state !== 'failed',
      metadata: { mode: smsDelivery1.mode, state1: smsDelivery1.state, state2: smsDelivery2.state, providerRef: smsDelivery1.providerRef },
    });

    const responsePayload = {
      success: true,
      ticket: primaryTicket,
      tickets: newTickets,
      feeBreakdown: ticketFeeBreakdown,
      transaction: newTxn,
      sms: {
        mode: smsDelivery1.mode,
        delivered: smsDelivery1.state === 'delivered' || smsDelivery1.state === 'accepted',
        state1: smsDelivery1.state,
        state2: smsDelivery2.state,
        ...(smsDelivery1.error ? { error: smsDelivery1.error } : {}),
      },
      // Mantido para o ecrã de simulação local, que mostra o conteúdo das mensagens.
      smsSimulated: { message1, message2 },
    };
    if (idempotencyKey) {
      purchaseIdempotency.set(idempotencyKey, { createdAt: Date.now(), response: responsePayload });
    }
    recordAudit({
      action: 'ticket_issued',
      resource: 'ticket',
      resourceId: txnId,
      actorRole: 'citizen',
      requestId,
      success: true,
      metadata: { eventId: primaryTicket.eventId, paymentMethod: primaryTicket.paymentMethod, amountXOF: chargedAmountXOF, ticketIds: newTickets.map((ticket) => ticket.id) },
    });
    res.json(responsePayload);
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao emitir bilhete', details: err.message });
  }
});

app.get('/api/tickets/mine', requireSession, async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sessão autenticada necessária.', code: 'AUTHENTICATION_REQUIRED' });
  const tickets = databaseConfigured ? await listPostgresTicketsForUser(context.userId) : [];
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
  if (!allowTicketLookup(phone)) {
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

// Reenvio de SMS com cooldown e limite diário, entregue pelo gateway configurado.
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
  // Reenvio pelo gateway configurado, com o estado real de entrega na resposta.
  const resendMessage = `[Guigui.com] Reenvio do seu bilhete ${ticket.ticketCode} para ${ticket.eventTitle || 'o evento'}. Código: ${ticket.ticketCode}.`;
  const resendDelivery = await sendSms({ to: phone, text: resendMessage, reference: `resend-${ticket.id}` });
  recordAudit({
    action: 'ticket_sms_resend_requested',
    resource: 'ticket',
    resourceId: ticket.id,
    actorRole: 'citizen',
    requestId,
    success: resendDelivery.state !== 'failed',
    metadata: { mode: resendDelivery.mode, state: resendDelivery.state, attempt: count + 1, providerRef: resendDelivery.providerRef },
  });
  const delivered = resendDelivery.state === 'delivered' || resendDelivery.state === 'accepted';
  return res.json({
    success: delivered,
    simulated: resendDelivery.state === 'simulated',
    smsState: resendDelivery.state,
    mode: resendDelivery.mode,
    message: resendDelivery.state === 'simulated'
      ? 'Gateway de SMS não configurado: o pedido foi registado, mas o SMS não foi entregue.'
      : delivered
        ? 'SMS reenviado.'
        : `Não foi possível entregar o SMS (${resendDelivery.error || resendDelivery.state}).`,
    delivery: { ticketLink: `/bilhete/${encodeURIComponent(ticket.qrToken)}`, pinSent: delivered },
    requestId,
  });
});

// ============================================================================
app.get('/api/tickets/sold', requireRole('business', 'admin'), async (req, res) => {
  const context = await sessionContext(req);
  if (!context) return res.status(401).json({ error: 'Sess�o autenticada necess�ria.', code: 'AUTHENTICATION_REQUIRED' });
  const stored = context.role === 'business'
    ? (databaseConfigured ? await findPostgresUserById(context.userId) : findUserById(context.userId) || undefined)
    : null;
  const companyId = context.role === 'admin'
    ? (typeof req.query.companyId === 'string' ? req.query.companyId : undefined)
    : stored?.businessId;
  if (context.role === 'business' && !companyId) {
    return res.status(403).json({ error: 'A sua conta n�o est� associada a uma empresa.', code: 'BUSINESS_ACCOUNT_REQUIRED' });
  }
  const eventId = typeof req.query.eventId === 'string' && req.query.eventId.trim() ? req.query.eventId.trim() : undefined;
  const tickets = companyId && databaseConfigured ? await listPostgresTicketsForCompany(companyId, eventId) : [];
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
  res.json({ tickets, totals });
});
// Scanner authorization endpoint. The frontend must not decide access locally.
app.post('/api/tickets/scanner-auth', requireRole('business'), (req, res) => {
  const requestId = requestIdFrom(req);
  const eventId = typeof req.body?.eventId === 'string' ? req.body.eventId.trim() : '';
  const businessId = typeof req.body?.businessId === 'string' ? req.body.businessId.trim() : '';
  if (!eventId || !businessId) {
    recordAudit({ action: 'scanner_login_denied', resource: 'scanner', actorRole: 'scanner', requestId, success: false, metadata: { reason: 'missing_scope' } });
    return res.status(400).json({ authorized: false, code: 'SCANNER_SCOPE_REQUIRED', message: 'O scanner deve indicar o evento e a empresa organizadora.', requestId });
  }
  if (!matchesScannerDoorCode(req.body?.doorCode)) {
    recordAudit({ action: 'scanner_login_denied', resource: 'scanner', actorRole: 'scanner', requestId, success: false });
    return res.status(403).json({ authorized: false, code: 'SCANNER_UNAUTHORIZED', message: 'Código de portaria inválido.', requestId });
  }
  recordAudit({ action: 'scanner_login_authorized', resource: 'scanner', actorRole: 'scanner', requestId, success: true });
  return res.json({ authorized: true, code: 'SCANNER_AUTHORIZED', requestId });
});
/**
 * Manifesto offline do scanner (GUI-3.5.09). Descarregado antes de a equipa
 * ficar sem rede, cont�m apenas os bilhetes v�lidos do evento.
 */
app.post('/api/tickets/offline-manifest', requireRole('business'), async (req, res) => {
  const requestId = requestIdFrom(req);
  const eventId = typeof req.body?.eventId === 'string' ? req.body.eventId.trim() : '';
  const doorCode = typeof req.body?.doorCode === 'string' ? req.body.doorCode : '';
  if (!eventId) return res.status(400).json({ error: 'Indique o evento.', code: 'SCANNER_SCOPE_REQUIRED' });
  if (!ticketSigningSecret) return res.status(503).json({ error: 'Assinatura de bilhetes n�o configurada.', code: 'TICKET_SIGNING_UNAVAILABLE' });
  if (!matchesScannerDoorCode(doorCode)) {
    recordAudit({ action: 'scanner_manifest_denied', resource: 'scanner', actorRole: 'scanner', requestId, success: false });
    return res.status(403).json({ error: 'Scanner n�o autorizado.', code: 'SCANNER_UNAUTHORIZED' });
  }

  // A empresa organizadora vem da sess�o, nunca do corpo do pedido.
  const stored = databaseConfigured
    ? await findPostgresUserById((await sessionContext(req))?.userId || '')
    : findUserById((await sessionContext(req))?.userId || '') || undefined;
  const manifest = await buildOfflineManifest(eventId, stored?.businessId || '', ticketSigningSecret);
  recordAudit({ action: 'scanner_manifest_downloaded', resource: 'scanner', actorRole: 'scanner', requestId, success: true, metadata: { eventId, tickets: manifest.tickets.length } });
  res.json({ manifest, requestId });
});

/**
 * Sincroniza as entradas validadas offline (GUI-3.5.10). O servidor � a
 * autoridade e devolve os casos de duplica��o para o scanner corrigir.
 */
app.post('/api/tickets/validate-batch', requireRole('business'), async (req, res) => {
  const requestId = requestIdFrom(req);
  const doorCode = typeof req.body?.doorCode === 'string' ? req.body.doorCode : '';
  const records = Array.isArray(req.body?.records) ? req.body.records : [];
  if (!matchesScannerDoorCode(doorCode)) {
    recordAudit({ action: 'scanner_batch_denied', resource: 'scanner', actorRole: 'scanner', requestId, success: false });
    return res.status(403).json({ error: 'Scanner n�o autorizado.', code: 'SCANNER_UNAUTHORIZED' });
  }
  if (records.length === 0) return res.json({ outcomes: [], duplicates: 0, requestId });
  if (records.length > 2000) return res.status(413).json({ error: 'Lote demasiado grande.', code: 'BATCH_TOO_LARGE' });

  const outcomes = await syncOfflineValidations(records as OfflineValidationRecord[]);
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

    if (!eventId || !businessId) {
      recordAudit({ action: 'scanner_denied', resource: 'ticket', actorRole: 'scanner', requestId, success: false, metadata: { reason: 'missing_scope' } });
      return res.status(400).json({ valid: false, status: 'unauthorized_scanner', code: 'SCANNER_SCOPE_REQUIRED', message: 'A validação exige o evento e a empresa organizadora.', requestId });
    }

    if (!matchesScannerDoorCode(doorCode)) {
      recordAudit({ action: 'scanner_denied', resource: 'ticket', actorRole: 'scanner', requestId, success: false });
      return res.status(403).json({ valid: false, status: 'unauthorized_scanner', code: 'SCANNER_UNAUTHORIZED', message: 'Scanner não autorizado para validar bilhetes.', requestId });
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
    ? (databaseConfigured ? await findPostgresUserById(context.userId) : findUserById(context.userId) || undefined)
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
      manualProofReference,
    } = req.body;

    const commercialValidation = resolveCommercialPayment(req.body as Record<string, unknown>);
    if (!commercialValidation.ok) {
      recordAudit({ action: 'commercial_payment_rejected', resource: 'payment', actorRole: 'citizen', requestId: requestIdFrom(req), success: false, metadata: { code: commercialValidation.code, expectedAmountXOF: commercialValidation.expectedAmountXOF } });
      return res.status(commercialValidation.status).json({ error: commercialValidation.error, code: commercialValidation.code, ...(commercialValidation.expectedAmountXOF ? { expectedAmountXOF: commercialValidation.expectedAmountXOF } : {}) });
    }

    cleanupIdempotency();
    const idempotencyKey = req.header('idempotency-key')?.trim();
    if (idempotencyKey && idempotencyKey.length > 160) {
      return res.status(400).json({ error: 'Chave de idempotência inválida.', code: 'INVALID_IDEMPOTENCY_KEY', requestId });
    }
    if (idempotencyKey) {
      const previous = paymentIdempotency.get(idempotencyKey);
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
    const isManual = normalizedPayment.provider === 'manual_transfer' || !!manualProofReference;
    const paymentAdapter = paymentAdapters[normalizedPayment.provider];
    const paymentIntent = isManual
      ? paymentAdapters.manual_transfer.createIntent({
          transactionId: txnId,
          amountXOF: normalizedPayment.amountXOF,
          payerName: normalizedPayment.payerName,
          payerPhone: normalizedPayment.payerPhone,
          description: useCaseLabel || 'Pagamento Guigui.com',
          provider: 'manual_transfer',
        })
      : paymentAdapter.createIntent({
          transactionId: txnId,
          amountXOF: normalizedPayment.amountXOF,
          payerName: normalizedPayment.payerName,
          payerPhone: normalizedPayment.payerPhone,
          description: useCaseLabel || 'Pagamento Guigui.com',
          provider: normalizedPayment.provider,
          metadata: { useCase: String(useCase || 'subscription_initial'), businessId: String(businessId || '') },
        });
    const paymentStatus = paymentIntent.state === 'confirmed' ? 'confirmed_api' : paymentIntent.state === 'failed' ? 'failed' : isManual ? 'pending_manual_confirmation' : 'pending_provider';
    const paymentTimestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const newTxn = {
      id: txnId,
      useCase: useCase || 'subscription_initial',
      useCaseLabel: useCaseLabel || 'Pagamento Guigui.com',
      businessId,
      businessName,
      payerName: normalizedPayment.payerName,
      payerPhone: normalizedPayment.payerPhone,
      amountXOF: normalizedPayment.amountXOF,
      provider: normalizedPayment.provider,
      providerRef: paymentIntent.providerRef,
      status: paymentStatus,
      isApiIntegrationReady: paymentAdapter.mode === 'live',
      providerMode: paymentAdapter.mode,
      checkoutUrl: paymentIntent.checkoutUrl,
      paymentInstructions: paymentIntent.instructions,
      manualProofReference,
      ...(commercialValidation.code ? { productId: commercialValidation.productId, productCode: commercialValidation.code, quantity: commercialValidation.quantity } : {}),
      ...(useCase === 'subscription_initial' || useCase === 'subscription_renewal' || useCase === 'subscription_upgrade' ? {
        subscriptionInterval: req.body.subscriptionInterval === 'annual' ? 'annual' : 'monthly',
      } : {}),
      ticketId: undefined as string | undefined,
      ticketCode: undefined as string | undefined,
      qrToken: undefined as string | undefined,
      ...(useCase === 'event_tickets' ? {
        ticketDraft: {
          eventId: String(req.body.eventId || 'evt-1'),
          eventTitle: String(req.body.eventTitle || 'Evento Cultural Guigui'),
          ticketTypeName: String(req.body.ticketTypeName || 'Entrada Geral'),
          eventDate: req.body.eventDate,
          eventTime: req.body.eventTime,
        },
      } : {}),
      createdAt: paymentTimestamp,
      ...(paymentIntent.state === 'confirmed' ? { confirmedAt: paymentTimestamp, confirmedBy: `${paymentAdapter.provider} (${paymentAdapter.mode})` } : {}),
    };

    if (paymentIntent.state === 'confirmed') applySubscriptionPaymentMetadata(newTxn, new Date());
    if (paymentIntent.state === 'confirmed') recordMonetizationFulfillment(newTxn);
    paymentTransactions.unshift(newTxn);
    await persistPostgresPayment(newTxn, idempotencyKey);
    persistPayments();
    recordAudit({
      action: 'payment_created',
      resource: 'payment',
      resourceId: newTxn.id,
      actorRole: 'citizen',
      requestId,
      success: true,
      metadata: { provider: newTxn.provider, amountXOF: newTxn.amountXOF, useCase: newTxn.useCase, manual: isManual },
    });

    if (useCase === 'event_tickets' && paymentIntent.state !== 'confirmed') {
      const pendingResponse = {
        success: false,
        paymentPending: paymentIntent.state === 'pending',
        transaction: newTxn,
        message: paymentIntent.instructions || 'Pagamento pendente. O bilhete será emitido depois da confirmação.',
        requestId,
      };
      if (idempotencyKey) paymentIdempotency.set(idempotencyKey, { createdAt: Date.now(), response: pendingResponse });
      return res.status(paymentIntent.state === 'pending' ? 202 : 402).json(pendingResponse);
    }

    // Só se cria um bilhete quando a intenção de pagamento foi confirmada.
    if (useCase === 'event_tickets' && paymentIntent.state === 'confirmed') {
      const { ticketCode, qrToken, pinCode } = generateTicketIdentifiers();
      const newTicket: TicketForValidation = {
        id: `TKT-${Date.now()}`,
        ticketCode,
        ...(typeof businessId === 'string' && businessId.trim() ? { businessId: businessId.trim() } : {}),
        eventId: String(req.body.eventId || 'evt-1'),
        eventTitle: String(req.body.eventTitle || 'Evento Cultural Guigui'),
        ticketTypeName: String(req.body.ticketTypeName || 'Entrada Geral'),
        priceXOF: Number(amountXOF),
        buyerName: payerName,
        buyerPhone: payerPhone,
        qrToken,
        pinCode,
        status: 'valid',
        purchasedAt: new Date().toISOString(),
        expiresAt: calculateTicketExpiry(req.body.eventDate, req.body.eventTime),
        paymentMethod: normalizedPayment.provider,
      };
      if (ticketSigningSecret) {
        newTicket.signature = signTicket(newTicket, ticketSigningSecret);
      }
      ticketsDb.set(qrToken, newTicket);
      ticketsDb.set(pinCode, newTicket);
      ticketsDb.set(ticketCode, newTicket);
      newTxn.ticketId = newTicket.id;
      newTxn.ticketCode = newTicket.ticketCode;
      newTxn.qrToken = newTicket.qrToken;
      persistTickets();
      persistPayments();
      const successResponse = { success: true, transaction: newTxn, ticket: newTicket, requestId };
      if (idempotencyKey) paymentIdempotency.set(idempotencyKey, { createdAt: Date.now(), response: successResponse });
      return res.json(successResponse);
    }

    const successResponse = { success: true, transaction: newTxn, requestId };
    if (idempotencyKey) paymentIdempotency.set(idempotencyKey, { createdAt: Date.now(), response: successResponse });
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
  const baseUrl = (process.env.APP_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
  res.type('text/plain').send(`User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin
Sitemap: ${baseUrl}/sitemap.xml
`);
});

app.get('/sitemap.xml', (_req, res) => {
  const baseUrl = (process.env.APP_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
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

async function startServer() {
  // Vite middleware in dev mode
  if (process.env.NODE_ENV !== 'production') {
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
        include: ['pako', 'jsqr', 'qrcode', 'react-dom/client'],
        noDiscovery: true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // SPA fallback: serve index.html para todas as rotas não-API no modo dev
    app.get('*', (_req, res) => {
      res.sendFile(path.join(process.cwd(), 'index.html'));
    });
  } else if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (process.env.VERCEL) {
    return;
  }

  await ensureDemoScheduledItems();
  void processDueScheduledItems().catch((error) => console.error('scheduled-items-startup-failed', error));
  setInterval(() => {
    void processDueScheduledItems().catch((error) => console.error('scheduled-items-processing-failed', error));
  }, 30_000);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Guigui.com] Servidor a rodar na porta ${PORT} em http://0.0.0.0:${PORT}`);
  });

  // Cópias de segurança periódicas, cifradas e replicadas (ver backupService).
  startBackupScheduler((outcome) => {
    const level = outcome.status === 'completed' ? 'log' : 'error';
    console[level](`[Guigui.com] backup automático: ${outcome.status} (${outcome.engine}, ${outcome.sizeMB} MB, cifrado=${outcome.encrypted})`);
  });
}

export default app;
void startServer();
