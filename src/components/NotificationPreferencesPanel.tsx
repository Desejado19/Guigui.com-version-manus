import React from 'react';
import { Bell, Mail, LockKeyhole, MessageSquare, Smartphone } from 'lucide-react';
import { NotificationCategory, NotificationChannel, NotificationPreferences, UserRole } from '../types';

interface NotificationPreferencesPanelProps {
  role: UserRole;
  value: NotificationPreferences;
  onChange: (next: NotificationPreferences) => void;
}

const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  system: 'Novidades e funcionalidades do Guigui',
  account: 'Conta e segurança da conta',
  business_approval: 'Aprovação e verificação da empresa',
  moderation: 'Publicações e moderação',
  order_redemption: 'Pedidos, vouchers e bilhetes',
  billing: 'Pagamentos e subscrição',
  event_reminder: 'Lembretes de eventos',
  event: 'Eventos e alterações de agenda',
  followed_business: 'Empresas que sigo',
  promotion: 'Promoções',
  messages: 'Mensagens directas (na caixa de mensagens)',
  review: 'Avaliações e comentários',
  support: 'Suporte administrativo',
  stats: 'Resumo e estatísticas',
  security: 'Alertas de segurança',
  admin_alert: 'Alertas operacionais de administração',
};

const ROLE_CATEGORIES: Record<UserRole, NotificationCategory[]> = {
  user: ['account', 'event', 'event_reminder', 'followed_business', 'promotion', 'order_redemption', 'billing', 'review', 'support', 'security', 'system'],
  business: ['account', 'business_approval', 'moderation', 'order_redemption', 'billing', 'event', 'review', 'promotion', 'support', 'stats', 'security', 'system'],
  admin: ['business_approval', 'moderation', 'event', 'admin_alert', 'billing', 'security', 'system'],
};

const CHANNELS: Array<{ id: NotificationChannel; label: string; icon: React.ElementType; description: string }> = [
  { id: 'in_app', label: 'Dentro da plataforma', icon: Bell, description: 'Sempre disponível no sino e no centro de notificações.' },
  { id: 'push', label: 'Push', icon: Smartphone, description: 'Para acontecimentos importantes, quando suportado pelo navegador.' },
  { id: 'email', label: 'Email', icon: Mail, description: 'Para documentos, pagamentos e informações importantes.' },
  { id: 'sms', label: 'SMS', icon: MessageSquare, description: 'Reservado para situações críticas ou que exigem confirmação.' },
];

const LOCKED_CATEGORIES: NotificationCategory[] = ['account', 'billing', 'security'];

export const NotificationPreferencesPanel: React.FC<NotificationPreferencesPanelProps> = ({ role, value, onChange }) => {
  const categories = ROLE_CATEGORIES[role];
  const updateCategory = (category: NotificationCategory) => {
    if (LOCKED_CATEGORIES.includes(category)) return;
    onChange({ ...value, categories: { ...value.categories, [category]: value.categories[category] === false } });
  };
  const updateChannel = (channel: NotificationChannel) => {
    if (channel === 'in_app' && role === 'admin') return;
    onChange({ ...value, channels: { ...value.channels, [channel]: value.channels[channel] === false } });
  };

  return (
    <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-4 sm:p-5">
      <div className="flex items-start gap-3 border-b border-slate-100 pb-5 dark:border-slate-800">
        <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 flex items-center justify-center shrink-0"><Bell className="w-5 h-5" /></div>
        <div>
          <h3 className="font-black text-base text-slate-900 dark:text-white">Preferências de notificações</h3>
          <p className="text-xs text-slate-500 mt-1 dark:text-slate-300">Escolha os avisos que quer receber. Alertas de segurança, pagamentos e alterações críticas não podem ser desligados.</p>
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-[11px] uppercase tracking-wider font-black text-slate-500 dark:text-slate-400">Tipos de aviso</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {categories.map((category) => {
            const enabled = value.categories[category] !== false;
            const locked = LOCKED_CATEGORIES.includes(category);
            return (
              <button key={category} type="button" onClick={() => updateCategory(category)} disabled={locked} className={`flex items-center justify-between gap-3 rounded-2xl border p-3 text-left transition ${enabled ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950' : 'border-[var(--color-border-subtle)] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:border-slate-800 dark:bg-slate-950'} ${locked ? 'cursor-not-allowed opacity-90' : 'hover:border-emerald-400'}`}>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">{CATEGORY_LABELS[category]}</span>
                <span className="flex items-center gap-1.5 shrink-0">{locked && <LockKeyhole className="w-3.5 h-3.5 text-amber-500" />}<span className={`w-8 h-5 rounded-full p-0.5 ${enabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`}><span className={`block w-4 h-4 rounded-full bg-white dark:bg-slate-900 transition-transform ${enabled ? 'translate-x-3' : ''}`} /></span></span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <h4 className="text-[11px] uppercase tracking-wider font-black text-slate-500 dark:text-slate-400">Canais</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CHANNELS.map(({ id, label, icon: Icon, description }) => {
            const enabled = value.channels[id] !== false;
            const locked = id === 'in_app' && role === 'admin';
            return (
              <button key={id} type="button" onClick={() => updateChannel(id)} disabled={locked} className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition ${enabled ? 'border-[var(--color-border-subtle)] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 dark:border-slate-800 dark:bg-slate-950' : 'border-[var(--color-border-subtle)] dark:border-slate-700 bg-white dark:border-slate-800 dark:bg-slate-900'} ${locked ? 'cursor-not-allowed' : 'hover:border-emerald-400'}`}>
                <Icon className={`w-4 h-4 mt-0.5 ${enabled ? 'text-emerald-600 dark:text-emerald-300' : 'text-slate-500'}`} />
                <span className="min-w-0 flex-1"><span className="block text-xs font-black text-slate-800 dark:text-slate-100">{label}{locked && <LockKeyhole className="inline ml-1 w-3 h-3 text-amber-500" />}</span><span className="block text-[10px] leading-relaxed text-slate-500 dark:text-slate-400 mt-0.5">{description}</span></span>
                <span className={`w-8 h-5 rounded-full p-0.5 shrink-0 ${enabled ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'}`}><span className={`block w-4 h-4 rounded-full bg-white dark:bg-slate-900 transition-transform ${enabled ? 'translate-x-3' : ''}`} /></span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
