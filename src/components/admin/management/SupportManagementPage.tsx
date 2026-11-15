import React, { useMemo, useState } from 'react';
import type { SupportRequest } from '../../../types';
import { formatManagementDate } from './managementState';
import { RecordsManagementPage } from './RecordsManagementPage';
import { ManagementActionButton } from './ManagementUi';

const STATUS_LABELS: Record<SupportRequest['status'], string> = {
  open: 'Aberto',
  in_progress: 'Em atendimento',
  resolved: 'Resolvido',
};

const SupportDetail: React.FC<{
  request: SupportRequest;
  onReplySupport?: (requestId: string, text: string) => void;
  onUpdateSupportStatus?: (requestId: string, status: SupportRequest['status']) => void;
}> = ({ request, onReplySupport, onUpdateSupportStatus }) => {
  const [reply, setReply] = useState('');

  return (
    <div className="space-y-4 text-[11px]">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {[
          ['Referência', request.id],
          ['Requerente', `${request.requesterRole === 'business' ? 'Empresa' : 'Cidadão'} · ${request.requesterId}`],
          ['Estado', STATUS_LABELS[request.status]],
          ['Criado em', formatManagementDate(request.createdAt)],
          ['Atualizado em', formatManagementDate(request.updatedAt)],
          ['Categoria', request.category || '—'],
        ].map(([label, value]) => (
          <div key={label}>
            <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">{label}</div>
            <div className="mt-0.5 font-medium text-slate-700">{value || '—'}</div>
          </div>
        ))}
      </div>

      <div>
        <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Descrição</div>
        <p className="mt-1 whitespace-pre-wrap rounded-xl bg-slate-50 p-3 leading-relaxed text-slate-700">{request.description}</p>
      </div>

      <div>
        <div className="mb-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400">Respostas</div>
        {(request.replies || []).length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-3 text-slate-500">Ainda não existem respostas neste pedido.</p>
        ) : (
          <ul className="space-y-2">
            {(request.replies || []).map((item) => (
              <li key={item.id} className="rounded-xl border border-slate-200 p-2.5">
                <div className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">{item.senderRole} · {formatManagementDate(item.createdAt)}</div>
                <p className="mt-1 whitespace-pre-wrap text-slate-700">{item.text}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2 rounded-xl border border-[#e6dac8] bg-[#faf7f2] p-3">
        <label className="flex flex-col gap-1">
          <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">Responder ao pedido</span>
          <textarea value={reply} onChange={(event) => setReply(event.target.value)} rows={3} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-800 outline-none focus:border-[#123e3b]" placeholder="Escreva a resposta administrativa…" />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <ManagementActionButton
            tone="primary"
            disabled={!onReplySupport || reply.trim().length < 2}
            onClick={() => {
              if (!onReplySupport) return;
              onReplySupport(request.id, reply.trim());
              setReply('');
            }}
          >
            Enviar resposta
          </ManagementActionButton>
          {(['open', 'in_progress', 'resolved'] as SupportRequest['status'][]).map((status) => (
            <ManagementActionButton
              key={status}
              disabled={!onUpdateSupportStatus || request.status === status}
              onClick={() => onUpdateSupportStatus?.(request.id, status)}
            >
              {STATUS_LABELS[status]}
            </ManagementActionButton>
          ))}
        </div>
      </div>
    </div>
  );
};

interface SupportManagementPageProps {
  supportRequests: SupportRequest[];
  onBack: () => void;
  onReplySupport?: (requestId: string, text: string) => void;
  onUpdateSupportStatus?: (requestId: string, status: SupportRequest['status']) => void;
}

export const SupportManagementPage: React.FC<SupportManagementPageProps> = ({
  supportRequests,
  onBack,
  onReplySupport,
  onUpdateSupportStatus,
}) => {
  const counts = useMemo(() => ({
    open: supportRequests.filter((request) => request.status === 'open').length,
    progress: supportRequests.filter((request) => request.status === 'in_progress').length,
    resolved: supportRequests.filter((request) => request.status === 'resolved').length,
  }), [supportRequests]);

  return (
    <RecordsManagementPage<SupportRequest>
      title="Gestão de chamados de suporte"
      description="Pedidos de apoio de cidadãos e empresas, com pesquisa, filtros por estado e categoria, paginação, exportação, resposta e alteração de estado."
      moduleLabel="Suporte"
      storageKey="admin.management.support"
      onBack={onBack}
      rows={supportRequests}
      rowKey={(request) => request.id}
      searchPlaceholder="Pesquisar por assunto, descrição, requerente ou referência…"
      searchFields={(request) => [request.id, request.subject, request.description, request.requesterId, request.businessId, request.category]}
      filters={[
        { key: 'status', label: 'Estado', options: [
          { value: 'all', label: 'Todos' },
          { value: 'open', label: 'Abertos' },
          { value: 'in_progress', label: 'Em atendimento' },
          { value: 'resolved', label: 'Resolvidos' },
        ] },
        { key: 'role', label: 'Requerente', options: [
          { value: 'all', label: 'Todos' },
          { value: 'user', label: 'Cidadãos' },
          { value: 'business', label: 'Empresas' },
        ] },
      ]}
      matchesFilters={(request, filters) => (
        (filters.status === 'all' || request.status === filters.status)
        && (filters.role === 'all' || request.requesterRole === filters.role)
      )}
      sortValue={(request, key) => {
        if (key === 'updatedAt') return request.updatedAt ? new Date(request.updatedAt).getTime() : 0;
        if (key === 'status') return request.status;
        return request.subject;
      }}
      defaultSortKey="updatedAt"
      columns={[
        {
          key: 'subject',
          label: 'Assunto',
          sortable: true,
          render: (request) => (
            <div className="min-w-[220px]">
              <div className="truncate font-black text-slate-900">{request.subject}</div>
              <div className="truncate text-[9.5px] text-slate-500">{request.id} · {request.requesterRole === 'business' ? 'Empresa' : 'Cidadão'}</div>
            </div>
          ),
        },
        { key: 'category', label: 'Categoria', render: (request) => request.category || '—' },
        { key: 'status', label: 'Estado', sortable: true, render: (request) => (
          <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[9px] font-black ${
            request.status === 'resolved' ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : request.status === 'in_progress' ? 'border-sky-200 bg-sky-50 text-sky-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
          }`}>{STATUS_LABELS[request.status]}</span>
        ) },
        { key: 'updatedAt', label: 'Atualizado', sortable: true, render: (request) => <span className="whitespace-nowrap">{formatManagementDate(request.updatedAt)}</span> },
        { key: 'replies', label: 'Respostas', render: (request) => <span className="tabular-nums">{(request.replies || []).length}</span> },
      ]}
      kpis={[
        { label: 'Total de pedidos', value: supportRequests.length, tone: 'info' },
        { label: 'Abertos', value: counts.open, tone: 'warning' },
        { label: 'Em atendimento', value: counts.progress, tone: 'neutral' },
        { label: 'Resolvidos', value: counts.resolved, tone: 'success' },
      ]}
      exportSpec={{
        filename: `suporte-guigui-${new Date().toISOString().slice(0, 10)}`,
        sheet: 'Suporte',
        title: 'Relatório de Suporte — Guigui.com',
        description: 'Pedidos de suporte após aplicação dos filtros atuais.',
        headers: ['ID', 'Assunto', 'Requerente', 'Categoria', 'Estado', 'Criado', 'Atualizado', 'Respostas'],
        row: (request) => [request.id, request.subject, request.requesterRole, request.category || '', STATUS_LABELS[request.status], formatManagementDate(request.createdAt), formatManagementDate(request.updatedAt), (request.replies || []).length],
        pdfKpis: [
          { label: 'Pedidos', value: String(supportRequests.length) },
          { label: 'Abertos', value: String(counts.open) },
          { label: 'Resolvidos', value: String(counts.resolved) },
        ],
      }}
      detailLabel={(request) => request.subject}
      detail={(request) => (
        <SupportDetail request={request} onReplySupport={onReplySupport} onUpdateSupportStatus={onUpdateSupportStatus} />
      )}
    />
  );
};
