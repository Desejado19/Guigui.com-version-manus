// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ExternalEmailComposer } from '../../../src/components/communication/ExternalEmailComposer';

const fillAndSend = async () => {
  await userEvent.type(screen.getByLabelText('Para'), 'parceiro@fora.example');
  await userEvent.type(screen.getByLabelText('Assunto'), 'Proposta');
  await userEvent.type(screen.getByLabelText('Mensagem'), 'Olá, segue a proposta.');
  await userEvent.click(screen.getByRole('button', { name: 'Enviar email' }));
};

const respond = (status: number, body: Record<string, unknown>) =>
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })));

describe('ExternalEmailComposer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('mostra o estado aceite com a referência devolvida', async () => {
    respond(202, { state: 'accepted', reference: 'del-123' });
    render(<ExternalEmailComposer senderEmail="ana@guigui.com" />);
    await fillAndSend();

    expect(await screen.findByText('Email aceite pelo servidor de email')).toBeTruthy();
    expect(screen.getByText(/del-123/)).toBeTruthy();
    expect(vi.mocked(fetch)).toHaveBeenCalledWith('/api/emails/external', expect.objectContaining({ method: 'POST' }));
  });

  it('mostra falha quando o fornecedor rejeita a mensagem', async () => {
    respond(502, { error: 'O fornecedor de email não aceitou a mensagem.', code: 'EXTERNAL_EMAIL_FAILED' });
    render(<ExternalEmailComposer senderEmail="ana@guigui.com" />);
    await fillAndSend();

    expect(await screen.findByText('Falha no envio')).toBeTruthy();
    expect(screen.getByText('O fornecedor de email não aceitou a mensagem.')).toBeTruthy();
  });

  it('mostra o limite atingido sem perder o rascunho', async () => {
    respond(429, { error: 'Limite de emails externos atingido. Tente novamente mais tarde.' });
    render(<ExternalEmailComposer senderEmail="ana@guigui.com" />);
    await fillAndSend();

    expect(await screen.findByText('Limite de envio atingido')).toBeTruthy();
    expect(screen.getByLabelText('Para')).toHaveProperty('value', 'parceiro@fora.example');
  });

  it('mostra o serviço não configurado e explica o que falta', async () => {
    respond(503, { error: 'O envio de email não está configurado.', code: 'EMAIL_NOT_CONFIGURED' });
    render(<ExternalEmailComposer senderEmail="ana@guigui.com" />);
    await fillAndSend();

    expect(await screen.findByText('Serviço de email não configurado')).toBeTruthy();
    expect(screen.getByText(/BREVO_API_KEY/)).toBeTruthy();
  });

  it('avisa que o destinatário já tem conta na plataforma', async () => {
    respond(409, { error: 'Este destinatário tem conta no Guigui.com.', code: 'RECIPIENT_IS_PLATFORM_MEMBER' });
    render(<ExternalEmailComposer senderEmail="ana@guigui.com" />);
    await fillAndSend();

    expect(await screen.findByText('Destinatário dentro da plataforma')).toBeTruthy();
  });
});
