import React, { useState } from 'react';
import {
  FileText,
  FileSpreadsheet,
  Download,
  Printer,
  Calendar,
  CheckCircle2,
  Building2,
  DollarSign,
  ShoppingBag,
  Eye,
  MessageCircle,
  Tag,
  Ticket,
  Clock,
  Sparkles,
} from 'lucide-react';
import { Business, Language, PurchaseOrder } from '../../types';
import { downloadCSV, downloadExcel, downloadPDFReport } from '../../utils/exportHelpers';
import { getTranslation } from '../../utils/i18n';

interface ClientExportHubProps {
  business: Business;
  currentLang?: Language;
  purchaseOrders: PurchaseOrder[];
}

export const ClientExportHub: React.FC<ClientExportHubProps> = ({
  business,
  currentLang = 'pt' as Language,
  purchaseOrders,
}) => {
  const t = (key: string, variables?: Record<string, string | number>) =>
    getTranslation(currentLang, key, variables);
  const [exportTimeframe, setExportTimeframe] = useState<'30days' | '90days' | 'year' | 'all'>('30days');

  const myOrders = purchaseOrders.filter((o) => o.businessId === business.id);
  const exportCutoff = exportTimeframe === 'all'
    ? 0
    : Date.now() - (exportTimeframe === '30days' ? 30 : exportTimeframe === '90days' ? 90 : 365) * 24 * 60 * 60 * 1000;
  const filteredOrders = myOrders.filter((order) => new Date(order.purchasedAt).getTime() >= exportCutoff);
  const timeframeLabel = exportTimeframe === '30days' ? t('business.UltimosDias2') : exportTimeframe === '90days' ? t('business.UltimosDias90') : exportTimeframe === 'year' ? t('business.AnoCorrente') : t('business.TodoHistorico');

  // 1. Export Full Sales & Orders
  const handleExportOrders = (format: 'pdf' | 'excel' | 'csv') => {
    const total = filteredOrders.reduce((acc, o) => acc + o.totalPriceXOF, 0);
    const headers = [
      t('business.exportOrderColCode'),
      t('business.exportOrderColCustomer'),
      t('business.exportOrderColPhone'),
      t('business.exportOrderColItem'),
      t('business.exportOrderColType'),
      t('business.exportOrderColAmount'),
      t('business.exportOrderColMethod'),
      t('business.exportOrderColStatus'),
      t('business.exportOrderColDate'),
    ];
    const rows = filteredOrders.map((o) => [
      o.orderCode || o.id,
      o.customerName || t('business.exportOrderColCustomer'),
      o.customerPhone || t('qrNotAvailable'),
      o.itemTitle,
      o.itemType.toUpperCase(),
      o.totalPriceXOF,
      o.paymentMethod.toUpperCase(),
      o.status.toUpperCase(),
      o.purchasedAt,
    ]);

    const title = t('business.exportOrderTitle', { name: business.name });
    const summary = t('business.exportOrderSummary', {
      name: business.name,
      neighborhood: business.neighborhood,
      total: total.toLocaleString('pt-PT'),
    });

    if (format === 'pdf') {
      downloadPDFReport(
        title,
        summary,
        [
          { label: t('business.exportOrderPdfTotal'), value: `${filteredOrders.length}` },
          { label: t('business.exportOrderPdfRevenue'), value: `${total.toLocaleString('pt-PT')} XOF` },
          { label: t('business.exportOrderPdfRedeemed'), value: `${filteredOrders.filter((o) => o.status === 'redeemed').length}` },
          { label: t('business.exportOrderPdfPending'), value: `${filteredOrders.filter((o) => o.status === 'pending').length}` },
        ],
        headers,
        rows
      );
    } else if (format === 'excel') {
      downloadExcel(`Guigui_Vendas_${business.name.replace(/\s+/g, '_')}`, t('business.exportOrderSheet'), headers, rows);
    } else {
      downloadCSV(`Guigui_Vendas_${business.name.replace(/\s+/g, '_')}`, headers, rows);
    }
  };

  // 2. Export Business Metrics & Leads
  const handleExportMetrics = (format: 'pdf' | 'excel' | 'csv') => {
    const headers = [
      t('business.exportMetricColMetric'),
      t('business.exportMetricColValue'),
      t('business.exportMetricColUnit'),
      t('business.exportMetricColChannel'),
    ];
    const rows = [
      [t('business.exportMetricViews'), business.metrics.views, t('business.exportMetricUnitVisits'), t('business.exportMetricChannelDirectory')],
      [t('business.exportMetricWhatsapp'), business.metrics.whatsappClicks, t('business.exportMetricUnitLeads'), t('business.exportMetricChannelDirect')],
      [t('business.exportMetricCalls'), business.metrics.phoneClicks, t('business.exportMetricUnitCalls'), t('business.exportMetricChannelVoice')],
      [t('business.exportMetricDirections'), business.metrics.directionsClicks, t('business.exportMetricUnitVisitsPhysical'), t('business.exportMetricChannelGps')],
      [t('business.exportMetricPosts'), business.posts.length, t('business.exportMetricUnitPosts'), t('business.exportMetricChannelFeed')],
      [t('business.exportMetricPromos'), business.promotions.length, t('business.exportMetricUnitOffers'), t('business.exportMetricChannelPromos')],
      [t('business.exportMetricReviews'), business.reviews.length, t('business.exportMetricUnitComments'), `${t('business.exportMetricNote')}${business.rating || 5.0}`],
    ];

    const title = t('business.exportMetricTitle', { name: business.name });
    const summary = t('business.exportMetricSummary', { name: business.name });

    if (format === 'pdf') {
      downloadPDFReport(
        title,
        summary,
        [
          { label: t('business.exportMetricPdfViews'), value: `${business.metrics.views.toLocaleString('pt-PT')}` },
          { label: t('business.exportMetricPdfWhatsapp'), value: `${business.metrics.whatsappClicks}` },
          { label: t('business.exportMetricPdfCalls'), value: `${business.metrics.phoneClicks}` },
          { label: t('business.exportMetricPdfRoutes'), value: `${business.metrics.directionsClicks}` },
        ],
        headers,
        rows
      );
    } else if (format === 'excel') {
      downloadExcel(`Guigui_Metricas_${business.name.replace(/\s+/g, '_')}`, t('business.exportMetricSheet'), headers, rows);
    } else {
      downloadCSV(`Guigui_Metricas_${business.name.replace(/\s+/g, '_')}`, headers, rows);
    }
  };

  // 3. Export Catalog / Menu
  const handleExportCatalog = (format: 'pdf' | 'excel' | 'csv') => {
    const headers = [
      t('business.exportCatalogColName'),
      t('business.exportCatalogColCategory'),
      t('business.exportCatalogColPrice'),
      t('business.exportCatalogColAvailability'),
    ];
    const available = t('business.exportCatalogAvailable');
    const rows = (business.products || []).map((p) => [
      p.name,
      p.category,
      p.priceXOF,
      p.isAvailable ? available : t('business.exportCatalogSoldOut'),
    ]);

    if (rows.length === 0) {
      rows.push([
        t('business.exportCatalogSampleItem'),
        t('business.exportCatalogSampleCategory'),
        5000,
        available,
      ]);
    }

    const title = t('business.exportCatalogTitle', { name: business.name });
    const summary = t('business.exportCatalogSummary');

    if (format === 'pdf') {
      downloadPDFReport(
        title,
        summary,
        [
          { label: t('business.exportCatalogPdfItems'), value: `${rows.length}` },
          { label: t('business.exportCatalogPdfCategory'), value: `${business.category}` },
          { label: t('business.exportCatalogPdfPlan'), value: `${business.tier.toUpperCase()}` },
          { label: t('business.exportCatalogPdfLocation'), value: `${business.neighborhood}` },
        ],
        headers,
        rows
      );
    } else if (format === 'excel') {
      downloadExcel(`Guigui_Catalogo_${business.name.replace(/\s+/g, '_')}`, t('business.exportCatalogSheet'), headers, rows);
    } else {
      downloadCSV(`Guigui_Catalogo_${business.name.replace(/\s+/g, '_')}`, headers, rows);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] space-y-2 p-4 sm:p-5">
        <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 text-xs px-3 py-1 rounded-full font-bold border border-emerald-200">
          <Download className="w-3.5 h-3.5" />
          <span>{t('businessDataExport')}</span>
        </div>
        <h3 className="text-xl font-black text-slate-900">
          {t('organizedReports')}
        </h3>
        <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
          {t('business.exportHubIntroBefore')} <strong>{business.name}</strong>{t('business.exportHubIntroAfter')}
        </p>
      </div>

      <div className="grid gap-3 rounded-3xl border border-slate-200 bg-slate-900 p-4 text-white shadow-sm sm:grid-cols-4 sm:p-5">
        <label className="sm:col-span-1"><span className="text-[10px] font-black uppercase tracking-wider text-emerald-300">{t('business.periodoRelatorio')}</span><select value={exportTimeframe} onChange={(event) => setExportTimeframe(event.target.value as typeof exportTimeframe)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-800 px-2.5 py-2 text-xs font-black text-white"><option value="30days">{t('business.UltimosDias2')}</option><option value="90days">{t('business.UltimosDias90')}</option><option value="year">{t('business.AnoCorrente')}</option><option value="all">{t('business.TodoHistorico')}</option></select></label>
        <div><p className="text-[10px] font-black uppercase tracking-wider text-blue-300">{t('business.PedidosNoAmbito')}</p><p className="mt-1 text-sm font-black">{filteredOrders.length}</p></div>
        <div><p className="text-[10px] font-black uppercase tracking-wider text-amber-300">{t('business.VolumeNoAmbito')}</p><p className="mt-1 text-sm font-black">{filteredOrders.reduce((total, order) => total + order.totalPriceXOF, 0).toLocaleString('pt-PT')} XOF</p></div>
        <div><p className="text-[10px] font-black uppercase tracking-wider text-slate-300">{t('business.exportCompanyLabel')}</p><p className="mt-1 truncate text-sm font-black">{business.name}</p></div>
      </div>

      {/* 3 Export Modules */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Module 1: Vendas e Pedidos */}
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] hover:border-[var(--color-border-strong)] flex flex-col justify-between space-y-4 p-4 sm:p-5 transition">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-slate-900">
                {t('business.exportSalesTitle')}
              </h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {t('business.exportSalesDescription', { count: myOrders.length })}
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <button type="button"
              onClick={() => handleExportOrders('pdf')}
              className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition flex items-center justify-center gap-2"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('business.exportPdfPrint')}</span>
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button"
                onClick={() => handleExportOrders('excel')}
                className="py-2 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs transition flex items-center justify-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>{t('business.exportExcelLabel')}</span>
              </button>
              <button type="button"
                onClick={() => handleExportOrders('csv')}
                className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition flex items-center justify-center gap-1.5 border border-slate-300"
              >
                <FileText className="w-3.5 h-3.5 text-slate-600" />
                <span>CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* Module 2: Métricas e Leads */}
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] hover:border-[var(--color-border-strong)] flex flex-col justify-between space-y-4 p-4 sm:p-5 transition">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-slate-900">
                {t('business.exportMetricsTitle')}
              </h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {t('business.exportMetricsDescription', { views: business.metrics.views, clicks: business.metrics.whatsappClicks })}
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <button type="button"
              onClick={() => handleExportMetrics('pdf')}
              className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition flex items-center justify-center gap-2"
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>{t('business.exportPdfPrint')}</span>
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button"
                onClick={() => handleExportMetrics('excel')}
                className="py-2 px-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-xs transition flex items-center justify-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>{t('business.exportExcelLabel')}</span>
              </button>
              <button type="button"
                onClick={() => handleExportMetrics('csv')}
                className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition flex items-center justify-center gap-1.5 border border-slate-300"
              >
                <FileText className="w-3.5 h-3.5 text-slate-600" />
                <span>CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* Module 3: Catálogo e Menus */}
        <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] guigui-dpanel shadow-[var(--shadow-xs)] hover:border-[var(--color-border-strong)] flex flex-col justify-between space-y-4 p-4 sm:p-5 transition">
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-slate-900">
                {t('business.exportCatalogTitle')}
              </h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                {t('business.exportCatalogDescription')}
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <button type="button"
              onClick={() => handleExportCatalog('pdf')}
              className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition flex items-center justify-center gap-2"
            >
              <Download className="w-3.5 h-3.5 text-purple-400" />
              <span>{t('business.exportPdfPrint')}</span>
            </button>
            <div className="grid grid-cols-2 gap-2">
              <button type="button"
                onClick={() => handleExportCatalog('excel')}
                className="py-2 px-3 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs transition flex items-center justify-center gap-1.5"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>{t('business.exportExcelLabel')}</span>
              </button>
              <button type="button"
                onClick={() => handleExportCatalog('csv')}
                className="py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs transition flex items-center justify-center gap-1.5 border border-slate-300"
              >
                <FileText className="w-3.5 h-3.5 text-slate-600" />
                <span>CSV</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
