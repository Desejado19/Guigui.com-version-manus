// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ErrorBoundary } from '../../../src/components/ErrorBoundary';

const Boom: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) throw new TypeError('falha simulada do painel');
  return <p>painel normal</p>;
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ErrorBoundary', () => {
  it('deixa o conteúdo passar quando não há erro', () => {
    render(
      <ErrorBoundary currentLang="pt">
        <Boom shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByText('painel normal')).toBeTruthy();
  });

  it('mostra a tela de erro em vez de deixar o ecrã em branco', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary currentLang="pt">
        <Boom shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Algo correu mal')).toBeTruthy();
    // O código do erro é mostrado para o utilizador reportar ao suporte.
    expect(screen.getByText(/TypeError/)).toBeTruthy();
  });

  it('nomeia a área que falhou', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary currentLang="pt" area="Área do Cidadão">
        <Boom shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText(/Área do Cidadão/)).toBeTruthy();
  });

  it('oferece tentar novamente sem sair da plataforma', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary currentLang="pt">
        <Boom shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('button', { name: /Tentar novamente/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Voltar ao Início|Voltar/i })).toBeTruthy();
  });

  it('traduz a tela de erro para inglês', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary currentLang="en">
        <Boom shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('recupera o painel quando o utilizador carrega em tentar novamente', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let aindaQuebrado = true;
    const Intermitente: React.FC = () => {
      if (aindaQuebrado) throw new Error('primeira falha');
      return <p>painel recuperou</p>;
    };
    render(
      <ErrorBoundary currentLang="pt">
        <Intermitente />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Algo correu mal')).toBeTruthy();
    aindaQuebrado = false;
    await userEvent.click(screen.getByRole('button', { name: /Tentar novamente/i }));
    expect(screen.getByText('painel recuperou')).toBeTruthy();
  });
});
