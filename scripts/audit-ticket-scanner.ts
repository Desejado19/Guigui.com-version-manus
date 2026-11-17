#!/usr/bin/env tsx
/**
 * Auditoria do leitor de QR de bilhetes.
 *
 * Testa a lógica real usada por `TicketScannerView` (src/utils/ticketQrPayload.ts):
 *  - filtragem por evento (códigos de outro evento devem ser rejeitados);
 *  - frame skipping (1 em cada 3 frames) sem perder códigos válidos.
 *
 * Uso: npx tsx scripts/audit-ticket-scanner.ts
 */
import {
  FRAME_PROCESS_INTERVAL,
  parseTicketPayload,
  shouldProcessFrame,
} from '../src/utils/ticketQrPayload';
import {
  isCameraRequestCurrent,
  releaseCameraStream,
  stopCameraSession,
} from '../src/utils/cameraSession';

const failures: string[] = [];

function check(name: string, condition: boolean, detail?: unknown) {
  if (condition) {
    console.log(`  ok   ${name}`);
  } else {
    console.error(`  FAIL ${name}${detail === undefined ? '' : ` -> ${JSON.stringify(detail)}`}`);
    failures.push(name);
  }
}

const EVENT_A = 'EVT-001';
const EVENT_B = 'EVT-002';

const payloadFor = (eventId: string, seq: string, code: string) =>
  `GUI-TICKET:v1:GUI-QR-${eventId}-${seq}-BSS:${code}`;

const eventACode = `GUI-${EVENT_A}-0001`;
const eventBCode = `GUI-${EVENT_B}-0001`;
const eventAPayload = payloadFor(EVENT_A, '001', eventACode);
const eventBPayload = payloadFor(EVENT_B, '001', eventBCode);

console.log('\n== Filtragem por evento ==');
{
  const parsed = parseTicketPayload(eventBPayload, EVENT_A);
  check('Evento A seleccionado + código do Evento B => rejeitado', parsed.eventMatches === false, parsed);
  check('Código do Evento B é extraído correctamente', parsed.code === eventBCode, parsed);
  check('Token do Evento B é extraído correctamente', parsed.qrToken === `GUI-QR-${EVENT_B}-001-BSS`, parsed);
}
{
  const parsed = parseTicketPayload(eventAPayload, EVENT_A);
  check('Evento A seleccionado + código do Evento A => aceite', parsed.eventMatches === true, parsed);
  check('Código do Evento A é extraído correctamente', parsed.code === eventACode, parsed);
}
{
  const parsed = parseTicketPayload(eventAPayload, EVENT_B);
  check('Evento B seleccionado + código do Evento A => rejeitado', parsed.eventMatches === false, parsed);
}
{
  const parsed = parseTicketPayload(eventBPayload, undefined);
  check('Sem evento seleccionado => aceite (modo livre)', parsed.eventMatches === true, parsed);
  const empty = parseTicketPayload(eventBPayload, '');
  check('Evento seleccionado vazio => aceite (modo livre)', empty.eventMatches === true, empty);
}

console.log('\n== Robustez / falsos positivos ==');
{
  const payload = payloadFor('EVT-10', '001', 'GUI-EVT-10-0001');
  check('EVT-1 seleccionado não apanha EVT-10', parseTicketPayload(payload, 'EVT-1').eventMatches === false);
  check('EVT-10 seleccionado apanha EVT-10', parseTicketPayload(payload, 'EVT-10').eventMatches === true);
}
{
  const parsed = parseTicketPayload(`  GUI-TICKET:v1:TOKEN-CUSTOM-${EVENT_A}:GUI-${EVENT_A}-9  `, EVENT_A);
  check('Espaços à volta do payload são ignorados', parsed.eventMatches === true && parsed.code === `GUI-${EVENT_A}-9`, parsed);
}
{
  const parsed = parseTicketPayload('GUI-TICKET:v1:tok:CODE:WITH:COLONS', EVENT_A);
  check('Códigos com ":" são preservados', parsed.code === 'CODE:WITH:COLONS', parsed);
}
{
  const parsed = parseTicketPayload('GUI-2026-000123', EVENT_A);
  check('Payload antigo (sem prefixo v1) não é aceite como válido', parsed.eventMatches === false && parsed.qrToken === '', parsed);
}
{
  const parsed = parseTicketPayload(eventAPayload);
  check('Sem eventId o código é aceite', parsed.eventMatches === true, parsed);
}

console.log('\n== Frame skipping ==');
{
  check(`Intervalo é ${FRAME_PROCESS_INTERVAL}`, FRAME_PROCESS_INTERVAL === 3);
  const processed = Array.from({ length: 30 }, (_, i) => i + 1).filter(shouldProcessFrame);
  check('Em 30 frames são processados 10', processed.length === 10, processed.length);
  check('Primeiro frame processado é o 3.º', processed[0] === 3, processed[0]);
  check('Nunca são processados frames 1 e 2', !shouldProcessFrame(1) && !shouldProcessFrame(2));
  check('Frames 3, 6 e 9 são processados', [3, 6, 9].every(shouldProcessFrame));
}

console.log('\n== Detecção sem perda de códigos válidos ==');
{
  // Simula o loop da câmara: o código está visível a partir do frame N e
  // permanece visível. Deve ser detectado no máximo 3 frames depois.
  const detectAt = (visibleFromFrame: number) => {
    for (let frame = 1; frame <= 60; frame += 1) {
      if (frame < visibleFromFrame) continue;
      if (!shouldProcessFrame(frame)) continue;
      return frame;
    }
    return -1;
  };
  for (const start of [1, 2, 3, 4, 5, 10, 11]) {
    const detected = detectAt(start);
    check(
      `Código visível desde o frame ${start} é detectado em ≤3 frames (frame ${detected})`,
      detected !== -1 && detected - start <= FRAME_PROCESS_INTERVAL - 1,
      detected,
    );
  }
  // Um código visível só num frame saltado (ex.: frame 2) não é lido nesse frame,
  // mas volta a ser lido assim que houver um frame processado.
  check('Frame 2 é saltado (código momentâneo perdido nesse frame)', shouldProcessFrame(2) === false);
}

console.log('\n== Rejeição do Evento B com o Evento A seleccionado ==');
{
  // Fluxo completo como no componente: handleValidateTicket recebe
  // parseTicketPayload(decoded, selectedEvent?.id) e só valida se eventMatches.
  const validate = (raw: string, selectedEventId?: string) => {
    const parsed = parseTicketPayload(raw, selectedEventId);
    return parsed.eventMatches ? { accepted: true, code: parsed.code } : { accepted: false, reason: 'EVENT_MISMATCH' };
  };
  check('Evento A seleccionado: código A aceite', validate(eventAPayload, EVENT_A).accepted === true);
  check('Evento A seleccionado: código B rejeitado', validate(eventBPayload, EVENT_A).accepted === false);
  check('Evento B seleccionado: código B aceite', validate(eventBPayload, EVENT_B).accepted === true);
  check('Evento B seleccionado: código A rejeitado', validate(eventAPayload, EVENT_B).accepted === false);
  check('Sem evento: ambos aceites', validate(eventAPayload).accepted && validate(eventBPayload).accepted);
}

console.log('\n== Limpeza da câmara ==');
{
  const makeTrack = () => {
    let stopped = 0;
    const track = { stop: () => { stopped += 1; }, get stopped() { return stopped; } };
    return track;
  };
  const trackA = makeTrack();
  const trackB = makeTrack();
  const stream = { getTracks: () => [trackA, trackB] } as unknown as MediaStream;
  const video = { srcObject: stream as MediaStream | null };
  const refs = {
    active: { current: true },
    frame: { current: 42 as number | null },
    stream: { current: stream as MediaStream | null },
  };
  const cancelled: number[] = [];

  stopCameraSession(refs, video, (id) => cancelled.push(id));
  check('Loop de animação é cancelado com o id pendente', cancelled.length === 1 && cancelled[0] === 42, cancelled);
  check('animationRef fica a null', refs.frame.current === null);
  check('câmara fica inactiva', refs.active.current === false);
  check('todos os tracks são parados', trackA.stopped === 1 && trackB.stopped === 1, [trackA.stopped, trackB.stopped]);
  check('streamRef fica a null', refs.stream.current === null);
  check('video.srcObject é desligado', video.srcObject === null);

  stopCameraSession(refs, video, (id) => cancelled.push(id));
  check('Segunda chamada é idempotente (sem cancelar de novo)', cancelled.length === 1, cancelled);
  check('Segunda chamada não volta a parar tracks', trackA.stopped === 1 && trackB.stopped === 1, [trackA.stopped, trackB.stopped]);
}
{
  const refs = { active: { current: false }, frame: { current: null }, stream: { current: null } };
  let threw = false;
  try {
    stopCameraSession(refs, null, () => undefined);
  } catch {
    threw = true;
  }
  check('Sem stream/video não lança excepção', threw === false);

  let stopped = 0;
  const throwingStream = {
    getTracks: () => [
      { stop: () => { throw new Error('track already ended'); } },
      { stop: () => { stopped += 1; } },
    ],
  } as unknown as MediaStream;
  let releaseThrew = false;
  try {
    releaseCameraStream(throwingStream);
  } catch {
    releaseThrew = true;
  }
  check('Track que falha ao parar não impede os restantes', releaseThrew === false && stopped === 1, { releaseThrew, stopped });
  releaseCameraStream(null);
  check('releaseCameraStream(null) é no-op', true);
}
{
  check('Pedido actual e montado => câmara pode ligar', isCameraRequestCurrent(3, 3, true) === true);
  check('Pedido antigo substituído => stream é libertado', isCameraRequestCurrent(2, 3, true) === false);
  check('Componente desmontado => stream é libertado', isCameraRequestCurrent(3, 3, false) === false);
  check('"Parar" durante o pedido invalida o pedido', isCameraRequestCurrent(4, 5, true) === false);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} verificação(ões) falharam.`);
  process.exit(1);
}
console.log('\nTodas as verificações do leitor de QR passaram.');
