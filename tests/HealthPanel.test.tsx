import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from 'home-ia-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HealthPanel from '../src/features/settings/HealthPanel';

const report = {
  schemaVersion: '1.0',
  residenceId: 'home',
  generatedAtUtc: '2026-11-03T12:00:00Z',
  portalStatus: 'healthy',
  status: 'degraded',
  modules: [
    {
      moduleId: 'monitoring',
      kind: 'module',
      status: 'healthy',
      enabled: true,
      contractVersion: '1.0',
      latencyMs: 12,
      checkedAtUtc: '2026-11-03T12:00:00Z',
      errorCode: null,
      capabilities: ['camera.status', 'health'],
    },
    {
      moduleId: 'activitywatch',
      kind: 'integration',
      status: 'unavailable',
      enabled: true,
      contractVersion: '1.0',
      latencyMs: 3001,
      checkedAtUtc: '2026-11-03T12:00:00Z',
      errorCode: 'activitywatch_unreachable',
      capabilities: [],
    },
    {
      moduleId: 'external-lab',
      kind: 'module',
      status: 'unknown',
      enabled: true,
      contractVersion: '1.0',
      latencyMs: 0,
      checkedAtUtc: '2026-11-03T12:00:00Z',
      errorCode: 'health_probe_not_configured',
      capabilities: [],
    },
  ],
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

function renderPanel() {
  return render(
    <I18nProvider>
      <HealthPanel />
    </I18nProvider>,
  );
}

describe('HealthPanel', () => {
  it('does not probe until requested and then lists portal, modules and integrations', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(report));
    renderPanel();

    expect(screen.getByRole('status')).toHaveTextContent('A saúde ainda não foi verificada.');
    expect(fetchMock).not.toHaveBeenCalled();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Verificar saúde' }));

    expect(await screen.findByText(/Estado agregado: Degradado/)).toBeInTheDocument();
    expect(screen.getByText(/Portal: Saudável/)).toBeInTheDocument();
    expect(screen.getAllByText('Módulo').length).toBeGreaterThan(0);
    expect(screen.getByText('Integração')).toBeInTheDocument();
    expect(screen.getByText('Indisponível')).toBeInTheDocument();
    expect(screen.getByText('Desconhecido')).toBeInTheDocument();
    expect(screen.getByText('activitywatch_unreachable')).toBeInTheDocument();
    expect(screen.getByText('health_probe_not_configured')).toBeInTheDocument();
    expect(screen.getByText('12 ms')).toBeInTheDocument();
    expect(screen.getByText('camera.status, health')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('http');
    expect(document.body.textContent).not.toContain('Bearer');
    expect(document.body.textContent).not.toContain('activitywatch-token');
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/portal/health', expect.anything());
  });

  it('shows the forbidden message when the session cannot read health', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ error: 'forbidden' }, 403));
    renderPanel();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Verificar saúde' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Somente um administrador ativo pode ler a saúde dos módulos.',
    );
    expect(screen.queryByText('A saúde ainda não foi verificada.')).not.toBeInTheDocument();
  });

  it('shows a retryable error when a later check fails', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(json(report))
      .mockResolvedValueOnce(json({ error: 'unavailable' }, 503));
    renderPanel();

    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Verificar saúde' }));
    expect(await screen.findByText(/Estado agregado: Degradado/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Verificar saúde' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível ler o relatório de saúde.');
    expect(screen.queryByText('Estado agregado: Degradado')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
