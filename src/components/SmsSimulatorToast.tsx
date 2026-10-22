import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  MessageSquare,
  X,
  Check,
  Copy,
  Ticket,
  Bell,
  ShieldCheck,
  Sparkles,
  ChevronDown,
  Volume2,
} from 'lucide-react';
import { smsService, SmsMessagePayload } from '../services/smsService';
import { Language } from '../types';
import { getTranslation } from '../utils/i18n';

export const SmsSimulatorToast: React.FC<{ currentLang?: Language }> = ({ currentLang = 'pt' as Language }) => {
  const [currentSms, setCurrentSms] = useState<SmsMessagePayload | null>(null);
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const unsubscribe = smsService.subscribe((newSms) => {
      setCurrentSms(newSms);
      setIsExpanded(false);
      setCopied(false);
    });

    return () => unsubscribe();
  }, []);

  if (!currentSms) return null;

  const handleCopyCode = () => {
    const code = currentSms.metadata?.ticketCode || currentSms.metadata?.pinCode || currentSms.messageText;
    navigator.clipboard?.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const isTicket = currentSms.type === 'ticket_purchase';
  const isReminder = currentSms.type === 'event_reminder';
  const t = (key: string) => getTranslation(currentLang, key);

  return (
    <div className="fixed top-4 right-3 sm:right-6 z-[9999] max-w-md w-[calc(100vw-24px)] sm:w-full animate-in slide-in-from-top-4 duration-300">
      <div className="bg-slate-900/95 text-white border-2 border-emerald-500/80 rounded-3xl shadow-2xl backdrop-blur-md p-4 sm:p-5 space-y-3">
        {/* Top Header Bar */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30 shrink-0">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono text-xs font-black text-emerald-400 tracking-wider">
                  {currentSms.sender}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 font-bold border border-emerald-800">
                  {t('smsReceived')}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono">
                Para: {currentSms.recipientPhone} ⬢ Agora mesmo
              </p>
            </div>
          </div>

          <button type="button"
            onClick={() => setCurrentSms(null)}
            className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition"
            title={`${t('close')} notificação SMS`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Bubble Body */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-2xl p-3.5 space-y-2">
          <p className="text-xs text-slate-200 leading-relaxed font-sans select-text">
            {currentSms.messageText}
          </p>

          {/* Quick Highlighted Details if Ticket */}
          {isTicket && currentSms.metadata?.ticketCode && (
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
              <div className="text-[11px] font-mono">
                <span className="text-slate-400">{t('code')}: </span>
                <span className="font-extrabold text-emerald-400">{currentSms.metadata.ticketCode}</span>
                {currentSms.metadata.pinCode && (
                  <span className="ml-2 text-slate-400">
                    PIN: <strong className="text-amber-400">{currentSms.metadata.pinCode}</strong>
                  </span>
                )}
              </div>

              <button type="button"
                onClick={handleCopyCode}
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 text-[11px] font-bold flex items-center gap-1 transition"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? t('copied') : t('copy')}</span>
              </button>
            </div>
          )}
        </div>

        {/* Bottom Helper */}
        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5 px-1">
          <span className="flex items-center gap-1 text-emerald-400/90 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            {t('smsGatewaySimulation')}
          </span>

          <button type="button"
            onClick={() => setCurrentSms(null)}
            className="text-slate-300 hover:text-white font-bold hover:underline"
          >
            {t('saved')}
          </button>
        </div>
      </div>
    </div>
  );
};
