import React, { useState, useEffect } from 'react';
import {
  Bell,
  BellRing,
  Calendar,
  Clock,
  MapPin,
  X,
  Ticket,
  CheckCircle2,
  AlertTriangle,
  Smartphone,
  ExternalLink,
  Volume2,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { EventItem, EventReminder, ReminderTimeframe, Language } from '../types';
import { smsService } from '../services/smsService';

interface EventAlertsManagerProps {
  reminders: EventReminder[];
  onDismissReminder: (reminderId: string) => void;
  onRemoveReminder: (eventId: string) => void;
  onOpenEvent: (event: EventItem) => void;
  onOpenBuyModal: (event: EventItem) => void;
  events: EventItem[];
}

export const EventAlertsManager: React.FC<EventAlertsManagerProps> = ({
  reminders,
  onDismissReminder,
  onRemoveReminder,
  onOpenEvent,
  onOpenBuyModal,
  events,
}) => {
  const [activeToast, setActiveToast] = useState<EventReminder | null>(null);
  const [smsSimulatedNotice, setSmsSimulatedNotice] = useState<string | null>(null);
  const [dismissedToastIds, setDismissedToastIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('guigui_dismissed_alert_toasts');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Calculate days/hours until event
  const getProximityInfo = (eventDateStr: string, eventTimeStr: string) => {
    const now = new Date();
    const eventDate = new Date(`${eventDateStr}T${eventTimeStr || '20:00'}:00`);
    
    // If invalid date, fallback
    if (isNaN(eventDate.getTime())) {
      return { diffDays: 1, label: 'Brevemente', urgency: 'medium' as const };
    }

    const diffMs = eventDate.getTime() - now.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours <= 0 && diffHours >= -4) {
      return { diffDays: 0, label: '🔴 A decorrer agora em Bissau!', urgency: 'high' as const };
    }
    if (diffHours > 0 && diffHours <= 6) {
      return { diffDays: 0, label: `⚡ É hoje dentro de ${diffHours} hora(s)!`, urgency: 'high' as const };
    }
    if (diffDays <= 1) {
      return { diffDays: 1, label: '🔥 É já amanhã!', urgency: 'high' as const };
    }
    if (diffDays <= 3) {
      return { diffDays, label: `📅 Faltam ${diffDays} dias`, urgency: 'medium' as const };
    }
    return { diffDays, label: `📅 Faltam ${diffDays} dias`, urgency: 'low' as const };
  };

  // Check on mount or when reminders change if an alert should trigger
  useEffect(() => {
    if (reminders.length === 0) return;

    // Find first reminder not yet dismissed in current session that meets trigger criteria
    const candidates = reminders.filter((r) => !dismissedToastIds.includes(r.id));
    if (candidates.length > 0) {
      // Pick the most imminent or immediate test
      const testReminder = candidates.find((r) => r.timeframe === 'immediate_test');
      const chosen = testReminder || candidates[0];

      // Delay slightly for smooth page load transition
      const timer = setTimeout(() => {
        setActiveToast(chosen);

        // Try standard browser Web Notification if permitted
        if ('Notification' in window && Notification.permission === 'granted') {
          try {
            new Notification(`🔔 Guigui Eventos: ${chosen.eventTitle}`, {
              body: `Lembrete: O evento é em ${chosen.eventLocation} (${chosen.eventNeighborhood}). Data: ${chosen.eventDate} às ${chosen.eventTime}.`,
              icon: chosen.eventCover || '/favicon.ico',
            });
          } catch {
            // ignore
          }
        }
      }, 1200);

      return () => clearTimeout(timer);
    }
  }, [reminders, dismissedToastIds]);

  const handleDismissToast = (reminder: EventReminder) => {
    const updated = [...dismissedToastIds, reminder.id];
    setDismissedToastIds(updated);
    try {
      localStorage.setItem('guigui_dismissed_alert_toasts', JSON.stringify(updated));
    } catch {
      // ignore
    }
    setActiveToast(null);
    onDismissReminder(reminder.id);
  };

  const handleSimulateSmsAlert = (reminder: EventReminder) => {
    const phone = reminder.userPhone || '+245 955 00 00';
    smsService.sendEventReminderSms({
      userPhone: phone,
      eventTitle: reminder.eventTitle,
      eventDate: reminder.eventDate,
      eventTime: reminder.eventTime,
      location: reminder.eventLocation,
      neighborhood: reminder.eventNeighborhood,
    });
    setSmsSimulatedNotice(
      `📱 SMS de Lembrete enviado para ${phone}: "GUIGUI.COM: Lembrete do evento '${reminder.eventTitle}' marcado para ${reminder.eventDate} às ${reminder.eventTime} no local ${reminder.eventLocation}. Apresente o seu bilhete SMS!"`
    );
    setTimeout(() => {
      setSmsSimulatedNotice(null);
    }, 6000);
  };

  if (!activeToast) {
    return smsSimulatedNotice ? (
      <div className="fixed bottom-5 right-5 z-40 max-w-md bg-slate-900 text-emerald-400 p-4 rounded-2xl shadow-2xl border border-emerald-500/40 text-xs font-mono animate-in fade-in slide-in-from-bottom-3 flex items-start gap-3">
        <Smartphone className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="flex-1 text-slate-200">
          <div className="font-bold text-emerald-400 mb-1">Simulação de SMS Local</div>
          <p>{smsSimulatedNotice}</p>
        </div>
        <button type="button" onClick={() => setSmsSimulatedNotice(null)} className="text-slate-400 dark:text-slate-500 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
    ) : null;
  }

  const currentEvent = events.find((e) => e.id === activeToast.eventId);
  const proximity = getProximityInfo(activeToast.eventDate, activeToast.eventTime);

  return (
    <>
      {/* Floating In-App Event Reminder Toast / Banner */}
      <div className="fixed bottom-5 right-3 sm:right-6 z-40 max-w-lg w-[calc(100vw-24px)] sm:w-full bg-white dark:bg-slate-900 border-2 border-emerald-500 dark:border-emerald-600 rounded-3xl shadow-2xl p-4 sm:p-5 text-slate-900 dark:text-white animate-in slide-in-from-bottom-5 duration-300">
        
        {/* Header Ribbon */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center animate-bounce">
              <BellRing className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-black text-xs uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Lembrete de Evento Favorito
                </span>
                <span className="text-[10px] px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-black rounded-full">
                  {proximity.label}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Alerta automático ativado na sua agenda de Bissau
              </p>
            </div>
          </div>

          <button type="button"
            onClick={() => handleDismissToast(activeToast)}
            className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition"
            title="Dispensar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Event Summary Body */}
        <div className="py-3 flex gap-3 sm:gap-4 items-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800">
            <img
              src={activeToast.eventCover}
              alt={activeToast.eventTitle}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 min-w-0 space-y-1">
            <h4 className="font-black text-sm sm:text-base text-slate-900 dark:text-white leading-tight truncate">
              {activeToast.eventTitle}
            </h4>
            
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                <Calendar className="w-3.5 h-3.5" />
                {activeToast.eventDate} • {activeToast.eventTime}
              </span>
              <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                <MapPin className="w-3.5 h-3.5 text-red-500" />
                {activeToast.eventLocation} ({activeToast.eventNeighborhood})
              </span>
            </div>

            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
              Organização: <strong>{activeToast.organizerName}</strong>
            </p>
          </div>
        </div>

        {/* Action Controls Footer */}
        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <button type="button"
              onClick={() => handleSimulateSmsAlert(activeToast)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-[11px] flex items-center gap-1 transition"
              title="Receber SMS de aviso no telemóvel"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
              <span>Simular SMS</span>
            </button>

            <button type="button"
              onClick={() => {
                onRemoveReminder(activeToast.eventId);
                setActiveToast(null);
              }}
              className="px-2.5 py-1.5 rounded-xl hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 font-bold text-[11px] flex items-center gap-1 transition"
              title="Remover lembrete"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Desativar</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {currentEvent && (
              <button type="button"
                onClick={() => {
                  onOpenBuyModal(currentEvent);
                  setActiveToast(null);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 shadow-sm transition active:scale-95"
              >
                <Ticket className="w-4 h-4" />
                <span>Garantir Bilhete</span>
              </button>
            )}

            <button type="button"
              onClick={() => handleDismissToast(activeToast)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white font-bold text-xs transition"
            >
              Entendido
            </button>
          </div>
        </div>

        {/* SMS simulation feedback inside card */}
        {smsSimulatedNotice && (
          <div className="mt-3 p-2.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-xl text-[10px] text-emerald-900 dark:text-emerald-200 flex items-start gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="font-mono">{smsSimulatedNotice}</p>
          </div>
        )}
      </div>
    </>
  );
};
