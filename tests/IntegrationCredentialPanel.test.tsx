import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from 'home-ia-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import IntegrationCredentialPanel from '../src/features/settings/IntegrationCredentialPanel';

const path = '/api/v1/admin/integrations/activitywatch/credential';
const secret = 'activitywatch-token-123';

interface Status {
  integrationId: string;
  configured: boolean;
  source: 'database' | 'environment' | 'none';
  keyVersion: string | null;
  updatedAtUtc: string | null;
  version: number;
}

const stored: Status = {
  integrationId: 'activitywatch',
  configured: true,
  source: 'database',
  keyVersion: 'v1',
  updatedAtUtc: '2026-11-03T12:00:00Z',
  version: 2,
};

const unconfigured: Status = {
  integrationId: 'activitywatch',
  configured: false,
  source: 'environment',
  keyVersion: null,
  updatedAtUtc: null,
  version: 0,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('IntegrationCredentialPanel', () => {
  it('stores a new secret without rendering it and switches the source to the portal store', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const requestPath = String(input);
      const method = init?.method ?? 'GET';
      if (method === 'GET' && requestPath === path) return json(unconfigured);
      if (method === 'PUT' && requestPath === path) return json(stored);
      throw new Error(`Unexpected request: ${method} ${requestPath}`);
    });

    render(
      <I18nProvider>
        <IntegrationCredentialPanel />
      </I18nProvider>,
    );

    expect(await screen.findByText('Variável de ambiente')).toBeInTheDocument();
    const user = userEvent.setup();
    const input = screen.getByLabelText('Token da API');
    await user.type(input, secret);
    await user.click(screen.getByRole('button', { name: 'Armazenar credencial' }));

    expect(await screen.findByText(/Credencial armazenada/)).toBeInTheDocument();
    expect(screen.getByText('Loja do portal')).toBeInTheDocument();
    expect(screen.getByText('v1')).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe('');
    expect(document.body.textContent).not.toContain(secret);

    const put = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT');
    expect(put).toBeTruthy();
    if (!put) throw new Error('PUT request was not captured.');
    expect(JSON.parse(String((put[1] as RequestInit).body))).toEqual({ secret });
  });

  it('removes the stored credential and returns to the environment source', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const requestPath = String(input);
      const method = init?.method ?? 'GET';
      if (method === 'GET' && requestPath === path) return json(stored);
      if (method === 'DELETE' && requestPath === path) return json(unconfigured);
      throw new Error(`Unexpected request: ${method} ${requestPath}`);
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <I18nProvider>
        <IntegrationCredentialPanel />
      </I18nProvider>,
    );

    expect(await screen.findByText('Loja do portal')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Remover credencial' }));

    expect(await screen.findByText(/Credencial armazenada removida/)).toBeInTheDocument();
    expect(screen.getByText('Variável de ambiente')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remover credencial' })).toBeDisabled();
  });

  it('reports an unavailable encryption key instead of pretending the secret was stored', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const requestPath = String(input);
      const method = init?.method ?? 'GET';
      if (method === 'GET' && requestPath === path) return json(unconfigured);
      if (method === 'PUT' && requestPath === path) return json({ code: 'x' }, 503);
      throw new Error(`Unexpected request: ${method} ${requestPath}`);
    });

    render(
      <I18nProvider>
        <IntegrationCredentialPanel />
      </I18nProvider>,
    );

    await screen.findByText('Variável de ambiente');
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Token da API'), secret);
    await user.click(screen.getByRole('button', { name: 'Armazenar credencial' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'A criptografia de credenciais não está configurada no servidor.',
      ),
    );
    expect(screen.queryByText(/Credencial armazenada\./)).not.toBeInTheDocument();
  });
});
