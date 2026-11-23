import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  ShoppingBag,
  MessageSquare,
  Mail,
  Sparkles,
  Calendar,
  CreditCard,
  Trash2,
  Check,
  ShieldCheck,
  Building2,
  ExternalLink,
  X,
  Clock,
  Filter,
} from 'lucide-react';
import { AppNotification, Language, NotificationCategory, UserRole } from '../types';
import { filterNotificationsForContext, formatNotificationDateTime } from '../services/notificationService';
import { getTranslation } from '../utils/i18n';

interface NotificationBellProps {
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  currentRole: UserRole;
  currentLang?: Language;
  currentUserId?: string;
  currentBusinessId?: string;
  onNavigateTab?: (tab: string) => void;
  onOpenNotification?: (notification: AppNotification) => void;
  className?: string;
  align?: 'left' | 'right';
  theme?: 'light' | 'dark';
}

export const NotificationBell: React.FC<NotificationBellProps> = ({
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  currentRole,
  currentLang = 'pt' as Language,
  currentUserId,
  currentBusinessId,
  onNavigateTab,
  onOpenNotification,
  className = '',
  align = 'right',
  theme = 'light',
}) => {
  const t = (key: string) => getTranslation(currentLang, key);
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'important'>('all');
  const popoverRef = useRef<HTMLDivElement>(null);

  // O centro só expõe notificações dirigidas ao contexto actualmente autenticado.
  const filteredForRole = filterNotificationsForContext(notifications, {
    role: currentRole,
    userId: currentUserId,
    businessId: currentBusinessId,
  });

  const displayedList = filteredForRole.filter((n) => {
    if (activeFilter === 'unread') return !n.read;
    if (activeFilter === 'important') return ['urgent', 'high', 'critical', 'attention'].includes(n.priority || 'normal');
    return true;
  });

  const unreadCount = filteredForRole.filter((n) => !n.read).length;

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getCategoryIcon = (category: NotificationCategory) => {
    switch (category) {
      case 'business_approval':
        return <Building2 className="w-4 h-4 text-[var(--color-blue-600)]" />;
      case 'moderation':
        return <Sparkles className="w-4 h-4 text-[var(--color-amber-500)]" />;
      case 'order_redemption':
        return <ShoppingBag className="w-4 h-4 text-[var(--color-emerald-600)]" />;
      case 'billing':
        return <CreditCard className="w-4 h-4 text-[var(--color-purple-600)]" />;
      case 'event_reminder':
        return <Calendar className="w-4 h-4 text-[var(--color-orange-500)]" />;
      case 'review':
        return <MessageSquare className="w-4 h-4 text-[var(--color-cyan-600)]" />;
      case 'messages':
        return <Mail className="w-4 h-4 text-[var(--color-blue-600)]" />;
      case 'admin_alert':
      case 'security':
        return <ShieldCheck className="w-4 h-4 text-[var(--color-red-500)]" />;
      default:
        return <Bell className="w-4 h-4 text-[var(--color-slate-500)]" />;
    }
  };

  const getCategoryBg = (category: NotificationCategory, isUnread: boolean) => {
    if (!isUnread) return 'bg-[var(--color-slate-100)] dark:bg-[var(--color-slate-800)] text-[var(--color-slate-600)]';
    switch (category) {
      case 'business_approval':
        return 'bg-[var(--color-blue-50)] text-[var(--color-blue-700)] dark:bg-[var(--color-blue-900)]/60 dark:text-[var(--color-blue-300)]';
      case 'moderation':
        return 'bg-[var(--color-amber-50)] text-[var(--color-amber-700)] dark:bg-[var(--color-amber-950)]/60 dark:text-[var(--color-amber-300)]';
      case 'order_redemption':
        return 'bg-[var(--color-emerald-50)] text-[var(--color-emerald-700)] dark:bg-[var(--color-emerald-950)]/60 dark:text-[var(--color-emerald-300)]';
      case 'billing':
        return 'bg-[var(--color-purple-50)] text-[var(--color-purple-700)] dark:bg-[var(--color-purple-950)]/60 dark:text-[var(--color-purple-300)]';
      case 'event_reminder':
        return 'bg-[var(--color-orange-50)] text-[var(--color-orange-700)] dark:bg-[var(--color-orange-950)]/60 dark:text-[var(--color-orange-300)]';
      case 'messages':
        return 'bg-[var(--color-blue-50)] text-[var(--color-blue-700)] dark:bg-[var(--color-blue-900)]/60 dark:text-[var(--color-blue-300)]';
      case 'admin_alert':
      case 'security':
        return 'bg-[var(--color-red-50)] text-[var(--color-red-700)] dark:bg-[var(--color-red-900)]/60 dark:text-[var(--color-red-300)]';
      default:
        return 'bg-[var(--color-emerald-50)] text-[var(--color-emerald-700)] dark:bg-[var(--color-emerald-950)]/60 dark:text-[var(--color-emerald-300)]';
    }
  };

  return (
    <div className={`relative ${className}`} ref={popoverRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-10 h-10 rounded-2xl bg-[var(--color-bg-surface)]/90 bg-[var(--color-bg-surface)]/90 hover:bg-[var(--color-bg-subtle)] hover:bg-[var(--color-bg-subtle)] border border-[var(--color-border-subtle)] border-[var(--color-border-subtle)] flex items-center justify-center text-[var(--color-text-strong)] dark:text-[var(--color-text-muted)] transition shadow-xs active:scale-95"
        title={t('notificationsCenter')}
        aria-label={t('notifications')}
      >
        <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'text-[var(--color-amber-500)]' : ''}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-[var(--color-red-600)] text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white border-[var(--color-border-subtle)] animate-pulse shadow-xs">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } mt-2 w-84 sm:w-96 bg-[var(--color-bg-surface)] dark:bg-slate-800 bg-[var(--color-bg-surface)] dark:bg-slate-800 border border-[var(--color-border-subtle)] border-[var(--color-border-subtle)] rounded-3xl shadow-2xl z-50 text-xs overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150`}
        >
          {/* Header */}
          <div className="p-4 bg-[var(--color-bg-subtle)]/80 bg-[var(--color-bg-subtle)]/80 border-b border-[var(--color-border-subtle)] border-[var(--color-border-subtle)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-[var(--color-emerald-600)] text-white flex items-center justify-center shadow-xs font-black">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-[var(--color-text-strong)] dark:text-white leading-tight">
                  {t('notifications')}
                </h3>
                <span className="text-[10px] text-[var(--color-slate-500)] text-[var(--color-text-muted)] font-medium">
                  {currentRole === 'admin'
                    ? 'Painel Super Admin'
                    : currentRole === 'business'
                    ? 'Avisos da Empresa'
                    : 'Avisos do Cidadão'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={onMarkAllAsRead}
                  className="text-[11px] font-bold text-[var(--color-emerald-600)] dark:text-[var(--color-emerald-400)] hover:text-[var(--color-emerald-700)] dark:hover:text-[var(--color-emerald-300)] hover:underline px-2 py-1 rounded-lg"
                  title="Marcar todas como lidas"
                >
                  {t('markAsRead')}
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-full bg-[var(--color-bg-subtle)]/70 text-[var(--color-text-muted)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)] flex items-center justify-center transition"
                aria-label={`${t('close')} notificações`}
                title={`${t('close')} notificações`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 p-2 bg-[var(--color-bg-subtle)]/70 bg-[var(--color-bg-subtle)]/50 border-b border-[var(--color-border-subtle)]/60 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={`flex-1 py-1 px-2.5 rounded-xl text-center transition ${
                activeFilter === 'all'
                  ? 'bg-[var(--color-bg-surface)] dark:bg-slate-800 bg-[var(--color-bg-surface)] dark:bg-slate-800 text-[var(--color-text-strong)] dark:text-white shadow-xs font-black'
                  : 'text-[var(--color-slate-500)] hover:text-[var(--color-text-muted)] dark:hover:text-[var(--color-text-muted)]'
              }`}
            >
              {t('all')} ({filteredForRole.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('unread')}
              className={`flex-1 py-1 px-2.5 rounded-xl text-center transition ${
                activeFilter === 'unread'
                  ? 'bg-[var(--color-bg-surface)] dark:bg-slate-800 bg-[var(--color-bg-surface)] dark:bg-slate-800 text-[var(--color-emerald-600)] dark:text-[var(--color-emerald-400)] shadow-xs font-black'
                  : 'text-[var(--color-slate-500)] hover:text-[var(--color-text-muted)] dark:hover:text-[var(--color-text-muted)]'
              }`}
            >
              {t('unread')} ({unreadCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('important')}
              className={`flex-1 py-1 px-2.5 rounded-xl text-center transition ${
                activeFilter === 'important'
                  ? 'bg-[var(--color-bg-surface)] dark:bg-slate-800 bg-[var(--color-bg-surface)] dark:bg-slate-800 text-[var(--color-amber-600)] dark:text-[var(--color-amber-400)] shadow-xs font-black'
                  : 'text-[var(--color-slate-500)] hover:text-[var(--color-text-muted)] dark:hover:text-[var(--color-text-muted)]'
              }`}
            >
              {t('important')}
            </button>
          </div>

          {/* Notifications List */}
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-80 overflow-y-auto overscroll-contain">
            {displayedList.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-[var(--color-bg-subtle)] text-[var(--color-text-muted)] mx-auto flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-[var(--color-emerald-500)]" />
                </div>
                <div className="font-bold text-[var(--color-text-strong)] dark:text-[var(--color-text-muted)] text-xs">
                  {t('noPendingNotifications')}
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)] max-w-xs mx-auto">
                  {t('notificationEmptyDescription')}
                </p>
              </div>
            ) : (
              displayedList.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-3.5 hover:bg-[var(--color-bg-subtle)] hover:bg-[var(--color-bg-subtle)]/60 transition flex items-start gap-3 relative group ${
                    !notif.read ? 'bg-[var(--color-emerald-50)]/30 dark:bg-[var(--color-emerald-950)]/20' : ''
                  }`}
                >
                  {/* Category Icon */}
                  <div
                    className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 border border-[var(--color-border-subtle)]/60 ${getCategoryBg(
                      notif.category,
                      !notif.read
                    )}`}
                  >
                    {getCategoryIcon(notif.category)}
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h4
                        className={`text-xs truncate ${
                          !notif.read
                            ? 'font-black text-[var(--color-text-strong)] dark:text-white'
                            : 'font-bold text-[var(--color-text-strong)] dark:text-[var(--color-text-muted)]'
                        }`}
                      >
                        {notif.title}
                      </h4>
                      {!notif.read && (
                        <span className="w-2 h-2 rounded-full bg-[var(--color-emerald-500)] shrink-0" />
                      )}
                    </div>

                    <p className="text-[11px] text-[var(--color-text-muted)] dark:text-[var(--color-text-muted)] leading-snug">
                      {notif.message}
                    </p>

                    <div className="mt-2 flex items-center justify-between gap-2 pt-1 border-t border-[var(--color-border-subtle)] border-[var(--color-border-subtle)]/60">
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] uppercase tracking-wide font-black ${
                          ['critical', 'urgent'].includes(notif.priority || '') ? 'text-[var(--color-red-600)] dark:text-[var(--color-red-400)]' :
                          ['attention', 'high'].includes(notif.priority || '') ? 'text-[var(--color-amber-600)] dark:text-[var(--color-amber-400)]' :
                          notif.priority === 'success' ? 'text-[var(--color-emerald-600)] dark:text-[var(--color-emerald-400)]' : 'text-[var(--color-text-muted)]'
                        }`}>
                          {notif.priority === 'critical' || notif.priority === 'urgent' ? 'Crítico' : notif.priority === 'attention' || notif.priority === 'high' ? 'Atenção' : notif.priority === 'success' ? 'Sucesso' : 'Info'}
                        </span>
                        <span className="text-[10px] text-[var(--color-text-muted)] font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <time dateTime={notif.createdAt}>{formatNotificationDateTime(notif.createdAt, currentLang)}</time>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {!notif.read && (
                          <button
                            type="button"
                            onClick={() => onMarkAsRead(notif.id)}
                            className="text-[10px] font-bold text-[var(--color-slate-500)] hover:text-[var(--color-text-muted)] dark:hover:text-[var(--color-text-muted)] flex items-center gap-0.5"
                            title="Marcar como lida"
                          >
                            <Check className="w-3 h-3" />
                            Lida
                          </button>
                        )}

                        {(notif.linkTab && onNavigateTab || onOpenNotification) && (
                          <button
                            type="button"
                            onClick={() => {
                              onMarkAsRead(notif.id);
                              if (onOpenNotification) onOpenNotification(notif);
                              else if (notif.linkTab && onNavigateTab) onNavigateTab(notif.linkTab);
                              setIsOpen(false);
                            }}
                            className="px-2 py-0.5 bg-[var(--color-emerald-600)] hover:bg-[var(--color-emerald-700)] text-white font-black text-[10px] rounded-md transition flex items-center gap-1 shadow-2xs"
                          >
                            <span>{notif.actionLabel || 'Ver'}</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {displayedList.length > 0 && (
            <div className="p-2.5 bg-[var(--color-bg-subtle)]/80 border-t border-[var(--color-border-subtle)] border-[var(--color-border-subtle)] flex items-center justify-between text-[11px]">
              <span className="text-[var(--color-text-muted)] font-medium">
                {displayedList.length} avisos
              </span>
              <button
                type="button"
                onClick={onClearAll}
                className="text-[var(--color-red-600)] hover:text-[var(--color-red-700)] font-bold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[var(--color-red-50)] dark:hover:bg-[var(--color-red-900)]/40 transition"
              >
                <Trash2 className="w-3 h-3" />
                Limpar lista
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};







