import React, { useEffect, useId, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Mail,
  Send,
  ServerCrash,
  ShieldAlert,
  X,
} from "lucide-react";

const SUBJECT_MAX = 150;
const MESSAGE_MAX = 4000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ComposerStatus =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "accepted"; reference?: string }
  | { kind: "failed"; message: string }
  | { kind: "rate_limited"; message: string }
  | { kind: "not_configured"; message: string }
  | { kind: "internal_recipient"; message: string }
  | { kind: "invalid"; message: string };

interface ExternalEmailApiPayload {
  state?: string;
  reference?: string;
  error?: string;
  code?: string;
}

/** Identificador estável por rascunho: repetir o envio não duplica o email. */
function createRequestId(): string {
  const cryptoApi = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return `ext-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function readPayload(response: Response): Promise<ExternalEmailApiPayload> {
  try {
    const payload = await response.json();
    return payload && typeof payload === "object" ? (payload as ExternalEmailApiPayload) : {};
  } catch {
    return {};
  }
}

export interface ExternalEmailComposerProps {
  /** `dialog` abre sobre o hub; `inline` encaixa numa página do painel. */
  variant?: "dialog" | "inline";
  onClose?: () => void;
  /** Email da conta que assina as respostas (Reply-To do servidor). */
  senderEmail?: string;
  /** Apenas para o texto de apoio: cidadão, empresa ou administração. */
  roleLabel?: string;
}

export const ExternalEmailComposer: React.FC<ExternalEmailComposerProps> = ({
  variant = "inline",
  onClose,
  senderEmail,
  roleLabel,
}) => {
  const toId = useId();
  const subjectId = useId();
  const messageId = useId();
  const hintId = useId();
  const titleId = useId();

  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<ComposerStatus>({ kind: "idle" });
  const requestIdRef = useRef<string>(createRequestId());

  const sending = status.kind === "sending";
  const accepted = status.kind === "accepted";

  useEffect(() => {
    if (variant !== "dialog" || !onClose) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, variant]);

  const resetDraft = () => {
    setTo("");
    setSubject("");
    setMessage("");
    setStatus({ kind: "idle" });
    requestIdRef.current = createRequestId();
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (sending) return;

    const recipient = to.trim();
    if (!EMAIL_PATTERN.test(recipient)) {
      setStatus({ kind: "invalid", message: "Indique um endereço de email válido (ex.: nome@exemplo.com)." });
      return;
    }
    if (!subject.trim()) {
      setStatus({ kind: "invalid", message: "Escreva o assunto do email." });
      return;
    }
    if (!message.trim()) {
      setStatus({ kind: "invalid", message: "Escreva a mensagem antes de enviar." });
      return;
    }

    setStatus({ kind: "sending" });
    try {
      const response = await fetch("/api/emails/external", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: recipient,
          subject: subject.trim(),
          message,
          requestId: requestIdRef.current,
        }),
      });
      const payload = await readPayload(response);

      if (response.status === 202) {
        setStatus({
          kind: "accepted",
          reference: typeof payload.reference === "string" ? payload.reference : undefined,
        });
        setTo("");
        setSubject("");
        setMessage("");
        requestIdRef.current = createRequestId();
        return;
      }

      if (response.status === 429) {
        setStatus({
          kind: "rate_limited",
          message: payload.error || "Limite de emails externos atingido (20 por hora).",
        });
        return;
      }

      if (response.status === 503) {
        setStatus({
          kind: "not_configured",
          message: "O envio de email ainda não está ativo nesta instalação.",
        });
        return;
      }

      if (payload.code === "RECIPIENT_IS_PLATFORM_MEMBER") {
        setStatus({
          kind: "internal_recipient",
          message: payload.error || "Este destinatário tem conta no Guigui.com. Use as mensagens internas.",
        });
        return;
      }

      if (response.status === 400) {
        setStatus({
          kind: "invalid",
          message: payload.error || "Verifique o destinatário, o assunto e a mensagem.",
        });
        return;
      }

      if (response.status === 401) {
        setStatus({ kind: "failed", message: "A sessão expirou. Inicie sessão novamente para enviar." });
        return;
      }

      setStatus({
        kind: "failed",
        message: payload.error || "O fornecedor de email não aceitou a mensagem. Tente novamente.",
      });
    } catch {
      setStatus({
        kind: "failed",
        message: "Sem ligação ao servidor. Verifique a rede e tente novamente.",
      });
    }
  };

  const statusNotice = () => {
    switch (status.kind) {
      case "accepted":
        return (
          <div className="guigui-email-status is-accepted" role="status">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            <div>
              <strong>Email aceite pelo servidor de email</strong>
              <p>
                A mensagem saiu do Guigui.com e o fornecedor aceitou-a para entrega.
                {status.reference ? ` Referência: ${status.reference}.` : ""} A entrega
                final depende do servidor do destinatário.
              </p>
            </div>
          </div>
        );
      case "failed":
        return (
          <div className="guigui-email-status is-failed" role="alert">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <div>
              <strong>Falha no envio</strong>
              <p>{status.message}</p>
            </div>
          </div>
        );
      case "rate_limited":
        return (
          <div className="guigui-email-status is-limited" role="alert">
            <Clock3 className="h-4 w-4" aria-hidden="true" />
            <div>
              <strong>Limite de envio atingido</strong>
              <p>{status.message} Limite de 20 emails externos por hora e por conta.</p>
            </div>
          </div>
        );
      case "not_configured":
        return (
          <div className="guigui-email-status is-unconfigured" role="alert">
            <ServerCrash className="h-4 w-4" aria-hidden="true" />
            <div>
              <strong>Serviço de email não configurado</strong>
              <p>
                {status.message} É preciso definir BREVO_API_KEY ou SMTP_HOST/SMTP_PORT
                no servidor. Nenhum email foi enviado.
              </p>
            </div>
          </div>
        );
      case "internal_recipient":
        return (
          <div className="guigui-email-status is-internal" role="alert">
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            <div>
              <strong>Destinatário dentro da plataforma</strong>
              <p>{status.message}</p>
            </div>
          </div>
        );
      case "invalid":
        return (
          <div className="guigui-email-status is-invalid" role="alert">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <div>
              <strong>Dados por corrigir</strong>
              <p>{status.message}</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const card = (
    <div
      className={`guigui-email-card ${variant === "inline" ? "is-inline" : ""}`}
      role={variant === "dialog" ? "dialog" : undefined}
      aria-modal={variant === "dialog" ? true : undefined}
      aria-labelledby={titleId}
    >
      <header className="guigui-email-head">
        <span className="guigui-email-mark" aria-hidden="true">
          <Mail className="h-4 w-4" />
        </span>
        <div className="guigui-email-heading">
          <h2 id={titleId}>Email para fora do Guigui.com</h2>
          <p>
            {roleLabel ? `Envio a partir da conta de ${roleLabel}. ` : ""}
            A mensagem sai da plataforma: o remetente é o Guigui.com e as respostas
            chegam ao email da sua conta.
          </p>
        </div>
        {variant === "dialog" && onClose && (
          <button
            type="button"
            className="guigui-email-close"
            onClick={onClose}
            aria-label="Fechar composição de email"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </header>

      <div className="guigui-email-identity">
        <span>
          <strong>De:</strong> Guigui.com
        </span>
        <span>
          <strong>Respostas para:</strong> {senderEmail || "o email da sua conta"}
        </span>
      </div>

      <form className="guigui-email-form" onSubmit={submit} noValidate>
        <div className="guigui-email-field">
          <label htmlFor={toId}>Para</label>
          <input
            id={toId}
            type="email"
            inputMode="email"
            autoComplete="off"
            placeholder="nome@exemplo.com"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            disabled={sending}
            aria-describedby={hintId}
            required
          />
          <p className="guigui-email-hint" id={hintId}>
            Só destinatários fora da plataforma. Dentro do Guigui.com, use as
            mensagens internas.
          </p>
        </div>

        <div className="guigui-email-field">
          <div className="guigui-email-label-row">
            <label htmlFor={subjectId}>Assunto</label>
            <span className={`guigui-email-counter ${subject.length >= SUBJECT_MAX ? "is-near-limit" : ""}`}>
              {subject.length}/{SUBJECT_MAX}
            </span>
          </div>
          <input
            id={subjectId}
            type="text"
            maxLength={SUBJECT_MAX}
            placeholder="Ex.: Proposta de parceria"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            disabled={sending}
            required
          />
        </div>

        <div className="guigui-email-field">
          <div className="guigui-email-label-row">
            <label htmlFor={messageId}>Mensagem</label>
            <span className={`guigui-email-counter ${message.length >= MESSAGE_MAX ? "is-near-limit" : ""}`}>
              {message.length}/{MESSAGE_MAX}
            </span>
          </div>
          <textarea
            id={messageId}
            rows={7}
            maxLength={MESSAGE_MAX}
            placeholder="Escreva a mensagem que o destinatário vai receber."
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            disabled={sending}
            required
          />
        </div>

        <div aria-live="polite">{statusNotice()}</div>

        <div className="guigui-email-actions">
          <button type="submit" className="guigui-email-submit" disabled={sending || accepted}>
            <Send className="h-4 w-4" aria-hidden="true" />
            {sending ? "A enviar…" : accepted ? "Enviado" : "Enviar email"}
          </button>
          {accepted && (
            <button type="button" className="guigui-email-secondary" onClick={resetDraft}>
              Escrever outro email
            </button>
          )}
        </div>
      </form>
    </div>
  );

  if (variant !== "dialog") return card;

  return (
    <div
      className="guigui-email-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      {card}
    </div>
  );
};
