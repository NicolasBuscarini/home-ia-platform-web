import { cleanup, render, screen } from '@testing-library/react';
import { I18nProvider } from 'home-ia-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BackupSummaryPanel from '../src/features/settings/BackupSummaryPanel';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const summary = {
  lastSuccessAtUtc: '2026-11-12T12:00:00Z',
  lastSuccessFileName: 'portal-20261112T120000Z.db',
  lastSuccessSizeBytes: 4096,
  lastSuccessSha256: 'a'.repeat(64),
  artifactCount: 1,
  totalSizeBytes: 8192,
  scheduleEnabled: true,
  scheduleIntervalHours: 24,
  scheduleRetentionCount: 14,
  lastFailureAtUtc: null,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderPanel() {
  return render(
    <I18nProvider>
      <BackupSummaryPanel />
    </I18nProvider>,
  );
}

describe('BackupSummaryPanel', () => {
  it('loads on mount and shows the last backup, size, count and schedule', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json(summary));
    renderPanel();

    expect(await screen.findByText('Último backup')).toBeInTheDocument();
    expect(screen.getByText('portal-20261112T120000Z.db')).toBeInTheDocument();
    expect(screen.getByText('4.0 KiB')).toBeInTheDocument();
    expect(screen.getByText('8.0 KiB')).toBeInTheDocument();
    expect(screen.getByText('Ativado · a cada 24 h · manter 14')).toBeInTheDocument();
    expect(screen.getByText('Nunca')).toBeInTheDocument();
    // Secrets and payloads must never leak into the rendered summary.
    expect(document.body.textContent).not.toContain('a'.repeat(64));
  });

  it('shows the empty state when no backup has been created yet', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json({ ...summary, artifactCount: 0, totalSizeBytes: 0 }),
    );
    renderPanel();

    expect(await screen.findByText('Nenhum backup foi criado ainda.')).toBeInTheDocument();
  });

  it('shows the forbidden message when the session cannot read backup status', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ error: 'forbidden' }, 403));
    renderPanel();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Somente um administrador ativo pode ler o status do backup.',
    );
  });
});
