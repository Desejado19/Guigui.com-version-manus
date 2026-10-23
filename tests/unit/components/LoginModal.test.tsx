// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginModal } from '../../../src/components/LoginModal';

function enterBusinessRegistration() {
  fireEvent.click(screen.getByText('Criar Nova Conta'));
  fireEvent.click(screen.getByRole('button', { name: /Próximo Passo/ }));
  fireEvent.click(screen.getByRole('button', { name: /Empresa/ }));
}

describe('business registration profile collection', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('does not advance when required business profile fields are missing', () => {
    render(<LoginModal isOpen currentLang="pt" onLogin={vi.fn()} />);
    enterBusinessRegistration();

    fireEvent.change(screen.getByPlaceholderText('ex: Restaurante Coqueiros'), { target: { value: 'Atelier Nô Pintcha' } });
    fireEvent.change(screen.getByPlaceholderText('ex: contacto@exemplo.com'), { target: { value: 'owner@atelier.test' } });
    fireEvent.change(screen.getByPlaceholderText('⬢⬢⬢⬢⬢⬢⬢⬢'), { target: { value: 'CorrectHorse42' } });
    fireEvent.click(screen.getByRole('button', { name: /Próximo Passo \(Escalão\)/ }));

    expect(screen.getByText(/Empresa \(Passo 1\/3\)/)).toBeTruthy();
  });

  it('submits the selected profile data separately from the payment phone', async () => {
    const onLogin = vi.fn();
    const fetchMock = vi.fn((input: RequestInfo | URL, _init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/payments/create') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ transaction: { id: 'payment-1', providerRef: 'provider-1' } }),
        });
      }
      if (url === '/api/auth/register') {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            user: { id: 'owner-1', role: 'business', businessId: 'business-1' },
            business: {
              id: 'business-1',
              name: 'Atelier Nô Pintcha',
              categoryId: 'restauracao',
              groupGroupId: 'restauracao',
              subcategoryId: 'Costura',
              description: 'Costura e reparação de roupas.',
              phone: '+245 955 123 456',
              neighborhood: 'Bandim',
              publicEmail: 'contacto@atelier.test',
              status: 'pending',
            },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({ key: '', value: null }) });
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<LoginModal isOpen currentLang="pt" onLogin={onLogin} />);
    enterBusinessRegistration();

    fireEvent.change(screen.getByPlaceholderText('ex: Restaurante Coqueiros'), { target: { value: 'Atelier Nô Pintcha' } });
    fireEvent.change(screen.getByPlaceholderText('ex: contacto@exemplo.com'), { target: { value: 'owner@atelier.test' } });
    fireEvent.change(screen.getByLabelText('Contacto Telefónico da Conta / Pagamento'), { target: { value: '+245 966 000 000' } });
    fireEvent.change(screen.getByLabelText('Subcategoria da Empresa *'), { target: { value: 'Costura' } });
    fireEvent.change(screen.getByLabelText('Descrição da Empresa *'), { target: { value: 'Costura e reparação de roupas.' } });
    fireEvent.change(screen.getByLabelText('Telefone Público da Empresa *'), { target: { value: '+245 955 123 456' } });
    fireEvent.change(screen.getByLabelText('Bairro da Empresa *'), { target: { value: 'Bandim' } });
    fireEvent.change(screen.getByLabelText('E-mail Público'), { target: { value: 'contacto@atelier.test' } });
    fireEvent.change(screen.getByPlaceholderText('⬢⬢⬢⬢⬢⬢⬢⬢'), { target: { value: 'CorrectHorse42' } });
    fireEvent.click(screen.getByRole('button', { name: /Próximo Passo \(Escalão\)/ }));
    fireEvent.click(screen.getByRole('button', { name: /Próximo Passo \(Pagamento:/ }));
    fireEvent.change(screen.getByLabelText(/Número para Débito/), { target: { value: '+245 977 000 000' } });
    fireEvent.click(screen.getByRole('button', { name: /Pagar .* XOF/ }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([url]) => url === '/api/payments/create')).toBe(true));
    fireEvent.click(screen.getByRole('button', { name: /Concluir e Entrar no Painel da Empresa/ }));

    await waitFor(() => expect(onLogin).toHaveBeenCalledOnce());
    const registrationCall = fetchMock.mock.calls.find(([url]) => url === '/api/auth/register');
    if (!registrationCall) throw new Error('Business registration request was not sent.');
    const registrationRequestBody = registrationCall[1]?.body;
    if (typeof registrationRequestBody !== 'string') throw new Error('Business registration request body is missing.');
    const registrationBody = JSON.parse(registrationRequestBody);
    expect(registrationBody).toMatchObject({
      name: 'Atelier Nô Pintcha',
      phone: '+245 966 000 000',
      businessName: 'Atelier Nô Pintcha',
      categoryId: 'restauracao',
      subcategoryId: 'Costura',
      description: 'Costura e reparação de roupas.',
      businessPhone: '+245 955 123 456',
      businessNeighborhood: 'Bandim',
      publicEmail: 'contacto@atelier.test',
    });
    expect(registrationBody.businessPhone).not.toBe('+245 977 000 000');
    expect(onLogin).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'owner-1', role: 'business' }),
      expect.objectContaining({ id: 'business-1', publicEmail: 'contacto@atelier.test' }),
    );
  });
});
