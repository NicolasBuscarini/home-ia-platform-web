import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from 'home-ia-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AuditModule from '../src/AuditModule';

const firstItem = {
  publicId: 'EVT000000000001',
  occurredAtUtc: '2026-11-04T18:22:10Z',
  eventType: 'camera.connection.address.updated',
  category: 'configuration',
  severity: 'info',
  outcome: 'success',
  source: 'portal',
  actorPublicId: 'USR000000000042',
  actorUsername: 'admin',
  resourceType: 'camera',
  resourceId: 'CAM000000000001',
  correlationId: 'c7f4b4a1-2f6e-4b0e-9a1d-5b8e2f0c3d11',
};

const secondItem = {
  ...firstItem,
  publicId: 'EVT000000000002',
  eventType: 'event_store.queried',
  category: 'administration',
  resourceType: null,
  resourceId: null,
};

const detail = {
  record: {
    publicId: firstItem.publicId,
    recordedAtUtc: '2026-11-04T18:22:10Z',
    payloadHash: 'a'.repeat(64),
    event: {
      schemaVersion: '1.0',
      eventId: '7a5e2d1c-3b4f-4a6e-8c9d-0e1f2a3b4c5d',
      eventType: firstItem.eventType,
      category: firstItem.category,
      severity: firstItem.severity,
      outcome: firstItem.outcome,
      occurredAtUtc: firstItem.occurredAtUtc,
      source: firstItem.source,
      sourceVersion: null,
      emitter: 'server',
      actor: { userPublicId: firstItem.actorPublicId, username: 'admin', displayName: null },
      subject: null,
      resource: { type: 'camera', publicId: firstItem.resourceId },
      correlationId: firstItem.correlationId,
      causationId: null,
      requestId: '0HN7G5A2B3C4D:00000001',
      sessionId: null,
      traceId: null,
      spanId: null,
      http: null,
      client: null,
      metadata: { policyVersion: 3 },
    },
  },
  actorPublicId: firstItem.actorPublicId,
  actorUsername: 'admin',
  subjectPublicId: null,
  integrityValid: true,
  metadata: { policyVersion: 3 },
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

function renderModule(userRole = 'Administrator') {
  render(
    <I18nProvider initialLocale="pt-BR">
      <AuditModule userRole={userRole} portalModuleIds={['administration']} />
    </I18nProvider>,
  );
}

describe('AuditModule', () => {
  it('filters events and appends the next page through the cursor', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (!url.startsWith('/api/v1/admin/events?')) throw new Error(`Unexpected request: ${url}`);
      if (url.includes('cursor=')) {
        return json({ items: [secondItem], nextCursor: null });
      }
      return json({ items: [firstItem], nextCursor: 'cursor-1' });
    });
    const user = userEvent.setup();
    renderModule();

    expect(await screen.findByText('camera.connection.address.updated')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/v1/admin/events?pageSize=50');

    await user.type(screen.getByLabelText('Tipo de evento'), 'camera.connection.address.updated');
    await user.selectOptions(screen.getByLabelText('Resultado'), 'success');
    await user.type(screen.getByLabelText('Excluir usuários'), 'root, audit');
    await user.click(screen.getByRole('button', { name: 'Aplicar filtros' }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(
        '/api/v1/admin/events?eventType=camera.connection.address.updated&outcome=success&excludeActor=root&excludeActor=audit&pageSize=50',
      ),
    );

    await user.click(await screen.findByRole('button', { name: 'Carregar mais' }));

    expect(await screen.findByText('event_store.queried')).toBeInTheDocument();
    expect(fetchMock.mock.calls.at(-1)?.[0]).toBe(
      '/api/v1/admin/events?eventType=camera.connection.address.updated&outcome=success&excludeActor=root&excludeActor=audit&pageSize=50&cursor=cursor-1',
    );
    expect(screen.queryByRole('button', { name: 'Carregar mais' })).not.toBeInTheDocument();
  });

  it('opens the accessible detail, shows integrity and restores focus on close', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url === '/api/v1/admin/events?pageSize=50') {
        return json({ items: [firstItem], nextCursor: null });
      }
      if (url === `/api/v1/admin/events/${firstItem.publicId}`) return json(detail);
      throw new Error(`Unexpected request: ${url}`);
    });
    const user = userEvent.setup();
    renderModule();

    const trigger = await screen.findByRole('button', {
      name: `Detalhes do evento ${firstItem.publicId}`,
    });
    await user.click(trigger);

    expect(await screen.findByText(/Hash confere/)).toBeInTheDocument();
    expect(screen.getAllByText('admin').length).toBeGreaterThan(0);
    expect(screen.getByText(/policyVersion/)).toBeInTheDocument();
    expect(screen.getByText('0HN7G5A2B3C4D:00000001')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Fechar detalhe' }));

    expect(screen.queryByText('Detalhe do evento')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('denies the audit to a non-administrator without requesting data', () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    renderModule('Viewer');

    expect(
      screen.getByText('Você não tem permissão para consultar a auditoria da plataforma.'),
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
