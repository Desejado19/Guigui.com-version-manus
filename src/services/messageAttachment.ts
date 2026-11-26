export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;

export const ATTACHMENT_ACCEPT = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
].join(',');

export type UploadedAttachment = {
  url: string;
  name: string;
  mimeType: string;
  size: number;
};

/** Um anexo é imagem quando o tipo ou a extensão do ficheiro o indicam. */
export function isImageAttachment(value: { url?: string; mimeType?: string }): boolean {
  if (value.mimeType?.startsWith('image/')) return true;
  return Boolean(value.url && /\.(png|jpe?g|webp|gif)$/i.test(value.url));
}

export function formatAttachmentSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Envia o ficheiro para a conversa e devolve o URL público do anexo.
 * O corpo vai em bruto (sem base64) e o nome segue no cabeçalho X-File-Name.
 */
export async function uploadConversationAttachment(
  conversationId: string,
  file: File,
): Promise<UploadedAttachment> {
  if (file.size > ATTACHMENT_MAX_BYTES) {
    throw new Error('O ficheiro excede o limite de 5 MB.');
  }
  if (file.size === 0) {
    throw new Error('O ficheiro está vazio.');
  }

  const response = await fetch(
    `/api/conversations/${encodeURIComponent(conversationId)}/attachments`,
    {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-File-Name': encodeURIComponent(file.name),
      },
      body: file,
    },
  );

  const payload = (await response.json().catch(() => ({}))) as {
    url?: string;
    name?: string;
    mimeType?: string;
    size?: number;
    error?: string;
  };

  if (!response.ok || !payload.url) {
    throw new Error(payload.error || 'Não foi possível carregar o anexo.');
  }

  return {
    url: payload.url,
    name: payload.name || file.name,
    mimeType: payload.mimeType || file.type,
    size: payload.size ?? file.size,
  };
}
