import { ApiError, getJson, request, useI18n } from 'home-ia-shared';
import { useCallback, useEffect, useState } from 'react';

interface IntegrationCredentialStatus {
  integrationId: string;
  configured: boolean;
  source: 'database' | 'environment' | 'none';
  keyVersion: string | null;
  updatedAtUtc: string | null;
  version: number;
}

const integrationId = 'activitywatch';
const statusPath = `/api/v1/admin/integrations/${integrationId}/credential`;

export default function IntegrationCredentialPanel() {
  const { t, locale } = useI18n();
  const [status, setStatus] = useState<IntegrationCredentialStatus>();
  const [loading, setLoading] = useState(true);
  const [secret, setSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setStatus(await getJson<IntegrationCredentialStatus>(statusPath));
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.status === 403
          ? t('platform.integrations.error.forbidden')
          : t('platform.integrations.error.load'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!secret.trim()) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await request(statusPath, {
        method: 'PUT',
        body: JSON.stringify({ secret }),
      });
      if (response.status === 403) {
        setError(t('platform.integrations.error.forbidden'));
        return;
      }
      if (response.status === 503) {
        setError(t('platform.integrations.error.encryption'));
        return;
      }
      if (!response.ok) {
        setError(t('platform.integrations.error.save'));
        return;
      }
      setStatus((await response.json()) as IntegrationCredentialStatus);
      setSecret('');
      setNotice(t('platform.integrations.notice.saved'));
    } catch {
      setError(t('platform.integrations.error.save'));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm(t('platform.integrations.confirmRemove'))) return;
    setRemoving(true);
    setError('');
    setNotice('');
    try {
      const response = await request(statusPath, { method: 'DELETE' });
      if (response.status === 403) {
        setError(t('platform.integrations.error.forbidden'));
        return;
      }
      if (!response.ok) {
        setError(t('platform.integrations.error.remove'));
        return;
      }
      setStatus((await response.json()) as IntegrationCredentialStatus);
      setNotice(t('platform.integrations.notice.removed'));
    } catch {
      setError(t('platform.integrations.error.remove'));
    } finally {
      setRemoving(false);
    }
  }

  const sourceLabel = status
    ? t(
        status.source === 'database'
          ? 'platform.integrations.source.database'
          : status.source === 'environment'
            ? 'platform.integrations.source.environment'
            : 'platform.integrations.source.none',
      )
    : '';

  return (
    <section className="panel-card mt-4" aria-labelledby="platform-integrations-title">
      <span className="eyebrow">{t('platform.integrations.eyebrow')}</span>
      <h3 id="platform-integrations-title" className="h5 mt-2">
        {t('platform.integrations.title')} · ActivityWatch
      </h3>
      <p className="small text-secondary">{t('platform.integrations.description')}</p>

      {loading && !status && (
        <p role="status" aria-live="polite">
          {t('platform.integrations.loading')}
        </p>
      )}

      {error && (
        <div className="error-text" role="alert">
          <p>{error}</p>
          <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => void load()}>
            {t('platform.systems.retry')}
          </button>
        </div>
      )}

      {notice && (
        <p className="text-success" role="status" aria-live="polite">
          {notice}
        </p>
      )}

      {status && (
        <>
          <dl className="row small mb-3">
            <dt className="col-sm-3">{t('platform.integrations.source')}</dt>
            <dd className="col-sm-9">
              <span
                className={`badge ${
                  status.source === 'database'
                    ? 'text-bg-success'
                    : status.source === 'environment'
                      ? 'text-bg-warning'
                      : 'text-bg-secondary'
                }`}
              >
                {sourceLabel}
              </span>
            </dd>
            {status.keyVersion && (
              <>
                <dt className="col-sm-3">{t('platform.integrations.keyVersion')}</dt>
                <dd className="col-sm-9">{status.keyVersion}</dd>
              </>
            )}
            {status.updatedAtUtc && (
              <>
                <dt className="col-sm-3">{t('platform.integrations.updatedAt')}</dt>
                <dd className="col-sm-9">
                  {new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
                    new Date(status.updatedAtUtc),
                  )}
                </dd>
              </>
            )}
          </dl>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <div className="mb-3">
              <label className="form-label" htmlFor="platform-integrations-secret">
                {t('platform.integrations.secretLabel')}
              </label>
              <input
                autoComplete="new-password"
                className="form-control"
                id="platform-integrations-secret"
                type="password"
                value={secret}
                aria-describedby="platform-integrations-hint"
                onChange={(event) => setSecret(event.target.value)}
              />
              <div id="platform-integrations-hint" className="form-text">
                {t('platform.integrations.secretHint')}
              </div>
            </div>
            <div className="d-flex flex-wrap align-items-center gap-3">
              <button className="btn btn-primary" type="submit" disabled={saving || !secret.trim()}>
                {saving ? t('platform.integrations.saving') : t('platform.integrations.save')}
              </button>
              <button
                className="btn btn-outline-danger"
                type="button"
                disabled={removing || status.source !== 'database'}
                onClick={() => void remove()}
              >
                {removing ? t('platform.integrations.removing') : t('platform.integrations.remove')}
              </button>
            </div>
          </form>
          <p className="small text-secondary mt-3 mb-0">{t('platform.integrations.fallback')}</p>
        </>
      )}
    </section>
  );
}
