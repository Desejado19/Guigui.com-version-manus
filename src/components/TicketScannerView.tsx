import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  QrCode,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  Wifi,
  WifiOff,
  Download,
  Upload,
  Search,
  Camera,
  Users,
  Clock,
  User,
  Ticket,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Volume2,
  VolumeX,
  Smartphone,
  Check,
  Calendar,
  AlertTriangle,
  Play,
} from 'lucide-react';
import { EventItem, Language, PurchaseOrder } from '../types';
import { getTranslation } from '../utils/i18n';
import jsQR from 'jsqr';

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

interface TicketScannerViewProps {
  events: EventItem[];
  currentLang: Language;
  purchaseOrders?: PurchaseOrder[];
  onValidatePurchaseOrder?: (orderId: string, redeemedBy: string) => void;
}

interface ScanHistoryEntry {
  id: string;
  ticketCode: string;
  buyerName: string;
  ticketType: string;
  eventTitle: string;
  timestamp: string;
  status: 'valid' | 'already_used' | 'invalid';
}

type ScanResult = {
  valid: boolean;
  status: 'success' | 'already_used' | 'invalid' | 'cancelled' | 'network_error' | 'server_error' | 'unauthorized_scanner';
  message: string;
  ticket?: {
    ticketCode?: string;
    buyerName?: string;
    buyerPhone?: string;
    eventTitle?: string;
    ticketTypeName?: string;
    priceXOF?: number;
    validatedAt?: string;
    previousValidationTime?: string;
  };
  validatedAt?: string;
  code?: string;
};

interface DoorStaffLoginProps {
  events: EventItem[];
  selectedEvent: EventItem | null;
  doorCode: string;
  onSelectEvent: (event: EventItem | null) => void;
  onDoorCodeChange: (value: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}

// ============================================================================
// Modo offline do scanner (Secção 7.2 / GUI-3.5.09 e 3.5.10)
// ============================================================================

type OfflineManifest = { eventId: string; companyId: string; generatedAt: string; expiresAt: string; signature: string; tickets: Array<{ code: string; token: string }> };
type OfflineRecord = { code: string; validatedAt: string; deviceId: string };

const deviceId = (): string => {
  const key = 'guigui_scanner_device_id';
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const created = `scanner-${Math.random().toString(36).slice(2, 10)}`;
    window.localStorage.setItem(key, created);
    return created;
  } catch {
    return 'scanner-anonimo';
  }
};

const readJson = <T,>(key: string, fallback: T): T => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};
const writeJson = (key: string, value: unknown) => {
  try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* sem armazenamento */ }
};

const manifestKey = (eventId: string) => `guigui_scanner_manifest_${eventId}`;
const queueKey = (eventId: string) => `guigui_scanner_offline_queue_${eventId}`;


const DoorStaffLogin: React.FC<DoorStaffLoginProps & { currentLang: Language }> = ({ events, selectedEvent, doorCode, onSelectEvent, onDoorCodeChange, onSubmit, currentLang }) => {
  const t = (key: string) => getTranslation(currentLang, key);
  return (
  <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 max-w-md mx-auto shadow-md space-y-5 text-center">
    <div className="w-16 h-16 bg-blue-100 text-blue-700 rounded-3xl flex items-center justify-center mx-auto shadow-sm">
      <QrCode className="w-9 h-9" />
    </div>

    <div>
      <span className="text-[10px] uppercase font-extrabold tracking-wider text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200">{t('scannerModule')}</span>
      <h2 className="text-xl font-black text-slate-900 mt-2">{t('scannerTitle')}</h2>
      <p className="text-xs text-slate-600 mt-1">
        {t('scannerSubtitle')}
      </p>
    </div>

    <form onSubmit={onSubmit} className="space-y-4 text-xs text-left">
      <div>
        <label className="block text-slate-700 font-bold mb-1">Selecione o Evento</label>
        <select
          value={selectedEvent?.id}
          onChange={(e) => onSelectEvent(events.find((ev) => ev.id === e.target.value) || events[0] || null)}
          className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-bold focus:outline-none focus:border-blue-500"
        >
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.title} · {ev.neighborhood}
            </option>
          ))}
        </select>
      </div>

      <div>
        <div className="flex justify-between items-center mb-1">
          <label className="block text-slate-700 font-bold">{t('scannerStaffPin')}</label>
          <span className="text-[10px] text-slate-500 font-mono">Demo: PORTA2026</span>
        </div>
        <input
          type="password"
          required
          value={doorCode}
          onChange={(e) => onDoorCodeChange(e.target.value)}
          placeholder="Ex: PORTA2026"
          className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-mono tracking-widest text-center text-base font-bold focus:outline-none focus:border-blue-500"
        />
      </div>

      <button
        type="submit"
        className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-2 min-h-[44px]"
      >
        <ShieldCheck className="w-4 h-4" />
        <span>Abrir Scanner do Evento</span>
      </button>
    </form>
  </div>
  );
};

const ScanFeedback: React.FC<{ lastScanResult: ScanResult | null; selectedEvent: EventItem | null; currentLang: Language }> = ({ lastScanResult, selectedEvent, currentLang }) => {
  const t = (key: string) => getTranslation(currentLang, key);
  if (!lastScanResult) return null;
  return (
    <div className="max-w-lg mx-auto">
      {lastScanResult.valid ? (
        /* BILHETE VÁLIDO BANNER */
        <div className="p-6 rounded-3xl border-2 border-emerald-500 bg-emerald-50 text-emerald-950 shadow-lg space-y-4 animate-in zoom-in-95 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <CheckCircle2 className="w-8 h-8 animate-pulse" />
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-wider text-emerald-700">{t('scannerApproved')}</div>
              <h3 className="text-2xl font-black text-emerald-900 leading-tight">{t('scannerValidBanner')}</h3>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-xs rounded-2xl p-4 border border-emerald-200 text-xs space-y-2">
            <div className="flex justify-between py-1 border-b border-emerald-100">
              <span className="text-slate-600 font-medium">Nome do Comprador:</span>
              <span className="font-extrabold text-slate-900">{lastScanResult.ticket?.buyerName || 'Mamadu Saliu Djaló'}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-emerald-100">
              <span className="text-slate-600 font-medium">Evento:</span>
              <span className="font-bold text-slate-900">{lastScanResult.ticket?.eventTitle || selectedEvent?.title}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-emerald-100">
              <span className="text-slate-600 font-medium">Tipo de Bilhete:</span>
              <span className="font-extrabold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                {lastScanResult.ticket?.ticketTypeName || 'Entrada Oficial'}
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-emerald-100">
              <span className="text-slate-600 font-medium">{t('scannerTicketNumber')}</span>
              <span className="font-mono font-extrabold text-slate-900">
                {lastScanResult.ticket?.ticketCode || 'GUI-2026-EVT-000458'}
              </span>
            </div>
            <div className="flex justify-between items-center pt-1 text-emerald-800 font-bold">
              <span className="text-slate-600 font-medium">Hora do Check-in:</span>
              <span className="font-mono text-emerald-700">{new Date().toLocaleTimeString('pt-PT')}</span>
            </div>
          </div>
        </div>
      ) : lastScanResult.status === 'already_used' ? (
        /* BILHETE JÁ UTILIZADO BANNER */
        <div className="p-6 rounded-3xl border-2 border-red-500 bg-red-50 text-red-950 shadow-lg space-y-4 animate-in zoom-in-95 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <AlertOctagon className="w-8 h-8 animate-bounce" />
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-wider text-red-700">
                Alerta de Fraude / Entrada Duplicada
              </div>
              <h3 className="text-2xl font-black text-red-900 leading-tight">{t('scannerAlreadyUsedBanner')}</h3>
            </div>
          </div>

          <div className="bg-white/90 backdrop-blur-xs rounded-2xl p-4 border border-red-200 text-xs space-y-2">
            <p className="text-red-800 font-extrabold">
              {t('scannerAlreadyUsedWarning')}
            </p>
            {lastScanResult.ticket && (
              <div className="pt-2 border-t border-red-100 text-xs text-slate-700 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Titular Original:</span>
                  <strong className="text-slate-900">{lastScanResult.ticket.buyerName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Bilhete Nº:</span>
                  <strong className="font-mono text-slate-900">{lastScanResult.ticket.ticketCode}</strong>
                </div>
                {lastScanResult.ticket.previousValidationTime && (
                  <div className="flex justify-between text-red-700 font-bold">
                    <span>Validado em:</span>
                    <span>{lastScanResult.ticket.previousValidationTime}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* BILHETE INVÁLIDO BANNER */
        <div className="p-6 rounded-3xl border-2 border-rose-500 bg-rose-50 text-rose-950 shadow-lg space-y-3 animate-in zoom-in-95 duration-200">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <XCircle className="w-8 h-8" />
            </div>
            <div>
              <div className="text-[11px] font-black uppercase tracking-wider text-rose-700">{t('scannerUnknownCode')}</div>
              <h3 className="text-2xl font-black text-rose-900 leading-tight">{t('scannerInvalidBanner')}</h3>
            </div>
          </div>

          <p className="text-xs text-rose-800 bg-white/90 p-3.5 rounded-xl border border-rose-200 font-medium">
            {t('scannerInvalidHint')}
          </p>
        </div>
      )}
    </div>
  );
};

const EntryHistory: React.FC<{ entryHistory: ScanHistoryEntry[]; currentLang: Language }> = ({ entryHistory, currentLang }) => {
  const t = (key: string) => getTranslation(currentLang, key);
  return (
  <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 space-y-4 shadow-xs">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-base font-extrabold text-slate-900 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          <span>{t('scannerHistory')}</span>
        </h3>
        <p className="text-xs text-slate-500">{t('scannerHistoryHint')}</p>
      </div>
      <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-xl">
        {entryHistory.length} registos
      </span>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase">
            <th className="pb-2.5">Hora</th>
            <th className="pb-2.5">Código</th>
            <th className="pb-2.5">Comprador</th>
            <th className="pb-2.5">Tipo</th>
            <th className="pb-2.5 text-right">Resultado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
          {entryHistory.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50 transition">
              <td className="py-2.5 font-mono text-slate-500 text-[11px]">{item.timestamp}</td>
              <td className="py-2.5 font-mono font-bold text-slate-900">{item.ticketCode}</td>
              <td className="py-2.5 font-bold text-slate-900">{item.buyerName}</td>
              <td className="py-2.5 text-slate-600">{item.ticketType}</td>
              <td className="py-2.5 text-right">
                {item.status === 'valid' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-extrabold">
                    <CheckCircle2 className="w-3 h-3" />{t('scannerStatusValid')}</span>
                ) : item.status === 'already_used' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-extrabold">
                    <AlertOctagon className="w-3 h-3" />{t('scannerStatusUsed')}</span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 text-red-800 text-[10px] font-extrabold">
                    <XCircle className="w-3 h-3" />{t('scannerStatusInvalid')}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
  );
};

export const TicketScannerView: React.FC<TicketScannerViewProps> = ({
  events,
  currentLang,
  purchaseOrders = [],
  onValidatePurchaseOrder,
}) => {
  const t = (key: string) => getTranslation(currentLang, key);

  const [doorCode, setDoorCode] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(events[0] || null);

  // Sound and Mode Settings
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Modo offline (Secção 7.2): só pode ser activado depois de descarregar o
  // manifesto assinado do evento. As validações ficam na fila e são
  // sincronizadas quando a rede regressa, com aviso de risco de duplicação.
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [offlineManifest, setOfflineManifest] = useState<OfflineManifest | null>(null);
  const [offlineQueue, setOfflineQueue] = useState<OfflineRecord[]>([]);
  const [offlineBusy, setOfflineBusy] = useState(false);
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null);

  const device = useMemo(() => deviceId(), []);

  // Ao trocar de evento, o manifesto e a fila desse evento passam a ser os activos.
  useEffect(() => {
    const eventId = selectedEvent?.id;
    if (!eventId) {
      setOfflineManifest(null);
      setOfflineQueue([]);
      return;
    }
    const manifest = readJson<OfflineManifest | null>(manifestKey(eventId), null);
    const usable = manifest && Date.parse(manifest.expiresAt) > Date.now() ? manifest : null;
    setOfflineManifest(usable);
    setOfflineQueue(readJson<OfflineRecord[]>(queueKey(eventId), []));
    if (!usable) setIsOfflineMode(false);
  }, [selectedEvent?.id]);

  /** Descarrega o manifesto assinado; sem ele não há validação offline. */
  const downloadOfflineManifest = async () => {
    if (!selectedEvent?.id) return;
    setOfflineBusy(true);
    setOfflineNotice(null);
    try {
      const response = await fetch('/api/tickets/offline-manifest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId: selectedEvent.id, doorCode }),
      });
      const payload = await response.json().catch(() => ({})) as { manifest?: OfflineManifest; error?: string };
      if (!response.ok || !payload.manifest) {
        setOfflineNotice(payload.error || 'Não foi possível preparar o modo offline.');
        return;
      }
      writeJson(manifestKey(selectedEvent.id), payload.manifest);
      setOfflineManifest(payload.manifest);
      setOfflineNotice(`Manifesto pronto: ${payload.manifest.tickets.length} bilhetes válidos, válido até ${new Date(payload.manifest.expiresAt).toLocaleString('pt-PT')}.`);
    } catch {
      setOfflineNotice('Sem ligação: não é possível descarregar o manifesto.');
    } finally {
      setOfflineBusy(false);
    }
  };

  /** Envia a fila offline ao servidor, que confirma ou corrige cada entrada. */
  const syncOfflineQueue = async () => {
    if (!selectedEvent?.id || offlineQueue.length === 0) return;
    setOfflineBusy(true);
    try {
      const response = await fetch('/api/tickets/validate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doorCode, records: offlineQueue }),
      });
      const payload = await response.json().catch(() => ({})) as { duplicates?: number; error?: string };
      if (!response.ok) {
        setOfflineNotice(payload.error || 'A sincronização falhou. A fila mantém-se para nova tentativa.');
        return;
      }
      const duplicates = payload.duplicates || 0;
      const total = offlineQueue.length;
      writeJson(queueKey(selectedEvent.id), []);
      setOfflineQueue([]);
      setOfflineNotice(duplicates === 0
        ? `${total} entradas sincronizadas e confirmadas pelo servidor.`
        : `${total} entradas sincronizadas: ${duplicates} não foram confirmadas (duplicadas, canceladas ou expiradas). Reveja a lista de entradas.`);
    } catch {
      setOfflineNotice('Ainda sem rede: a fila mantém-se para sincronizar mais tarde.');
    } finally {
      setOfflineBusy(false);
    }
  };

  /** Valida contra o manifesto local e regista na fila. */
  const validateOffline = (code: string, timeStr: string) => {
    const eventId = selectedEvent?.id;
    if (!eventId || !offlineManifest) return false;
    const normalized = code.trim().toUpperCase();
    const entry = offlineManifest.tickets.find((item) => item.code === normalized || item.token === normalized);
    if (!entry) {
      setLastScanResult({ valid: false, status: 'invalid', code: 'TICKET_NOT_IN_MANIFEST', message: 'BILHETE NÃO ESTÁ NA LISTA DESCARREGADA' });
      setFlashFeedback('error');
      playSyntheticSound('error');
      return true;
    }
    if (offlineQueue.some((record) => record.code === entry.code)) {
      setLastScanResult({ valid: false, status: 'already_used', code: 'TICKET_ALREADY_USED_OFFLINE', message: 'BILHETE JÁ PASSOU NESTE TERMINAL' });
      setFlashFeedback('error');
      playSyntheticSound('error');
      return true;
    }
    const record: OfflineRecord = { code: entry.code, validatedAt: new Date().toISOString(), deviceId: device };
    const next = [record, ...offlineQueue];
    writeJson(queueKey(eventId), next);
    setOfflineQueue(next);
    setLastScanResult({
      valid: true,
      status: 'success',
      code: 'TICKET_VALIDATED_OFFLINE',
      message: 'ENTRADA PERMITIDA (OFFLINE) — A CONFIRMAR NA SINCRONIZAÇÃO',
      validatedAt: record.validatedAt,
    });
    setEntryHistory((prev) => [{
      id: `offline-${Date.now()}`,
      ticketCode: entry.code,
      buyerName: 'Entrada offline',
      ticketType: '—',
      eventTitle: selectedEvent?.title || 'Evento Guigui',
      timestamp: timeStr,
      status: 'valid',
    }, ...prev.slice(0, 19)]);
    setFlashFeedback('success');
    playSyntheticSound('success');
    return true;
  };

  // Scanner Mode & Input State
  const [ticketInput, setTicketInput] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [flashFeedback, setFlashFeedback] = useState<'success' | 'error' | null>(null);

  // Scan Result Feedback State
  const [lastScanResult, setLastScanResult] = useState<ScanResult | null>(null);

  // Camera QR scanning state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationRef = useRef<number | null>(null);
  const cameraActiveRef = useRef(false);

  // Attendance stats & entry history
  const [enteredCount, setEnteredCount] = useState(142);
  const [entryHistory, setEntryHistory] = useState<ScanHistoryEntry[]>([
    {
      id: 'scan-1',
      ticketCode: 'GUI-2026-EVT-000458',
      buyerName: 'Carlos Domingos',
      ticketType: 'VIP (15.000 XOF)',
      eventTitle: 'Festival Cultural Bissau Crioulo 2026',
      timestamp: '20:38:12',
      status: 'valid',
    },
    {
      id: 'scan-2',
      ticketCode: 'GUI-2026-EVT-000412',
      buyerName: 'Aissatu Mané',
      ticketType: 'Normal (5.000 XOF)',
      eventTitle: 'Festival Cultural Bissau Crioulo 2026',
      timestamp: '20:36:45',
      status: 'valid',
    },
    {
      id: 'scan-3',
      ticketCode: 'GUI-2026-EVT-000412',
      buyerName: 'Aissatu Mané (Tentativa 2)',
      ticketType: 'Normal (5.000 XOF)',
      eventTitle: 'Festival Cultural Bissau Crioulo 2026',
      timestamp: '20:37:10',
      status: 'already_used',
    },
  ]);

  const handleDoorLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedDoorCode = doorCode.trim();
    if (normalizedDoorCode.length < 4) {
      alert('Introduza o código de segurança fornecido pela organização do evento.');
      return;
    }

    try {
      const res = await fetch('/api/tickets/scanner-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doorCode: normalizedDoorCode,
          eventId: selectedEvent?.id,
          businessId: selectedEvent?.businessId,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.authorized) throw new Error(data.message || 'Código de portaria inválido.');
      setIsAuthenticated(true);
    } catch (error) {
      setIsAuthenticated(false);
      alert(error instanceof Error ? error.message : 'Não foi possível autorizar este scanner.');
    }
  };

  const playSyntheticSound = (type: 'success' | 'error') => {
    if (!soundEnabled) return;
    try {
      const AudioContextClass: typeof AudioContext | undefined = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();

      if (type === 'success') {
        // High-fidelity multi-tone cheerful entry chord (C5 -> E5 -> G5)
        const tones = [523.25, 659.25, 783.99];
        tones.forEach((freq, index) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.07);
          gain.gain.setValueAtTime(0.25, ctx.currentTime + index * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + index * 0.07 + 0.25);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + index * 0.07);
          osc.stop(ctx.currentTime + index * 0.07 + 0.28);
        });

        // Haptic feedback
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([100, 50, 100]);
        }
      } else {
        // Double-low warning buzzer
        const tones = [220, 164.81];
        tones.forEach((freq, index) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(freq, ctx.currentTime + index * 0.14);
          gain.gain.setValueAtTime(0.35, ctx.currentTime + index * 0.14);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + index * 0.14 + 0.22);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + index * 0.14);
          osc.stop(ctx.currentTime + index * 0.14 + 0.24);
        });

        // Haptic warning feedback
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate([300, 100, 300]);
        }
      }
    } catch (e) {
      // Audio fallback
    }
  };

  const handleValidateTicket = async (codeToValidate?: string) => {
    const code = (codeToValidate || ticketInput).trim();
    if (!code) return;

    setIsScanning(true);
    const timeStr = new Date().toLocaleTimeString('pt-PT');

    const matchingLocalOrder = purchaseOrders.find((order) => {
      if (order.itemType !== 'ticket') return false;
      const candidates = [
        order.orderCode,
        order.qrToken,
        order.ticketPin,
        ...(order.ticketCredentials || []).map((credential) => [credential.ticketCode, credential.qrToken, credential.pinCode]).flat(),
      ].filter(Boolean) as string[];
      return candidates.some((candidate) => candidate.toLowerCase() === code.toLowerCase());
    });

    if (matchingLocalOrder) {
      const isAlreadyUsed = matchingLocalOrder.status === 'redeemed';
      const validTicket = matchingLocalOrder.ticketCredentials?.find((credential) =>
        [credential.ticketCode, credential.qrToken, credential.pinCode].some((value) => value && value.toLowerCase() === code.toLowerCase())
      ) || {
        ticketCode: matchingLocalOrder.orderCode,
        buyerName: matchingLocalOrder.customerName,
        ticketTypeName: matchingLocalOrder.itemTitle,
      };

      if (isAlreadyUsed) {
        const previousValidationTime = matchingLocalOrder.redeemedAt ? new Date(matchingLocalOrder.redeemedAt).toLocaleTimeString('pt-PT') : undefined;
        setLastScanResult({
          valid: false,
          status: 'already_used',
          message: 'Este bilhete já foi validado e não pode ser usado novamente.',
          ticket: {
            ticketCode: validTicket.ticketCode,
            buyerName: validTicket.buyerName || matchingLocalOrder.customerName,
            eventTitle: selectedEvent?.title || 'Evento Guigui',
            ticketTypeName: validTicket.ticketTypeName || matchingLocalOrder.itemTitle,
            previousValidationTime,
          },
        });
        setFlashFeedback('error');
        playSyntheticSound('error');
        setEntryHistory((prev) => [{
          id: 'scan-' + Date.now(),
          ticketCode: validTicket.ticketCode,
          buyerName: validTicket.buyerName || 'Reutilização de Bilhete',
          ticketType: validTicket.ticketTypeName || 'N/A',
          eventTitle: selectedEvent?.title || 'Evento Guigui',
          timestamp: timeStr,
          status: 'already_used',
        }, ...prev.slice(0, 19)]);
        setIsScanning(false);
        setTicketInput('');
        setTimeout(() => setFlashFeedback(null), 3000);
        return;
      }

      onValidatePurchaseOrder?.(matchingLocalOrder.id, doorCode || 'Portaria Guigui');
      setLastScanResult({
        valid: true,
        status: 'success',
        message: 'Bilhete validado com sucesso. Entrada autorizada.',
        ticket: {
          ticketCode: validTicket.ticketCode,
          buyerName: validTicket.buyerName || matchingLocalOrder.customerName,
          buyerPhone: matchingLocalOrder.customerPhone,
          eventTitle: selectedEvent?.title || 'Evento Guigui',
          ticketTypeName: validTicket.ticketTypeName || matchingLocalOrder.itemTitle,
          priceXOF: matchingLocalOrder.totalPriceXOF,
          validatedAt: new Date().toISOString(),
        },
        validatedAt: new Date().toISOString(),
      });
      setFlashFeedback('success');
      playSyntheticSound('success');
      setEnteredCount((prev) => prev + 1);
      setEntryHistory((prev) => [{
        id: 'scan-' + Date.now(),
        ticketCode: validTicket.ticketCode,
        buyerName: validTicket.buyerName || matchingLocalOrder.customerName,
        ticketType: validTicket.ticketTypeName || matchingLocalOrder.itemTitle,
        eventTitle: selectedEvent?.title || 'Evento Guigui',
        timestamp: timeStr,
        status: 'valid',
      }, ...prev.slice(0, 19)]);
      setIsScanning(false);
      setTicketInput('');
      setTimeout(() => setFlashFeedback(null), 3000);
      return;
    }

    // Em modo offline a validação é local, contra o manifesto assinado, e a
    // entrada fica na fila para confirmação do servidor quando a rede voltar.
    if (isOfflineMode && validateOffline(code, timeStr)) {
      setIsScanning(false);
      setTicketInput('');
      setTimeout(() => setFlashFeedback(null), 3000);
      return;
    }

    // Validação online, com evento e empresa organizadora.
    try {
      const res = await fetch('/api/tickets/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          codeOrToken: code,
          doorCode,
          eventId: selectedEvent?.id,
          businessId: selectedEvent?.businessId,
        }),
      });

      const data = await res.json().catch(() => ({
        valid: false,
        status: 'server_error',
        code: 'INVALID_SERVER_RESPONSE',
        message: 'O servidor devolveu uma resposta inválida.',
      }));
      if (!res.ok) {
        setLastScanResult(data);
      } else {
        setLastScanResult(data);
      }

      if (data.valid) {
        setFlashFeedback('success');
        playSyntheticSound('success');
        setEnteredCount((prev) => prev + 1);
        setEntryHistory((prev) => [
          {
            id: 'scan-' + Date.now(),
            ticketCode: data.ticket?.ticketCode || code,
            buyerName: data.ticket?.buyerName || 'Portador do Bilhete',
            ticketType: data.ticket?.ticketTypeName || 'Entrada',
            eventTitle: selectedEvent?.title || 'Evento Guigui',
            timestamp: timeStr,
            status: 'valid',
          },
          ...prev.slice(0, 19),
        ]);
      } else {
        setFlashFeedback('error');
        playSyntheticSound('error');
        setEntryHistory((prev) => [
          {
            id: 'scan-' + Date.now(),
            ticketCode: data.ticket?.ticketCode || code,
            buyerName:
              data.ticket?.buyerName ||
              (data.status === 'already_used' ? t('scannerReuseAttempt') : 'Bilhete Inválido'),
            ticketType: data.ticket?.ticketTypeName || 'N/A',
            eventTitle: selectedEvent?.title || 'Evento Guigui',
            timestamp: timeStr,
            status: data.status === 'already_used' ? 'already_used' : 'invalid',
          },
          ...prev.slice(0, 19),
        ]);
      }
    } catch (err) {
      setLastScanResult({
        valid: false,
        status: 'network_error',
        code: 'SCANNER_NETWORK_ERROR',
        message: 'Não foi possível contactar o servidor. A validação de bilhetes exige ligação; tente novamente quando a rede recuperar.',
      });
      setFlashFeedback('error');
      playSyntheticSound('error');
    } finally {
      setIsScanning(false);
      setTicketInput('');
      setTimeout(() => setFlashFeedback(null), 3000);
    }
  };

  // Parses the QR payload generated by QRCodeDisplay: GUI-TICKET:v1:<qrToken>:<ticketCode>
  const parseTicketPayload = (raw: string): string => {
    const trimmed = raw.trim();
    if (trimmed.startsWith('GUI-TICKET:v1:')) {
      const parts = trimmed.split(':');
      if (parts.length >= 4) return parts[2] || parts.slice(3).join(':');
    }
    return trimmed;
  };

  const stopCamera = () => {
    cameraActiveRef.current = false;
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(t('scannerCameraUnsupported'));
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      cameraActiveRef.current = true;
      setIsCameraActive(true);
    } catch {
      setCameraError('Não foi possível aceder à câmara. Verifique as permissões do navegador e tente novamente.');
    }
  };

  // Attaches the stream and runs the decode loop while the camera is active
  useEffect(() => {
    if (!isCameraActive) return;
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => undefined);

    const canvas = document.createElement('canvas');
    const tick = () => {
      if (!cameraActiveRef.current) return;
      if (video.readyState >= video.HAVE_ENOUGH_DATA && video.videoWidth > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const decoded = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'attemptBoth' });
          if (decoded?.data) {
            stopCamera();
            void handleValidateTicket(parseTicketPayload(decoded.data));
            return;
          }
        }
      }
      animationRef.current = requestAnimationFrame(tick);
    };
    animationRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCameraActive]);

  // Safety cleanup: release the camera on unmount
  useEffect(() => () => {
    cameraActiveRef.current = false;
    if (animationRef.current !== null) cancelAnimationFrame(animationRef.current);
    streamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const totalCapacity = selectedEvent?.totalTicketsSold ? selectedEvent.totalTicketsSold * 1.5 : 500;
  const occupancyPercent = Math.min(100, Math.round((enteredCount / totalCapacity) * 100));

  // Available real tickets for fast simulation
  const availableTickets = purchaseOrders.filter((po) => po.itemType === 'ticket' || po.orderCode?.startsWith('GUI-'));

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 text-slate-900">
      {/* Door Staff Login Overlay */}
      {!isAuthenticated ? (
        <DoorStaffLogin
          currentLang={currentLang}
          events={events}
          selectedEvent={selectedEvent}
          doorCode={doorCode}
          onSelectEvent={setSelectedEvent}
          onDoorCodeChange={setDoorCode}
          onSubmit={handleDoorLogin}
        />
      ) : (
        /* Authenticated Scanner Screen */
        <div className="space-y-6">
          {/* Avisos do modo offline: risco de duplicação e estado da fila. */}
          {isOfflineMode && (
            <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 text-amber-950" role="alert">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div className="text-xs leading-relaxed">
                  <p className="font-black uppercase tracking-wide">{t('scannerOfflineActive')}</p>
                  <p className="mt-1 font-semibold">
                    {t('scannerOfflineHint')}
                  </p>
                  <p className="mt-2 font-bold">
                    Bilhetes na lista: {offlineManifest?.tickets.length || 0} · entradas por sincronizar: {offlineQueue.length}
                  </p>
                </div>
              </div>
            </div>
          )}
          {offlineNotice && (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-3 text-xs font-bold text-blue-900" role="status">
              {offlineNotice}
            </div>
          )}
          {/* Top Info Header */}
          <div className="bg-white border border-slate-200 rounded-3xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />{t('scannerSession')}</span>
                <span className="text-[11px] text-slate-500 font-medium">{selectedEvent?.neighborhood || 'Bissau'}</span>
              </div>
              <h2 className="text-lg font-black text-slate-900">{selectedEvent?.title}</h2>
            </div>

            <div className="flex items-center gap-2.5">
              {/* Sound toggle button */}
              <button type="button"
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition ${
                  soundEnabled
                    ? 'bg-blue-50 border-blue-300 text-blue-800'
                    : 'bg-slate-100 border-slate-300 text-slate-500'
                }`}
                title={soundEnabled ? 'Som de Validação Ativado' : 'Som Silenciado'}
              >
                {soundEnabled ? <Volume2 className="w-4 h-4 text-blue-600" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
                <span className="hidden sm:inline">{soundEnabled ? 'Som Ativo' : 'Mudo'}</span>
              </button>

              {/* Modo offline (Secção 7.2). Só fica disponível com manifesto
                  assinado descarregado, e avisa do risco de duplicação. */}
              <div className="flex flex-wrap items-center gap-2">
                <button type="button"
                  onClick={() => void downloadOfflineManifest()}
                  disabled={offlineBusy || !selectedEvent?.id}
                  className="px-3 py-2 rounded-xl border border-blue-300 bg-blue-50 text-blue-800 text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50"
                  title="Descarregar a lista assinada de bilhetes válidos deste evento para validar sem rede"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{offlineManifest ? 'Actualizar lista' : 'Preparar offline'}</span>
                </button>

                <button type="button"
                  onClick={() => {
                    if (offlineQueue.length > 0) void syncOfflineQueue();
                    else setIsOfflineMode(!isOfflineMode);
                  }}
                  disabled={offlineBusy || (!offlineManifest && offlineQueue.length === 0)}
                  className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition disabled:opacity-50 ${
                    offlineQueue.length > 0
                      ? 'bg-indigo-50 border-indigo-300 text-indigo-900'
                      : isOfflineMode
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  }`}
                  title={offlineManifest
                    ? offlineQueue.length > 0
                      ? 'Enviar as entradas registadas offline para confirmação do servidor'
                      : isOfflineMode
                        ? 'Voltar a validar no servidor'
                        : 'Validar localmente contra a lista descarregada'
                    : 'É preciso descarregar a lista de bilhetes antes de usar o modo offline'}
                >
                  {offlineQueue.length > 0 ? <Upload className="w-3.5 h-3.5" /> : isOfflineMode ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">
                    {offlineQueue.length > 0 ? `Sincronizar (${offlineQueue.length})` : isOfflineMode ? 'Offline' : 'Online'}
                  </span>
                </button>
              </div>

              <button type="button"
                onClick={() => { stopCamera(); setIsAuthenticated(false); }}
                className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl border border-slate-200 font-bold transition"
              >
                Encerrar
              </button>
            </div>
          </div>

          {/* Attendance Stats & Occupancy Counter */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 uppercase font-extrabold">
                <Users className="w-3.5 h-3.5 text-emerald-600" />
                <span>Pessoas Presentes</span>
              </div>
              <div className="font-mono text-3xl font-black text-emerald-600 mt-1">{enteredCount}</div>
              <div className="text-[10px] text-slate-400 mt-0.5">Bilhetes validados na porta</div>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 uppercase font-extrabold">
                <Ticket className="w-3.5 h-3.5 text-blue-600" />
                <span>Capacidade Estimada</span>
              </div>
              <div className="font-mono text-3xl font-black text-slate-900 mt-1">
                {Math.round(totalCapacity)}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">{t('scannerMaxCapacity')}</div>
            </div>

            <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-xs">
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500 uppercase font-extrabold">
                <Clock className="w-3.5 h-3.5 text-purple-600" />
                <span>{t('scannerOccupancy')}</span>
              </div>
              <div className="font-mono text-3xl font-black text-purple-600 mt-1">{occupancyPercent}%</div>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
                <div className="bg-purple-600 h-full rounded-full transition-all" style={{ width: `${occupancyPercent}%` }} />
              </div>
            </div>
          </div>

          {/* Scanner Card with Dynamic Viewport Highlight */}
          <div
            className={`bg-white border-2 rounded-3xl p-6 space-y-6 shadow-md transition-all duration-300 ${
              flashFeedback === 'success'
                ? 'border-emerald-500 ring-4 ring-emerald-500/30'
                : flashFeedback === 'error'
                ? 'border-red-500 ring-4 ring-red-500/30'
                : 'border-slate-200'
            }`}
          >
            {/* Camera Viewfinder */}
            <div className="relative w-full max-w-md mx-auto aspect-4/3 bg-slate-950 rounded-3xl overflow-hidden border-4 border-slate-800 shadow-inner flex flex-col items-center justify-center text-white p-4">
              {/* Live camera feed */}
              {isCameraActive && (
                <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />
              )}

              {/* Corner targeting guides */}
              <div className={`absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 rounded-tl-xl transition-colors ${
                flashFeedback === 'success' ? 'border-emerald-400' : flashFeedback === 'error' ? 'border-red-400' : 'border-blue-500'
              }`} />
              <div className={`absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 rounded-tr-xl transition-colors ${
                flashFeedback === 'success' ? 'border-emerald-400' : flashFeedback === 'error' ? 'border-red-400' : 'border-blue-500'
              }`} />
              <div className={`absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 rounded-bl-xl transition-colors ${
                flashFeedback === 'success' ? 'border-emerald-400' : flashFeedback === 'error' ? 'border-red-400' : 'border-blue-500'
              }`} />
              <div className={`absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 rounded-br-xl transition-colors ${
                flashFeedback === 'success' ? 'border-emerald-400' : flashFeedback === 'error' ? 'border-red-400' : 'border-blue-500'
              }`} />

              {/* Laser Scan Animation Line */}
              <div className={`absolute inset-x-8 top-1/2 h-0.5 shadow-lg animate-pulse ${
                flashFeedback === 'success' ? 'bg-emerald-400 shadow-[0_0_16px_#10b981]' : flashFeedback === 'error' ? 'bg-red-500 shadow-[0_0_16px_#ef4444]' : 'bg-red-500 shadow-[0_0_12px_#ef4444]'
              }`} />

              <div className={`relative z-10 w-16 h-16 rounded-2xl flex items-center justify-center mb-3 transition-colors ${
                flashFeedback === 'success' ? 'bg-emerald-600 text-white' : flashFeedback === 'error' ? 'bg-red-600 text-white' : 'bg-blue-600/30 border border-blue-400/40 text-blue-300'
              }`}>
                {flashFeedback === 'success' ? (
                  <CheckCircle2 className="w-9 h-9 animate-bounce" />
                ) : flashFeedback === 'error' ? (
                  <XCircle className="w-9 h-9 animate-shake" />
                ) : (
                  <Camera className="w-8 h-8" />
                )}
              </div>

              <span className="relative z-10 text-xs font-extrabold text-slate-200 tracking-wide text-center [text-shadow:0_1px_4px_rgba(0,0,0,0.8)]">
                {flashFeedback === 'success'
                  ? '✅ ENTRADA AUTORIZADA!'
                  : flashFeedback === 'error'
                  ? '🚫 ACESSO RECUSADO / JÁ UTILIZADO!'
                  : isCameraActive
                  ? '📷 A ler o QR Code…'
                  : 'Aponte a câmara para o QR Code do Bilhete'}
              </span>
              <span className="relative z-10 text-[10px] text-slate-400 mt-1 text-center max-w-xs [text-shadow:0_1px_4px_rgba(0,0,0,0.8)]">{t('scannerInstant')}</span>

              <div className="absolute bottom-3 inset-x-4 flex items-center justify-between text-[10px] text-slate-400 px-2">
                <span className="flex items-center gap-1">
                  <Volume2 className="w-3 h-3 text-blue-400" />
                  <span>Áudio: {soundEnabled ? 'Ligado' : 'Desligado'}</span>
                </span>
                <span className={`flex items-center gap-1 font-bold ${isCameraActive ? 'text-emerald-400' : 'text-slate-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${isCameraActive ? 'bg-emerald-400 animate-ping' : 'bg-slate-500'}`} />
                  {isCameraActive ? 'Câmara ativa' : 'Pronto a ler'}
                </span>
              </div>
            </div>

            {/* Camera toggle + error feedback */}
            <div className="max-w-md mx-auto w-full space-y-2 text-center">
              <button type="button"
                onClick={() => (isCameraActive ? stopCamera() : void startCamera())}
                className={`w-full font-black px-5 rounded-xl transition flex items-center justify-center gap-2 min-h-[44px] shadow-sm active:scale-[0.98] ${
                  isCameraActive
                    ? 'bg-slate-800 hover:bg-slate-900 text-white border border-slate-700'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                <Camera className="w-4 h-4" />
                <span>{isCameraActive ? 'Desligar Câmera' : 'Ligar Câmera e Ler QR'}</span>
              </button>
              {cameraError && (
                <p className="text-[11px] font-bold text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  {cameraError}
                </p>
              )}
            </div>

            {/* Manual Code / Token Entry */}
            <div className="space-y-3 max-w-md mx-auto text-xs text-left">
              <label className="block text-slate-700 font-bold">{t('scannerManualEntry')}</label>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={ticketInput}
                  onChange={(e) => setTicketInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleValidateTicket()}
                  placeholder="Ex: GUI-2026-EVT-000458 ou PIN..."
                  className="flex-1 bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 font-mono font-bold uppercase focus:outline-none focus:border-blue-500"
                />
                <button type="button"
                  onClick={() => handleValidateTicket()}
                  disabled={isScanning}
                  className="bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-black px-5 rounded-xl transition flex items-center justify-center gap-1.5 min-h-[44px] shadow-sm"
                >
                  <Search className="w-4 h-4" />
                  <span>Validar</span>
                </button>
              </div>

              {/* Quick Preset Buttons for Instant Demo & Real Tickets */}
              <div className="pt-2 space-y-2">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="text-slate-500 font-bold">{t('scannerSimulations')}</span>
                  <button type="button"
                    onClick={() => handleValidateTicket('QR-GUI-DEMO-001')}
                    className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1.5 rounded-lg font-bold transition active:scale-95"
                  >{t('scannerDemoValid')}</button>
                  <button type="button"
                    onClick={() => handleValidateTicket('4829')}
                    className="bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 px-2.5 py-1.5 rounded-lg font-bold transition active:scale-95"
                  >
                    🔐 PIN 4829
                  </button>
                  <button type="button"
                    onClick={() => handleValidateTicket('QR-GUI-DEMO-001')}
                    className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-2.5 py-1.5 rounded-lg font-bold transition active:scale-95"
                  >{t('scannerTestUsed')}</button>
                  <button type="button"
                    onClick={() => handleValidateTicket('INV-CODE-999')}
                    className="bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 px-2.5 py-1.5 rounded-lg font-bold transition active:scale-95"
                  >{t('scannerTestInvalid')}</button>
                  <button type="button"
                    onClick={() => playSyntheticSound('success')}
                    className="bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 px-2.5 py-1.5 rounded-lg font-bold transition active:scale-95 flex items-center gap-1"
                    title="Testar Som de Entrada"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>Testar Som</span>
                  </button>
                </div>

                {/* Real-time Issued Tickets in DB Selector */}
                {availableTickets.length > 0 && (
                  <div className="pt-1 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-[11px] space-y-1">
                    <div className="text-slate-500 font-bold flex items-center justify-between">
                      <span>Bilhetes Emitidos no Sistema ({availableTickets.length}):</span>
                      <span className="text-[10px] text-emerald-600 font-medium">Clique para validar</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {availableTickets.slice(0, 6).map((tkt) => (
                        <button type="button"
                          key={tkt.id}
                          onClick={() => handleValidateTicket(tkt.orderCode || tkt.qrToken)}
                          className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition flex items-center gap-1 ${
                            tkt.status === 'redeemed'
                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : 'bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200'
                          }`}
                        >
                          <span>{tkt.orderCode}</span>
                          <span className="text-[9px] font-sans font-normal truncate max-w-[80px]">({tkt.customerName})</span>
                          {tkt.status === 'redeemed' ? '⬢ Usado' : '⬢ Válido'}
                        </button>
                      ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
            </div>

          {/* Prominent Scan Result Feedback with High Contrast */}
          <ScanFeedback lastScanResult={lastScanResult} selectedEvent={selectedEvent} currentLang={currentLang} />
          </div>

          {/* Real-time Entry History Table */}
          <EntryHistory entryHistory={entryHistory} currentLang={currentLang} />
        </div>
      )}
    </div>
  );
};
