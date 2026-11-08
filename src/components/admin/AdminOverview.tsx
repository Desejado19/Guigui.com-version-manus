import React, { useMemo } from 'react';
import {
  Building2,
  Users,
  Ticket,
  DollarSign,
  AlertTriangle,
  BarChart3,
  FileText,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { Panel, PanelHeader, Card, CardHeader, CardTitle, CardDescription, CardContent, Button, Text } from 'ui';

import { Business, Language, SupportRequest } from '../../types';
import { getTranslation } from '../../utils/i18n';

export interface AdminOverviewProps {
  businesses: Business[];
  currentLang: Language;
  supportRequests?: SupportRequest[];
  pendingModerationCount?: number;
}

const statsCards = [
  { label: 'empresas', icon: Building2 },
  { label: 'utilizadores', icon: Users },
  { label: 'pedidos de suporte', icon: Ticket },
  { label: 'receita', icon: DollarSign },
] as const;

export const AdminOverview: React.FC<AdminOverviewProps> = ({
  businesses,
  currentLang,
  supportRequests = [],
  pendingModerationCount = 0,
}) => {
  const t = (key: string) => getTranslation(currentLang, key);

  const activeBusinesses = useMemo(
    () => businesses.filter((business) => business.status === 'active').length,
    [businesses],
  );

  const pendingSupport = useMemo(
    () => supportRequests.filter((request) => request.status !== 'resolved').length,
    [supportRequests],
  );

  const statCards = useMemo(
    () =>
      statsCards.map((stat) => ({
        ...stat,
        value:
          stat.label === 'empresas'
            ? activeBusinesses
            : stat.label === 'receita'
              ? businesses.reduce((acc, business) => acc + (business.revenueXOF ?? 0), 0)
              : stat.label === 'pedidos de suporte'
                ? pendingSupport
                : businesses.length,
      })),
    [businesses, activeBusinesses, pendingSupport],
  );

  const openSupportTickets = useMemo(
    () => supportRequests.filter((request) => request.status !== 'resolved').slice(0, 3),
    [supportRequests],
  );

  return (
    <Panel>
      <PanelHeader
        eyebrow="Painel administrativo"
        title="Visão geral"
        description={t('admin.overview.description') ?? 'Resumo executivo da plataforma Guigui.com'}
        icon={<BarChart3 className="h-5 w-5" />}
      />

      <section>
        <h2 className="sr-only">Indicadores principais</h2>
        <div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}
        >
          {statCards.map((stat) => (
            <Card key={stat.label}>
              <CardHeader>
                <CardTitle>{stat.value > 0 ? stat.value.toLocaleString('pt-PT') : '—'}</CardTitle>
                <CardDescription>{t(`admin.overview.${stat.label}`) ?? stat.label}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-[var(--color-text-muted)]">
                  <stat.icon className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-5">
        <h2 className="sr-only">Estados recentes</h2>
        <div className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[var(--color-red-600)]" />
                Moderação pendente
              </CardTitle>
              <CardDescription>
                {pendingModerationCount > 0
                  ? `${pendingModerationCount} conteúdo(s) aguardam revisão`
                  : 'Sem conteúdo pendente no momento'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Text tone="muted" size="sm" truncate>
                {pendingModerationCount > 0
                  ? t('admin.overview.moderationPendingHelp') ?? 'Verifique os conteúdos marcados antes de publicar.'
                  : t('admin.overview.moderationOkHelp') ?? 'Não há conteúdos aguardando análise neste momento.'}
              </Text>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[var(--color-text-muted)]" />
                Semanas ativas
              </CardTitle>
              <CardDescription>Empresas ativas nos últimos 7 dias</CardDescription>
            </CardHeader>
            <CardContent>
              <Text tone="muted" size="sm">
                {activeBusinesses > 0
                  ? `${activeBusinesses} empresas publicaram ou interagiram recentemente.`
                  : 'Sem movimento recente nas empresas.'}
              </Text>
            </CardContent>
          </Card>
        </div>
      </section>

      {openSupportTickets.length > 0 && (
        <section className="mt-5">
          <h2 className="sr-only">Suporte aberto</h2>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[var(--color-green-600)]" />
                Suporte aberto
              </CardTitle>
              <CardDescription>
                {openSupportTickets.length} pedido(s) aguardam resposta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {openSupportTickets.map((request) => (
                <div key={request.id} className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] px-3 py-2 text-sm">
                  <Text tone="strong" truncate>
                    {request.subject}
                  </Text>
                  <Text tone="muted" size="xs" className="mt-1 flex gap-2">
                    {request.status === 'open' ? 'Aberto' : 'Em progresso'}
                    <ArrowRight className="h-3 w-3 shrink-0" />
                    {request.businessName ?? request.requesterName ?? 'Utilizador'}
                  </Text>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}
    </Panel>
  );
};
