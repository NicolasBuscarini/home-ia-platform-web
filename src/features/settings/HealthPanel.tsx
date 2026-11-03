import { ApiError, getJson, useI18n } from 'home-ia-shared';
import { useState } from 'react';

interface PortalModuleHealthEntry {
  moduleId: string;
  kind: string;
  status: string;
  enabled: boolean;
  contractVersion: string | null;
  latencyMs: number;
  checkedAtUtc: string;
  errorCode: string | null;
  capabilities: string[];
}

interface PortalHealthReport {
  schemaVersion: string;
  residenceId: string;
  generatedAtUtc: string;
  portalStatus: string;
  status: string;
  modules: PortalModuleHealthEntry[];
}

const statusClass: Record<string, string> = {
  healthy: 'text-bg-success',
  degraded: 'text-bg-warning',
  unavailable: 'text-bg-danger',
  disabled: 'text-bg-secondary',
  unknown: 'text-bg-secondary',
};

type StatusKey =
  | 'platform.systems.status.healthy'
  | 'platform.systems.status.degraded'
  | 'platform.systems.status.unavailable'
  | 'platform.systems.status.disabled'
  | 'platform.systems.status.unknown';

const statusKey: Record<string, StatusKey> = {
  healthy: 'platform.systems.status.healthy',
  degraded: 'platform.systems.status.degraded',
  unavailable: 'platform.systems.status.unavailable',
  disabled: 'platform.systems.status.disabled',
  unknown: 'platform.systems.status.unknown',
};

const kindKey: Record<
  string,
  'platform.systems.health.kind.module' | 'platform.systems.health.kind.integration'
> = {
  module: 'platform.systems.health.kind.module',
  integration: 'platform.systems.health.kind.integration',
};

export default function HealthPanel() {
  const { t } = useI18n();
  const [report, setReport] = useState<PortalHealthReport>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function label(status: string) {
    const key = statusKey[status];
    return key ? t(key) : status;
  }

  function labelKind(kind: string) {
    const key = kindKey[kind];
    return key ? t(key) : kind;
  }

  async function check() {
    setLoading(true);
    setError('');
    try {
      setReport(await getJson<PortalHealthReport>('/api/v1/portal/health', AbortSignal.timeout(15000)));
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.status === 403
          ? t('platform.systems.health.error.forbidden')
          : t('platform.systems.health.error'),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="module-section" aria-labelledby="platform-health-title">
      <h2 id="platform-health-title" className="h5">
        {t('platform.systems.health.title')}
      </h2>
      <p className="text-secondary">{t('platform.systems.health.description')}</p>
      <button
        className="btn btn-outline-secondary btn-sm"
        type="button"
        disabled={loading}
        onClick={() => void check()}
      >
        {loading ? t('platform.systems.health.checking') : t('platform.systems.health.check')}
      </button>

      {error && (
        <div className="error-text" role="alert">
          <p>{error}</p>
          <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => void check()}>
            {t('platform.systems.retry')}
          </button>
        </div>
      )}

      {loading && (
        <p role="status" aria-live="polite">
          {t('platform.systems.health.checking')}
        </p>
      )}

      {!loading && !error && !report && (
        <p className="clips-empty" role="status">
          {t('platform.systems.health.notChecked')}
        </p>
      )}

      {report && !loading && !error && (
        <>
          <p role="status" aria-live="polite">
            {t('platform.systems.health.summary', { status: label(report.status) })} ·{' '}
            {t('platform.systems.health.portal')}: {label(report.portalStatus)}
          </p>
          <div className="table-responsive">
            <table className="table align-middle">
              <caption className="visually-hidden">{t('platform.systems.health.tableCaption')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('platform.systems.module')}</th>
                  <th scope="col">{t('platform.systems.status')}</th>
                  <th scope="col">{t('platform.systems.health.contract')}</th>
                  <th scope="col">{t('platform.systems.health.latency')}</th>
                  <th scope="col">{t('platform.systems.health.capabilities')}</th>
                  <th scope="col">{t('platform.systems.health.errorCode')}</th>
                </tr>
              </thead>
              <tbody>
                {report.modules.map((module) => (
                  <tr key={module.moduleId}>
                    <th scope="row">
                      <span className="d-block">{module.moduleId}</span>
                      <span className="small text-secondary">{labelKind(module.kind)}</span>
                    </th>
                    <td>
                      <span className={`badge ${statusClass[module.status] ?? 'text-bg-secondary'}`}>
                        {label(module.status)}
                      </span>
                    </td>
                    <td>{module.contractVersion ?? t('platform.systems.none')}</td>
                    <td>
                      {module.enabled
                        ? t('platform.systems.health.milliseconds', { value: module.latencyMs })
                        : t('platform.systems.none')}
                    </td>
                    <td>
                      {module.capabilities.length > 0
                        ? module.capabilities.join(', ')
                        : t('platform.systems.health.none')}
                    </td>
                    <td>{module.errorCode ?? t('platform.systems.health.none')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
