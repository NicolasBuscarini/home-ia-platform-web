import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from 'home-ia-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SystemsModule from '../src/SystemsModule';

const moduleItem = {
  moduleId: 'monitoring',
  displayNameKey: 'portal.modules.monitoring.name',
  contractVersion: '1.0',
  apiBaseUrl: 'http://127.0.0.1:8081',
  healthPath: '/api/v1/portal/modules/monitoring/health',
  requiredPermission: 'monitoring.read',
  menuGroup: 'monitoring',
  menuOrder: 10,
  menuIcon: 'camera-video',
  menuLabelKey: 'portal.modules.monitoring.menu',
  isEnabled: true,
  version: 1,
  createdAtUtc: '2026-10-01T00:00:00Z',
  updatedAtUtc: '2026-10-01T00:00:00Z',
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

describe('SystemsModule', () => {
  it('lists registered modules and disables one with its current version', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input);
      const method = init?.method ?? 'GET';
      if (method === 'GET' && path === '/api/v1/admin/portal-modules?page=1&pageSize=100') {
        return json({ items: [moduleItem], page: 1, pageSize: 100, totalCount: 1 });
      }
      if (method === 'PUT' && path === '/api/v1/admin/portal-modules/monitoring') {
        return json({ ...moduleItem, isEnabled: false, version: 2, updatedAtUtc: '2026-10-02T00:00:00Z' });
      }
      throw new Error(`Unexpected request: ${method} ${path}`);
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <I18nProvider>
        <SystemsModule userRole="Administrator" />
      </I18nProvider>,
    );

    expect(await screen.findByText('monitoring')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Desabilitar' }));

    expect(await screen.findByText('Módulo “monitoring” atualizado.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Habilitar' })).toBeInTheDocument();
    const put = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT');
    expect(put).toBeTruthy();
    if (!put) throw new Error('PUT request was not captured.');
    const body = JSON.parse(String((put[1] as RequestInit).body)) as {
      isEnabled: boolean;
      version: number;
    };
    expect(body).toMatchObject({ isEnabled: false, version: 1 });
  });

  it('does not expose the catalog to non-administrators', () => {
    render(
      <I18nProvider>
        <SystemsModule userRole="Viewer" />
      </I18nProvider>,
    );

    expect(screen.getByRole('status')).toHaveTextContent('permissão');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
