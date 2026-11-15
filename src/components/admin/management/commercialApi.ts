export type CommercialSection =
  | 'plans'
  | 'subscriptions'
  | 'features'
  | 'pricing'
  | 'products'
  | 'ticket-fees'
  | 'rules'
  | 'audit';

export interface CommercialSummary {
  revenueXOF: number;
  paymentCount: number;
  activeSubscriptions: number;
  pendingSubscriptions: number;
  expiredSubscriptions: number;
  suspendedSubscriptions: number;
  cancelledSubscriptions: number;
  activePlans: number;
  activeProducts: number;
  catalogVersion: number;
}

export interface CommercialPlan {
  id: string;
  code: string;
  name: string;
  description: string;
  priceXOF: number;
  annualPriceXOF: number | null;
  billingPeriod: string;
  isActive: boolean;
  isPublic: boolean;
  annualContract: boolean;
  badge: string | null;
  benefits: string[];
  sortOrder: number;
  version: number;
  updatedAt: string | null;
}

export interface CommercialPlanWithConfig extends CommercialPlan {
  subscribers: number;
  configs: PlanFeatureConfig[];
}

export interface CommercialFeature {
  id: string;
  code: string;
  name: string;
  description: string;
  category: string;
  valueType: 'quota' | 'flag' | 'text' | 'number' | string;
  unit: string | null;
  isActive: boolean;
}

export interface PlanFeatureConfig {
  featureId: string;
  enabled: boolean;
  limitKind: 'number' | 'unlimited' | 'negotiated' | 'flag' | 'text' | string;
  numericValue: number | null;
  textValue: string | null;
}

export interface CommercialGroup {
  id: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
}

export interface CommercialMatrixCell {
  groupId: string;
  planId: string;
  monthlyXOF: number;
  annualXOF: number;
  discountPercent: number;
  isActive: boolean;
  version: number;
  updatedAt: string | null;
}

export interface CommercialProduct {
  id: string;
  code: string;
  name: string;
  description: string;
  productType: string;
  unit: string;
  billingModel: string;
  basePriceXOF: number;
  currency: string;
  periodDays: number | null;
  quantity: number;
  requiresQuote: boolean;
  isActive: boolean;
  isPublic: boolean;
  version: number;
}

export interface CommercialPackage {
  id: string;
  code: string;
  name: string;
  description: string;
  priceXOF: number;
  isActive: boolean;
  version: number;
}

export interface TicketFees {
  commissionPercentage: number;
  fixedFeeXOF: number;
  currency: string;
  feePayer: string;
  billingModel: string;
  conditions: string;
  isActive: boolean;
  version: number;
  updatedAt: string | null;
  generatedRevenueXOF: number;
  grossTicketVolumeXOF: number;
  ticketCount: number;
  history: Array<{
    id: string;
    version: number;
    oldValues: unknown;
    newValues: unknown;
    changedBy: string;
    reason: string;
    createdAt: string | null;
  }>;
}

export interface CommercialRules {
  annualDiscountPercent: number;
  gracePeriodDays: number;
  renewalNoticeDays: number;
  autoSuspendAfterExpiry: boolean;
  autoRenewalEnabled: boolean;
  allowPlanChange: boolean;
  allowExtraPublications: boolean;
  monthlyPostRule: number;
  terms: string;
  version: number;
  updatedAt: string | null;
}

export interface CommercialAuditItem {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  field: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  reason: string;
  actorName: string;
  catalogVersion: number;
  createdAt: string | null;
}

export interface CommercialOverview {
  summary: CommercialSummary;
  plans: CommercialPlan[];
  plans_with_config: CommercialPlanWithConfig[];
  features: CommercialFeature[];
  groups: CommercialGroup[];
  matrix: CommercialMatrixCell[];
  products: CommercialProduct[];
  packages: CommercialPackage[];
  ticketFees: TicketFees | null;
  rules: CommercialRules | null;
  versions: Array<{ id: string; version: number; reason: string; changedBy: string; createdAt: string | null }>;
  recentAudit: CommercialAuditItem[];
  generatedAt: string;
}

export interface CommercialSubscription {
  id: string;
  companyId: string;
  companyName: string;
  companyStatus: string;
  planId: string;
  planName: string;
  planCode: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  categoryGroupId: string | null;
  categoryGroupName: string | null;
  priceXOF: number;
  priceSource: 'contracted' | 'matrix_reference';
  billingPeriod: string;
  provider: string | null;
  paymentType: string | null;
  paymentTransactionId: string | null;
  catalogVersion: number;
  planVersion: number;
  notes: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface SubscriptionDetail {
  subscription: CommercialSubscription;
  snapshot: {
    featureSnapshot: Record<string, unknown>;
    limitsSnapshot: Record<string, number | null>;
    contractSnapshot: Record<string, unknown>;
    catalogVersion: number;
    planVersion: number;
  };
  currentPlan: {
    plan: CommercialPlan;
    features: Array<CommercialFeature & { enabled: boolean; limitKind: string; numericValue: number | null; textValue: string | null }>;
  };
  matrix: { monthlyXOF: number; annualXOF: number; discountPercent: number } | null;
  payments: Array<{
    id: string;
    useCase: string;
    status: string;
    amountXOF: number;
    provider: string | null;
    providerReference: string | null;
    createdAt: string | null;
    confirmedAt: string | null;
  }>;
  history: Array<{
    id: string;
    entityType: string;
    action: string;
    oldValue: unknown;
    newValue: unknown;
    reason: string;
    actorName: string;
    createdAt: string | null;
  }>;
}

export async function commercialRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options?.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'Não foi possível concluir a operação comercial.');
  }
  return payload as T;
}

export const formatCommercialXOF = (value: unknown) =>
  `${Math.trunc(Number(value || 0)).toLocaleString('pt-PT')} XOF`;

export const formatCommercialDate = (value: string | null, withTime = false) => {
  if (!value) return '—';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '—';
  return withTime ? date.toLocaleString('pt-PT') : date.toLocaleDateString('pt-PT');
};

export const commercialStatusLabel: Record<string, string> = {
  active: 'Ativa',
  pending: 'Pendente',
  expired: 'Expirada',
  suspended: 'Suspensa',
  cancelled: 'Cancelada',
};

export const commercialAuditLabel: Record<string, string> = {
  created: 'Criado',
  updated: 'Alterado',
  duplicated: 'Duplicado',
  activated: 'Ativado',
  deactivated: 'Desativado',
  renewed: 'Renovado',
  status_changed: 'Estado alterado',
};

export const commercialEntityLabel: Record<string, string> = {
  plan: 'Plano',
  plan_config: 'Funcionalidades e limites',
  feature: 'Funcionalidade',
  price_matrix: 'Matriz de preços',
  price_group: 'Grupo de categorias',
  product: 'Produto',
  package: 'Pacote',
  ticket_fees: 'Taxas de bilheteira',
  commercial_rules: 'Regras comerciais',
  subscription: 'Assinatura',
};
