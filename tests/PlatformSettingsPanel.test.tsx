import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nProvider } from 'home-ia-shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import PlatformSettingsPanel from '../src/features/settings/PlatformSettingsPanel';

const values = {
  eventJournalMaxEvents: 10000,
  eventJournalMaxBytes: 67108864,
  clipAnalysisQueueCapacity: 8,
  clipAnalysisLeaseSeconds: 60,
  clipArchivePollSeconds: 2,
  clipArchiveMaxClips: 10000,
  clipArchiveMaxBytes: 53687091200,
  clipArchiveMaxClipBytes: 1073741824,
  clipPlaybackCacheBytes: 2147483648,
};

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PlatformSettingsPanel', () => {
  it('loads the current settings and saves them with the current version', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const path = String(input);
      const method = init?.method ?? 'GET';
      if (path === '/api/v1/admin/platform-settings' && method === 'GET') {
        return json({ version: 1, updatedAtUtc: '2026-11-02T12:00:00Z', values });
      }
      if (path === '/api/v1/admin/platform-settings' && method === 'PUT') {
        return json({ version: 2, updatedAtUtc: '2026-11-02T12:05:00Z', values });
      }
      throw new Error(`Unexpected request: ${method} ${path}`);
    });

    render(
      <I18nProvider>
        <PlatformSettingsPanel />
      </I18nProvider>,
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole('button'));
    const inputs = await screen.findAllByRole('spinbutton');
    expect(inputs).toHaveLength(9);

    await user.clear(inputs[0] as HTMLElement);
    await user.type(inputs[0] as HTMLElement, '12000');
    await user.click(screen.getByRole('button', { name: /Salvar|Save/ }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/v1/admin/platform-settings',
        expect.objectContaining({ method: 'PUT' }),
      ),
    );
    const put = fetchMock.mock.calls.find(([, init]) => (init as RequestInit | undefined)?.method === 'PUT');
    if (!put) throw new Error('PUT request was not captured.');
    const body = JSON.parse(String((put[1] as RequestInit).body)) as {
      expectedVersion: number;
      values: { eventJournalMaxEvents: number };
    };
    expect(body.expectedVersion).toBe(1);
    expect(body.values.eventJournalMaxEvents).toBe(12000);
  });
});
