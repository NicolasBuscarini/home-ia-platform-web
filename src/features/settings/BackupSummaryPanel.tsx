import { ApiError, getJson, useI18n } from 'home-ia-shared';
import { useCallback, useEffect, useState } from 'react';

interface PortalBackupSummary {
  lastSuccessAtUtc: string | null;
  lastSuccessFileName: string | null;
  lastSuccessSizeBytes: number | null;
  lastSuccessSha256: string | null;
  artifactCount: number;
  totalSizeBytes: number;
  scheduleEnabled: boolean;
  scheduleIntervalHours: number;
  scheduleRetentionCount: number;
  lastFailureAtUtc: string | null;
}

function formatTimestamp(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.toLocaleString()} (${date.toISOString()})`;
}

function formatBytes(value: number | null) {
  if (value === null) return null;
  if (value < 1024) return `${value} B`;
  const units = ['KiB', 'MiB', 'GiB'];
  let amount = value / 1024;
  let unit = units[0];
  for (let i = 1; i < units.length && amount >= 1024; i += 1) {
    amount /= 1024;
    unit = units[i];
  }
  return `${amount.toFixed(1)} ${unit}`;
}

export default function BackupSummaryPanel() {
  const { t } = useI18n();
  const [summary, setSummary] = useState<PortalBackupSummary>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setSummary(await getJson<PortalBackupSummary>('/api/v1/admin/maintenance/backups/summary'));
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.status === 403
          ? t('platform.systems.backups.error.forbidden')
          : t('platform.systems.backups.error'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const lastSuccess = formatTimestamp(summary?.lastSuccessAtUtc ?? null);
  const lastFailure = formatTimestamp(summary?.lastFailureAtUtc ?? null);

  return (
    <section className="module-section" aria-labelledby="platform-backups-title">
      <h2 id="platform-backups-title" className="h5">
        {t('platform.systems.backups.title')}
      </h2>
      <p className="text-secondary">{t('platform.systems.backups.description')}</p>
      <button
        className="btn btn-outline-secondary btn-sm"
        type="button"
        disabled={loading}
        onClick={() => void load()}
      >
        {loading ? t('platform.systems.backups.loading') : t('platform.systems.refresh')}
      </button>

      {error && (
        <div className="error-text" role="alert">
          <p>{error}</p>
          <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => void load()}>
            {t('platform.systems.retry')}
          </button>
        </div>
      )}

      {loading && !summary && (
        <p role="status" aria-live="polite">
          {t('platform.systems.backups.loading')}
        </p>
      )}

      {!loading && !error && summary && summary.artifactCount === 0 && (
        <p className="clips-empty" role="status">
          {t('platform.systems.backups.empty')}
        </p>
      )}

      {summary && summary.artifactCount > 0 && (
        <dl className="row mb-0">
          <dt className="col-sm-4">{t('platform.systems.backups.lastSuccess')}</dt>
          <dd className="col-sm-8">
            {lastSuccess ?? t('platform.systems.none')}
            {summary.lastSuccessFileName && (
              <span className="d-block small text-secondary">{summary.lastSuccessFileName}</span>
            )}
          </dd>
          <dt className="col-sm-4">{t('platform.systems.backups.size')}</dt>
          <dd className="col-sm-8">
            {formatBytes(summary.lastSuccessSizeBytes) ?? t('platform.systems.none')}
          </dd>
          <dt className="col-sm-4">{t('platform.systems.backups.count')}</dt>
          <dd className="col-sm-8">{summary.artifactCount}</dd>
          <dt className="col-sm-4">{t('platform.systems.backups.totalSize')}</dt>
          <dd className="col-sm-8">{formatBytes(summary.totalSizeBytes) ?? t('platform.systems.none')}</dd>
          <dt className="col-sm-4">{t('platform.systems.backups.schedule')}</dt>
          <dd className="col-sm-8">
            {summary.scheduleEnabled
              ? t('platform.systems.backups.scheduleEnabled', {
                  interval: String(summary.scheduleIntervalHours),
                  retention: String(summary.scheduleRetentionCount),
                })
              : t('platform.systems.backups.scheduleDisabled')}
          </dd>
          <dt className="col-sm-4">{t('platform.systems.backups.lastFailure')}</dt>
          <dd className="col-sm-8">{lastFailure ?? t('platform.systems.backups.never')}</dd>
        </dl>
      )}
    </section>
  );
}
