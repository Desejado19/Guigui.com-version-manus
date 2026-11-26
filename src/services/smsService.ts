/**
 * Guigui.com - Serviço de Simulação de Envio de SMS (Bissau Telecoms: Orange Money & Telecel)
 */
import type { Language } from '../types';

export interface SmsMessagePayload {
  id: string;
  sender: string; // e.g. "GUIGUI.COM" or "ORANGE-MONEY" or "TELECEL-BSS"
  recipientPhone: string;
  messageText: string;
  type: 'ticket_purchase' | 'event_reminder' | 'promotion_voucher' | 'system_alert';
  timestamp: string;
  metadata?: {
    eventTitle?: string;
    ticketCode?: string;
    pinCode?: string;
    qrToken?: string;
    amountXOF?: number;
    paymentMethod?: string;
  };
}

type SmsListener = (sms: SmsMessagePayload) => void;
function preferredLanguage(language?: Language): Language {
  if (language) return language;
  try {
    const stored = localStorage.getItem('guigui_current_lang') || localStorage.getItem('guigui_lang');
    const normalized = stored ? stored.replace(/^"|"$/g, '') : '';
    if (normalized === 'en' || normalized === 'fr' || normalized === 'es') return normalized;
  } catch {
    // Storage is unavailable in non-browser runtimes.
  }
  return 'pt';
}

class SmsSimulationService {
  private listeners: SmsListener[] = [];
  private history: SmsMessagePayload[] = [];

  constructor() {
    try {
      const saved = localStorage.getItem('guigui_sms_history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) this.history = parsed;
      }
    } catch {
      // ignore
    }
  }

  public subscribe(listener: SmsListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public sendSms(payload: Omit<SmsMessagePayload, 'id' | 'timestamp'>): SmsMessagePayload {
    const fullMessage: SmsMessagePayload = {
      ...payload,
      id: `sms-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
    };

    this.history = [fullMessage, ...this.history.slice(0, 49)];
    try {
      localStorage.setItem('guigui_sms_history', JSON.stringify(this.history));
    } catch {
      // ignore
    }

    // Play synthetic phone SMS incoming chime
    this.playSmsTone();

    // Trigger haptic vibration if available
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate([80, 40, 80]);
      } catch {
        // ignore
      }
    }

    // Notify active subscribers
    this.listeners.forEach((listener) => {
      try {
        listener(fullMessage);
      } catch (e) {
        console.error('Error in SMS listener', e);
      }
    });

    return fullMessage;
  }

  public sendTicketPurchaseSms(params: {
    buyerPhone: string;
    buyerName: string;
    eventTitle: string;
    ticketCode: string;
    pinCode: string;
    ticketTypeName: string;
    quantity: number;
    amountXOF: number;
    paymentMethod: string;
    qrToken: string;
    language?: Language;
  }): SmsMessagePayload {
    const methodLabel = params.paymentMethod === 'telecel' ? 'Telecel Cash' : 'Orange Money';
    const language = preferredLanguage(params.language);
    const amount = params.amountXOF.toLocaleString(language === 'pt' ? 'pt-PT' : language);
    const templates: Record<Language, string> = {
      pt: `[GUIGUI.COM] Compra confirmada (${params.quantity}x ${params.ticketTypeName}) p/ "${params.eventTitle}". Total: ${amount} XOF via ${methodLabel}. CÓDIGO: ${params.ticketCode} | PIN DE PORTARIA: ${params.pinCode}. Apresente o QR Code na entrada.`,
      en: `[GUIGUI.COM] Purchase confirmed (${params.quantity}x ${params.ticketTypeName}) for "${params.eventTitle}". Total: ${amount} XOF via ${methodLabel}. CODE: ${params.ticketCode} | ENTRY PIN: ${params.pinCode}. Show the QR code at the entrance.`,
      fr: `[GUIGUI.COM] Achat confirmé (${params.quantity}x ${params.ticketTypeName}) pour « ${params.eventTitle} ». Total : ${amount} XOF via ${methodLabel}. CODE : ${params.ticketCode} | PIN D'ENTRÉE : ${params.pinCode}. Présentez le QR code à l'entrée.`,
      es: `[GUIGUI.COM] Compra confirmada (${params.quantity}x ${params.ticketTypeName}) para « ${params.eventTitle} ». Total: ${amount} XOF vía ${methodLabel}. CÓDIGO: ${params.ticketCode} | PIN DE ENTRADA: ${params.pinCode}. Muestre el código QR en la entrada.`,
    };
    const text = templates[language];

    return this.sendSms({
      sender: 'GUIGUI-BILHETES',
      recipientPhone: params.buyerPhone,
      messageText: text,
      type: 'ticket_purchase',
      metadata: {
        eventTitle: params.eventTitle,
        ticketCode: params.ticketCode,
        pinCode: params.pinCode,
        qrToken: params.qrToken,
        amountXOF: params.amountXOF,
        paymentMethod: params.paymentMethod,
      },
    });
  }

  public sendEventReminderSms(params: {
    userPhone: string;
    eventTitle: string;
    eventDate: string;
    eventTime: string;
    location: string;
    neighborhood: string;
    language?: Language;
  }): SmsMessagePayload {
    const language = preferredLanguage(params.language);
    const templates: Record<Language, string> = {
      pt: `[GUIGUI.COM - ALERTA] Lembrete do seu evento favorito: "${params.eventTitle}" realiza-se em ${params.eventDate} às ${params.eventTime} no local ${params.location} (${params.neighborhood}). Tenha consigo os seus bilhetes!`,
      en: `[GUIGUI.COM - ALERT] Reminder for your favourite event: "${params.eventTitle}" takes place on ${params.eventDate} at ${params.eventTime} at ${params.location} (${params.neighborhood}). Keep your tickets with you!`,
      fr: `[GUIGUI.COM - ALERTE] Rappel de votre événement favori : « ${params.eventTitle} » aura lieu le ${params.eventDate} à ${params.eventTime}, à ${params.location} (${params.neighborhood}). Gardez vos billets avec vous !`,
      es: `[GUIGUI.COM - AVISO] Recordatorio de su evento favorito: « ${params.eventTitle} » se celebra el ${params.eventDate} a las ${params.eventTime} en ${params.location} (${params.neighborhood}). ¡Lleve sus entradas!`,
    };
    const text = templates[language];

    return this.sendSms({
      sender: 'GUIGUI-EVENTOS',
      recipientPhone: params.userPhone,
      messageText: text,
      type: 'event_reminder',
      metadata: {
        eventTitle: params.eventTitle,
      },
    });
  }

  public getHistory(): SmsMessagePayload[] {
    return [...this.history];
  }

  public clearHistory(): void {
    this.history = [];
    try {
      localStorage.removeItem('guigui_sms_history');
    } catch {
      // ignore
    }
  }

  private playSmsTone() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880.0, ctx.currentTime + 0.08); // A5
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } catch {
      // fallback
    }
  }
}

export const smsService = new SmsSimulationService();
