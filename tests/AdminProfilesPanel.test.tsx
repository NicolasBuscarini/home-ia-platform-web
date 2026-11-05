import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from 'home-ia-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminProfilesPanel } from '../src/features/access/AdminProfilesPanel';

const permission = {
  key: 'live.video.view',
  description: 'View live video',
  module: 'monitoring',
  category: 'read',
  risk: 0,
  allowedScopeKinds: [0, 1, 2, 3],
  ownerOnly: false,
  isAvailable: true,
  unavailableReason: null,
  isDelegable: true,
};
const restrictedPermissions = [
  {
    key: 'system.owner',
    description: 'Portal ownership and owner management',
    module: 'system',
    category: 'owner',
    risk: 3,
    allowedScopeKinds: [0],
    ownerOnly: true,
    isAvailable: true,
    unavailableReason: null,
    isDelegable: false,
  },
  {
    key: 'live.audio.listen',
    description: 'Listen to live audio',
    module: 'monitoring',
    category: 'read',
    risk: 1,
    allowedScopeKinds: [0, 1, 2, 3],
    ownerOnly: false,
    isAvailable: false,
    unavailableReason: 'Aguardando rendição somente vídeo no servidor.',
    isDelegable: false,
  },
];

function response(body: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('administrative permission profile management', () => {
  it('creates a reusable profile from the permission catalog and keeps this screen separate from users', async () => {
    let profiles: Array<Record<string, unknown>> = [];
    const requests: Array<{ path: string; method: string; body?: string }> = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input);
      const method = init?.method ?? 'GET';
      const body = init?.body ? String(init.body) : undefined;
      requests.push({ path, method, body });
      if (path === '/api/v1/admin/access-rules' && method === 'GET') return response(profiles);
      if (path === '/api/v1/admin/permission-catalog')
        return response([permission, ...restrictedPermissions]);
      if (path === '/api/v1/admin/access-rules' && method === 'POST') {
        profiles = [
          {
            publicId: 'PRF000000000001',
            currentVersionPublicId: 'PVN000000000001',
            name: 'Garage operator',
            isActive: true,
            version: 1,
            updatedAtUtc: '2026-10-30T00:00:00Z',
            permissionKeys: ['live.video.view'],
          },
        ];
        return response(profiles[0], 201);
      }
      throw new Error(`Unexpected request: ${method} ${path}`);
    });

    const user = userEvent.setup();
    render(
      <I18nProvider>
        <AdminProfilesPanel />
      </I18nProvider>,
    );
    expect(await screen.findByRole('heading', { name: 'Perfis e permissões' })).toBeInTheDocument();
    const monitoringGroup = screen.getByRole('group', { name: 'Monitoramento' });
    expect(within(monitoringGroup).getByText('Ver vídeo ao vivo')).toBeInTheDocument();
    expect(within(monitoringGroup).getByText('Risco baixo')).toBeInTheDocument();
    expect(within(monitoringGroup).getByText('Escopos permitidos')).toBeInTheDocument();
    for (const scope of ['Global', 'Módulo', 'Contexto', 'Câmera']) {
      expect(within(monitoringGroup).getByText(scope)).toBeInTheDocument();
    }
    expect(
      screen.getByRole('heading', { name: 'Permissões reservadas ou indisponíveis' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Exclusivo do owner')).toBeInTheDocument();
    expect(screen.getByText('Indisponível')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /system\.owner/ })).not.toBeInTheDocument();
    await user.type(screen.getByLabelText('Nome do perfil'), 'Garage operator');
    await user.click(screen.getByRole('checkbox', { name: /live\.video\.view/ }));
    await user.click(screen.getByRole('button', { name: 'Criar perfil' }));

    expect(await screen.findByRole('heading', { name: 'Garage operator · v1' })).toBeInTheDocument();
    expect(screen.getAllByText('Ver vídeo ao vivo').length).toBeGreaterThan(0);
    expect(
      await screen.findByText('Perfil salvo. As atribuições existentes dos usuários não foram alteradas.'),
    ).toBeInTheDocument();
    expect(requests).toContainEqual({
      path: '/api/v1/admin/access-rules',
      method: 'POST',
      body: JSON.stringify({ name: 'Garage operator', permissionKeys: ['live.video.view'] }),
    });
    expect(requests.some((request) => request.path.includes('/admin/users'))).toBe(false);
  });

  it('publishes a new immutable version without an API call to user assignments', async () => {
    const initial = {
      publicId: 'PRF000000000001',
      currentVersionPublicId: 'PVN000000000001',
      name: 'Garage operator',
      isActive: true,
      version: 1,
      updatedAtUtc: '2026-10-30T00:00:00Z',
      permissionKeys: ['live.video.view'],
    };
    let currentVersion = initial;
    const requests: Array<{ path: string; method: string; body?: string }> = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input);
      const method = init?.method ?? 'GET';
      const body = init?.body ? String(init.body) : undefined;
      requests.push({ path, method, body });
      if (path === '/api/v1/admin/access-rules' && method === 'GET') return response([currentVersion]);
      if (path === '/api/v1/admin/permission-catalog')
        return response([permission, { key: 'events.read', description: 'Read events', isDelegable: true }]);
      if (path === '/api/v1/admin/access-rules/PRF000000000001/versions' && method === 'POST') {
        currentVersion = {
          ...initial,
          currentVersionPublicId: 'PVN000000000002',
          version: 2,
          permissionKeys: ['live.video.view', 'events.read'],
        };
        return response(currentVersion);
      }
      throw new Error(`Unexpected request: ${method} ${path}`);
    });

    const user = userEvent.setup();
    render(
      <I18nProvider>
        <AdminProfilesPanel />
      </I18nProvider>,
    );
    await user.click(await screen.findByRole('button', { name: 'Editar permissões' }));
    await user.click(screen.getByRole('checkbox', { name: /events\.read/ }));
    await user.click(screen.getByRole('button', { name: 'Publicar nova versão' }));

    await waitFor(() =>
      expect(requests).toContainEqual({
        path: '/api/v1/admin/access-rules/PRF000000000001/versions',
        method: 'POST',
        body: JSON.stringify({ expectedVersion: 1, permissionKeys: ['live.video.view', 'events.read'] }),
      }),
    );
    expect(await screen.findByRole('heading', { name: 'Garage operator · v2' })).toBeInTheDocument();
    expect(requests.some((request) => request.path.includes('/admin/users'))).toBe(false);
  });

  it('keeps profile creation available if the permission catalog request fails', async () => {
    const requests: string[] = [];
    let profiles: Array<Record<string, unknown>> = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input);
      requests.push(`${init?.method ?? 'GET'} ${path}`);
      if (path === '/api/v1/admin/access-rules' && init?.method === 'POST') {
        const created = {
          publicId: 'PRF000000000002',
          name: 'Restricted',
          isActive: true,
          version: 1,
          currentVersionPublicId: 'PVN000000000003',
          permissionKeys: [],
          updatedAtUtc: '2026-10-30T00:00:00Z',
        };
        profiles = [created];
        return response(created, 201);
      }
      if (path === '/api/v1/admin/access-rules') return response(profiles);
      if (path === '/api/v1/admin/permission-catalog') return response({ error: 'unavailable' }, 503);
      throw new Error(`Unexpected request: ${path}`);
    });

    const user = userEvent.setup();
    render(
      <I18nProvider>
        <AdminProfilesPanel />
      </I18nProvider>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('o catálogo de permissões está indisponível');
    await user.type(screen.getByLabelText('Nome do perfil'), 'Restricted');
    await user.click(screen.getByRole('button', { name: 'Criar perfil' }));
    expect(requests).toContain('POST /api/v1/admin/access-rules');
    expect(await screen.findByRole('heading', { name: /Restricted.*v1/ })).toBeInTheDocument();
  });
});
