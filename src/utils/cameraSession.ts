/**
 * Ciclo de vida da câmara do leitor de QR — lógica pura, partilhada entre
 * `TicketScannerView` e `scripts/audit-ticket-scanner.ts`.
 *
 * Estes helpers existem para que a limpeza de recursos (tracks da câmara,
 * `requestAnimationFrame`, `video.srcObject`) seja testável sem DOM real.
 */

export interface CameraRefs {
  active: { current: boolean };
  frame: { current: number | null };
  stream: { current: MediaStream | null };
}

export interface CameraVideoElement {
  // `HTMLVideoElement.srcObject` aceita MediaStream, MediaSource ou Blob.
  srcObject: unknown;
}

/** Para todos os tracks do stream (câmara/microfone), libertando o hardware. */
export function releaseCameraStream(stream: MediaStream | null): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // Um track já terminado não deve impedir a libertação dos restantes.
    }
  }
}

/**
 * Pára o loop de descodificação, liberta a câmara e desliga o vídeo.
 * Idempotente: pode ser chamada várias vezes (scan bem-sucedido, botão
 * "parar", desmontagem) sem erros nem duplo `stop()` nos tracks.
 */
export function stopCameraSession(
  refs: CameraRefs,
  video: CameraVideoElement | null,
  cancelFrame: (id: number) => void = (id) => cancelAnimationFrame(id),
): void {
  refs.active.current = false;
  if (refs.frame.current !== null) {
    cancelFrame(refs.frame.current);
    refs.frame.current = null;
  }
  if (refs.stream.current) {
    releaseCameraStream(refs.stream.current);
    refs.stream.current = null;
  }
  if (video) video.srcObject = null;
}

/**
 * Um pedido de `getUserMedia` só pode activar a câmara se ainda for o pedido
 * mais recente e o componente continuar montado. Caso contrário o stream
 * resolvido tem de ser imediatamente libertado (evita câmara ligada em fundo).
 */
export function isCameraRequestCurrent(requestId: number, latestRequestId: number, mounted: boolean): boolean {
  return mounted && requestId === latestRequestId;
}
