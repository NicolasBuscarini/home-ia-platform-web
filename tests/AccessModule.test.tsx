import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from 'home-ia-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AccessModule from '../src/AccessModule';

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

describe('AccessModule', () => {
  it('switches from access requests to the filtered user account', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input);
      const method = init?.method ?? 'GET';
      if (method === 'GET' && path.startsWith('/api/v1/admin/users?')) {
        return json({ items: [], page: 1, pageSize: 25, totalCount: 0 });
      }
      if (method === 'GET' && path.startsWith('/api/v1/admin/cameras?')) {
        return json({ items: [], page: 1, pageSize: 100, totalCount: 0 });
      }
      if (method === 'GET' && path === '/api/v1/admin/access-rules') {
        return json([]);
      }
      if (method === 'GET' && path.startsWith('/api/v1/admin/access-requests?')) {
        return json({
          items: [
            {
              publicId: 'ARQ000000000001',
              userPublicId: 'USR000000000001',
              username: 'local-user',
              purpose: 'live_monitoring',
              status: 'pending',
              createdAtUtc: '2026-10-30T00:00:00Z',
            },
          ],
          page: 1,
          pageSize: 25,
          totalCount: 1,
        });
      }
      throw new Error(`Unexpected request: ${method} ${path}`);
    });

    render(
      <I18nProvider>
        <AccessModule userRole="Administrator" />
      </I18nProvider>,
    );

    await userEvent.setup().click(screen.getByRole('tab', { name: 'Pedidos de acesso' }));
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Gerenciar usuário' }));

    expect(await screen.findByText('Exibindo uma única conta filtrada')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/admin/users?page=1&pageSize=25&userId=USR000000000001',
      expect.anything(),
    );
  });

  it('denies access management to non-administrators', () => {
    render(
      <I18nProvider>
        <AccessModule userRole="Viewer" />
      </I18nProvider>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('permissão');
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });
});
