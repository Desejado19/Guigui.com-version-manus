import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Send, X } from 'lucide-react';
import type { PostComment, UserProfile } from '../../types';

interface PostCommentsSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  comments: PostComment[];
  currentUser?: UserProfile | null;
  onRequireLogin?: (notice?: string) => void;
  onSubmit: (text: string) => Promise<void>;
  onReply?: (parentId: string, text: string) => Promise<void>;
}

const formatCommentDate = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * Painel inferior de comentários (mobile), no estilo Instagram.
 *
 * - Enquanto o teclado virtual está aberto, `VisualViewport` define a área
 *   realmente visível; o painel é encostado ao fundo dessa área, por isso o
 *   campo de escrita fica sempre acima do teclado.
 * - O documento não muda de escala: os campos usam >= 16px (ver
 *   `.guigui-mobile-input` no CSS), o que evita o zoom automático do iOS.
 * - O scroll da página é bloqueado com a posição preservada, para o Feed não
 *   saltar quando o painel abre ou fecha.
 */
export const PostCommentsSheet: React.FC<PostCommentsSheetProps> = ({
  open,
  onClose,
  title,
  subtitle,
  comments,
  currentUser,
  onRequireLogin,
  onSubmit,
  onReply,
}) => {
  const [text, setText] = useState('');
  const [replyTarget, setReplyTarget] = useState<PostComment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const focusComposer = useCallback(() => {
    // `preventScroll` evita que o browser reposicione o Feed ao focar.
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!open) {
      setReplyTarget(null);
      setText('');
      return;
    }
    // Bloquear o scroll no elemento raiz mantém a posição do Feed intacta e
    // evita que o `body` mude de largura/altura (o que deslocaria os cartões).
    // `scrollbar-gutter: stable` reserva o espaço da barra de scroll para que
    // a largura disponível não mude quando ela desaparece.
    const root = document.documentElement;
    const previousOverflow = root.style.overflow;
    const previousGutter = root.style.scrollbarGutter;
    root.style.scrollbarGutter = 'stable';
    root.style.overflow = 'hidden';

    // Fechar o teclado virtual antes de desmontar evita que o iOS reponha
    // o scroll da página por conta própria.
    const focusTimer = window.setTimeout(focusComposer, 220);

    return () => {
      window.clearTimeout(focusTimer);
      root.style.overflow = previousOverflow;
      root.style.scrollbarGutter = previousGutter;
    };
  }, [open, focusComposer]);

  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      // Distância entre o fundo do layout e o fundo da área visível (teclado).
      const inset = Math.max(
        0,
        window.innerHeight - (viewport.height + viewport.offsetTop),
      );
      setKeyboardInset(Math.round(inset));
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || comments.length === 0) return;
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [open, comments.length]);

  if (!open || typeof document === 'undefined') return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!currentUser) {
      onRequireLogin?.('Inicie sessão ou crie uma conta (Cidadão ou Empresa) para comentar publicações.');
      return;
    }
    const value = text.trim();
    if (!value || submitting) return;
    setSubmitting(true);
    try {
      if (replyTarget && onReply) {
        await onReply(replyTarget.id, value);
      } else {
        await onSubmit(value);
      }
      setText('');
      setReplyTarget(null);
      window.requestAnimationFrame(() => {
        const list = listRef.current;
        if (list) list.scrollTop = list.scrollHeight;
      });
    } catch (error) {
      onRequireLogin?.(error instanceof Error ? error.message : 'Não foi possível guardar o comentário.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderRow = (comment: PostComment, depth: number) => (
    <div key={comment.id} className={`flex items-start gap-2.5 ${depth > 0 ? 'ml-8' : ''}`}>
      <img
        src={comment.authorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'}
        alt=""
        className="h-8 w-8 shrink-0 rounded-full border border-slate-200 object-cover"
      />
      <div className="flex-1 rounded-2xl border border-slate-200 bg-[var(--color-bg-surface)] p-2.5 shadow-2xs dark:bg-[var(--color-bg-surface-dark)]">
        <div className="text-xs font-extrabold text-slate-900 dark:text-slate-200">{comment.authorName}</div>
        <p className="mt-0.5 whitespace-pre-line break-words text-sm text-slate-700 dark:text-slate-300">{comment.content}</p>
        <div className="mt-1 flex items-center gap-3 text-[10px] font-bold text-slate-400">
          {depth === 0 && onReply && (
            <button
              type="button"
              onClick={() => {
                setReplyTarget(replyTarget?.id === comment.id ? null : comment);
                focusComposer();
              }}
              className="text-[#1877F2] hover:underline"
            >
              Responder
            </button>
          )}
          <span>{formatCommentDate(comment.createdAt)}</span>
        </div>
      </div>
    </div>
  );

  return createPortal(
    <div
      className="md:hidden"
      data-testid="post-comments-sheet"
      style={{ position: 'fixed', inset: 0, zIndex: 120 }}
    >
      <button
        type="button"
        aria-label="Fechar comentários"
        onClick={onClose}
        className="absolute inset-0 h-full w-full bg-slate-950/45 backdrop-blur-[1px]"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Comentários de ${title}`}
        className="absolute inset-x-0 flex flex-col overflow-hidden rounded-t-3xl border border-b-0 border-slate-200 bg-[var(--color-bg-surface)] shadow-[0_-12px_40px_rgba(2,6,23,0.25)] dark:border-slate-800 dark:bg-[var(--color-bg-surface-dark)]"
        style={{
          bottom: `${keyboardInset}px`,
          maxHeight: `calc(100% - ${Math.max(keyboardInset, 0)}px - 12%)`,
          transition: 'bottom 160ms ease-out',
        }}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 pb-2 pt-2 dark:border-slate-800">
          <div className="min-w-0">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-700" aria-hidden="true" />
            <p className="truncate text-sm font-extrabold text-slate-900 dark:text-white">Comentários</p>
            {subtitle && <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {comments.length}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          ref={listRef}
          className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {comments.length === 0 && (
            <p className="py-6 text-center text-xs text-slate-500">Ainda não existem comentários. Seja o primeiro.</p>
          )}
          {comments.map((comment) => (
            <div key={comment.id} className="space-y-2">
              {renderRow(comment, 0)}
              {(comment.replies ?? []).map((reply) => renderRow(reply, 1))}
            </div>
          ))}
        </div>

        <form
          onSubmit={submit}
          className="shrink-0 border-t border-slate-100 bg-[var(--color-bg-surface)] px-3 pt-2 dark:border-slate-800 dark:bg-[var(--color-bg-surface-dark)]"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.5rem)' }}
        >
          {replyTarget && (
            <div className="mb-1 flex items-center justify-between rounded-lg bg-slate-100 px-2 py-1 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <span className="truncate">A responder a {replyTarget.authorName}</span>
              <button type="button" onClick={() => setReplyTarget(null)} className="font-bold text-[#1877F2]">
                Cancelar
              </button>
            </div>
          )}
          <div className="flex items-center gap-2">
            {currentUser?.avatarUrl ? (
              <img
                src={currentUser.avatarUrl}
                alt=""
                className="h-8 w-8 shrink-0 rounded-full border border-slate-200 object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-white">
                {currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : '?'}
              </div>
            )}
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={currentUser ? `Comentar como ${currentUser.name}...` : 'Escreva um comentário...'}
              aria-label="Escrever comentário"
              autoComplete="off"
              enterKeyHint="send"
              className="guigui-mobile-input min-w-0 flex-1 rounded-full border border-slate-200 bg-[var(--color-bg-surface)] px-4 py-2.5 text-slate-900 focus:border-blue-600 focus:outline-none dark:bg-[var(--color-bg-surface-dark)] dark:text-slate-200"
            />
            <button
              type="submit"
              aria-label="Publicar comentário"
              disabled={!text.trim() || submitting}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#1877F2] text-white transition disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
};
