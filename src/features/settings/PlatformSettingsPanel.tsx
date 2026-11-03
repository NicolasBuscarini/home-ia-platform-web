import { ApiError, getJson, request, type TranslationKey, useI18n } from 'home-ia-shared';
import { useState } from 'react';

interface PlatformSettingsValues {
  eventJournalMaxEvents: number;
  eventJournalMaxBytes: number;
  clipAnalysisQueueCapacity: number;
  clipAnalysisLeaseSeconds: number;
  clipArchivePollSeconds: number;
  clipArchiveMaxClips: number;
  clipArchiveMaxBytes: number;
  clipArchiveMaxClipBytes: number;
  clipPlaybackCacheBytes: number;
}

interface PlatformSettingsDocument {
  version: number;
  updatedAtUtc: string;
  values: PlatformSettingsValues;
}

const fields: Array<{ key: keyof PlatformSettingsValues; label: TranslationKey }> = [
  { key: 'eventJournalMaxEvents', label: 'platform.settings.eventJournalMaxEvents' },
  { key: 'eventJournalMaxBytes', label: 'platform.settings.eventJournalMaxBytes' },
  { key: 'clipAnalysisQueueCapacity', label: 'platform.settings.clipAnalysisQueueCapacity' },
  { key: 'clipAnalysisLeaseSeconds', label: 'platform.settings.clipAnalysisLeaseSeconds' },
  { key: 'clipArchivePollSeconds', label: 'platform.settings.clipArchivePollSeconds' },
  { key: 'clipArchiveMaxClips', label: 'platform.settings.clipArchiveMaxClips' },
  { key: 'clipArchiveMaxBytes', label: 'platform.settings.clipArchiveMaxBytes' },
  { key: 'clipArchiveMaxClipBytes', label: 'platform.settings.clipArchiveMaxClipBytes' },
  { key: 'clipPlaybackCacheBytes', label: 'platform.settings.clipPlaybackCacheBytes' },
];

export default function PlatformSettingsPanel() {
  const { t, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [document, setDocument] = useState<PlatformSettingsDocument>();
  const [draft, setDraft] = useState<PlatformSettingsValues>();

  async function load() {
    setOpen(true);
    if (document) return;
    setLoading(true);
    setError('');
    try {
      const result = await getJson<PlatformSettingsDocument>('/api/v1/admin/platform-settings');
      setDocument(result);
      setDraft(result.values);
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.status === 403
          ? t('platform.settings.error.forbidden')
          : t('platform.settings.error.load'),
      );
    } finally {
      setLoading(false);
    }
  }

  async function save() {
    if (!document || !draft) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await request('/api/v1/admin/platform-settings', {
        method: 'PUT',
        body: JSON.stringify({ expectedVersion: document.version, values: draft }),
      });
      if (response.status === 409) {
        setError(t('platform.settings.error.conflict'));
        return;
      }
      if (!response.ok) {
        setError(t('platform.settings.error.save'));
        return;
      }
      const updated = (await response.json()) as PlatformSettingsDocument;
      setDocument(updated);
      setDraft(updated.values);
      setNotice(t('platform.settings.notice.saved'));
    } catch {
      setError(t('platform.settings.error.save'));
    } finally {
      setSaving(false);
    }
  }

  function updateField(key: keyof PlatformSettingsValues, value: string) {
    const parsed = Number(value);
    setDraft((current) => (current ? { ...current, [key]: parsed } : current));
  }

  return (
    <section className="panel-card" aria-labelledby="platform-settings-title">
      <div className="clips-header">
        <div>
          <span className="eyebrow">{t('platform.settings.eyebrow')}</span>
          <h3 id="platform-settings-title" className="h5 mt-2">
            {t('platform.settings.title')}
          </h3>
          <p className="small text-secondary mb-0">{t('platform.settings.description')}</p>
        </div>
        <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => void load()}>
          {open ? t('platform.settings.close') : t('platform.settings.open')}
        </button>
      </div>
      {open && (
        <div className="mt-3">
          <p className="small text-secondary">{t('platform.settings.restartNotice')}</p>
          {loading && (
            <p role="status" aria-live="polite">
              {t('platform.settings.loading')}
            </p>
          )}
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          {notice && (
            <p className="text-success" role="status" aria-live="polite">
              {notice}
            </p>
          )}
          {document && draft && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <div className="row g-3">
                {fields.map((field) => (
                  <div className="col-12 col-md-6 col-xl-4" key={field.key}>
                    <label className="form-label" htmlFor={`platform-settings-${field.key}`}>
                      {t(field.label)}
                    </label>
                    <input
                      className="form-control"
                      id={`platform-settings-${field.key}`}
                      type="number"
                      min={0}
                      value={draft[field.key]}
                      onChange={(event) => updateField(field.key, event.target.value)}
                    />
                  </div>
                ))}
              </div>
              <div className="d-flex flex-wrap align-items-center gap-3 mt-3">
                <button className="btn btn-primary" type="submit" disabled={saving}>
                  {saving ? t('platform.settings.saving') : t('platform.settings.save')}
                </button>
                <span className="small text-secondary">
                  {t('platform.settings.version', { version: document.version })} ·{' '}
                  {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
                    new Date(document.updatedAtUtc),
                  )}
                </span>
              </div>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
