import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Clock3,
  CreditCard,
  ExternalLink,
  Filter,
  MessageSquare,
  Mail,
  ShieldAlert,
  ShoppingBag,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { AppNotification, Business, Language } from '../../types';
import { filterNotificationsForContext, formatNotificationDateTime } from '../../services/notificationService';
import { getTranslation } from '../../utils/i18n';

interface ClientNotificationsHubProps {
  business: Business;
  currentLang?: Language;
  notifications?: AppNotification[];
  onMarkAsRead?: (id: string) => void;
  onMarkAllAsRead?: () => void;
  onClearAll?: () => void;
  onNavigateTab?: (tab: string) => void;
  onOpenNotification?: (notification: AppNotification) => void;
}

const iconForNotification = (notification: AppNotification) => {
  if (notification.category === 'billing') return CreditCard;
  if (notification.category === 'order_redemption') return ShoppingBag;
  if (notification.category === 'messages') return Mail;
  if (notification.category === 'review' || notification.category === 'support') return MessageSquare;
  if (notification.category === 'security' || notification.priority === 'urgent' || notification.priority === 'critical') return ShieldAlert;
  if (notification.category === 'moderation') return Sparkles;
  if (notification.category === 'event' || notification.category === 'event_reminder') return Bell;
  return CheckCircle2;
};

const priorityLabel: Record<string, string> = {
  low: 'Informação',
  normal: 'Normal',
  info: 'Informação',
  success: 'Sucesso',
  attention: 'Atenção',
  high: 'Atenção',
  urgent: 'Crítico',
  critical: 'Crítico',
};

const priorityClasses: Record<string, string> = {
  low: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  normal: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  info: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800',
  attention: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  high: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800',
  urgent: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
  critical: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800',
};

export const ClientNotificationsHub: React.FC<ClientNotificationsHubProps> = ({
  business,
  currentLang = 'pt' as Language,
  notifications = [],
  onMarkAsRead = (_id: string) => undefined,
  onMarkAllAsRead = () => undefined,
  onClearAll = () => undefined,
  onNavigateTab,
  onOpenNotification,
}) => {
  const t = (key: string) => getTranslation(currentLang, key);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'important'>('all');
  const scopedNotifications = useMemo(
    () => filterNotificationsForContext(notifications, { role: 'business', businessId: business.id }),
    [notifications, business.id]
  );
  const displayedNotifications = scopedNotifications.filter((notification) => {
    if (activeFilter === 'unread') return !notification.read;
    if (activeFilter === 'important') return ['high', 'urgent', 'attention', 'critical'].includes(notification.priority || 'normal');
    return true;
  });
  const unreadCount = scopedNotifications.filter((notification) => !notification.read).length;

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-surface)] dark:bg-slate-800 guigui-dpanel shadow-[var(--shadow-xs)] space-y-4 p-3.5 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-5 dark:border-slate-800">
        <div>
          <div className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs px-3 py-1 rounded-full font-bold mb-2 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
            <Bell className="w-3.5 h-3.5" />
            <span>{t('businessNotificationsCenter')}</span>
          </div>
          <h2 className="text-base sm:text-lg font-black text-[var(--color-text-strong)]">
            Avisos de {business.name}
          </h2>
          <p className="text-xs text-slate-500 mt-1 dark:text-slate-300">
            {t('businessNotificationsDescription')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button type="button" onClick={onMarkAllAsRead} className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition border border-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-100 dark:border-slate-700">
              <Check className="w-3.5 h-3.5 inline mr-1" /> {t('markAsRead')}
            </button>
          )}
          <button type="button" onClick={onClearAll} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition dark:hover:bg-red-950/40" title={t('clearBusinessNotifications')} aria-label={t('clearBusinessNotifications')}>
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Filter className="w-4 h-4 text-slate-400" />
        {(['all', 'unread', 'important'] as const).map((filter) => (
          <button key={filter} type="button" onClick={() => setActiveFilter(filter)} className={`px-3 py-1.5 rounded-full text-[11px] font-black border transition ${activeFilter === filter ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-transparent text-slate-600 border-slate-200 hover:border-emerald-400 dark:text-slate-300 dark:border-slate-700'}`}>
            {filter === 'all' ? `${t('all')} (${scopedNotifications.length})` : filter === 'unread' ? `${t('unread')} (${unreadCount})` : t('important')}
          </button>
        ))}
      </div>

      {displayedNotifications.length === 0 ? (
        <div className="text-center py-12 text-slate-500 space-y-2 dark:text-slate-300">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 mx-auto flex items-center justify-center"><CheckCircle2 className="w-6 h-6 text-emerald-500" /></div>
          <p className="text-xs font-bold">{t('noNotificationsFilter')}</p>
          <p className="text-[11px]">{t('noBusinessNotificationsHint')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedNotifications.map((notification) => {
            const Icon = iconForNotification(notification);
            const priority = notification.priority || 'normal';
            return (
              <div key={notification.id} className={`p-4 rounded-2xl border transition flex items-start gap-3.5 ${notification.read ? 'bg-slate-50/50 border-slate-200 dark:border-slate-700 dark:bg-slate-950/50 dark:border-slate-800' : 'bg-blue-50/40 border-blue-200 shadow-2xs dark:bg-blue-950/20 dark:border-blue-800'}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${priorityClasses[priority] || priorityClasses.normal}`}>
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className={`text-xs ${notification.read ? 'font-bold text-slate-800 dark:text-slate-200' : 'font-black text-slate-900 dark:text-white'}`}>{notification.title}</h4>
                    <span className={`text-[9px] uppercase tracking-wide font-black px-2 py-0.5 rounded-full border ${priorityClasses[priority] || priorityClasses.normal}`}>{priorityLabel[priority] || t('notice')}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed dark:text-slate-300">{notification.message}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-slate-400 dark:text-slate-400">
                    <span className="inline-flex items-center gap-1"><Clock3 className="w-3 h-3" /><time dateTime={notification.createdAt}>{formatNotificationDateTime(notification.createdAt, currentLang)}</time></span>
                    {notification.channels?.map((channel) => <span key={channel} className="uppercase font-bold">{channel.replace('_', ' ')}</span>)}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!notification.read && <button type="button" onClick={() => onMarkAsRead(notification.id)} className="p-2 text-slate-400 hover:text-emerald-600 rounded-lg" title={t('markAsReadSingular')} aria-label={t('markAsReadSingular')}><Check className="w-4 h-4" /></button>}
                  {(notification.linkTab && onNavigateTab || onOpenNotification) && <button type="button" onClick={() => { onMarkAsRead(notification.id); if (onOpenNotification) onOpenNotification(notification); else if (notification.linkTab && onNavigateTab) onNavigateTab(notification.linkTab); }} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg dark:text-emerald-300 dark:hover:bg-emerald-950/40" title={notification.actionLabel || 'Abrir'} aria-label={notification.actionLabel || 'Abrir'}><ExternalLink className="w-4 h-4" /></button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
