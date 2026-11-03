import { ApiError, getJson, ModulePage, request, useI18n } from 'home-ia-shared';
import { useCallback, useEffect, useState } from 'react';
import HealthPanel from './features/settings/HealthPanel';
import IntegrationCredentialPanel from './features/settings/IntegrationCredentialPanel';
import PlatformSettingsPanel from './features/settings/PlatformSettingsPanel';

interface PortalModule {
  moduleId: string;
  displayNameKey: string;
  contractVersion: string;
  apiBaseUrl: string;
  healthPath: string | null;
  requiredPermission: string | null;
  menuGroup: string;
  menuOrder: number;
  menuIcon: string | null;
  menuLabelKey: string;
  isEnabled: boolean;
  version: number;
  createdAtUtc: string;
  updatedAtUtc: string;
}

interface PortalModulePage {
  items: PortalModule[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface SystemsModuleProps {
  locale?: string;
  userRole?: string;
  portalModuleIds?: string[];
}

export default function SystemsModule({ userRole, portalModuleIds }: SystemsModuleProps) {
  const { t } = useI18n();
  const [page, setPage] = useState<PortalModulePage>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState<string>();

  const isAdministrator = userRole === 'Administrator';
  const allowed = isAdministrator && (!portalModuleIds || portalModuleIds.includes('administration'));

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setPage(await getJson<PortalModulePage>('/api/v1/admin/portal-modules?page=1&pageSize=100'));
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.status === 403
          ? t('platform.systems.error.forbidden')
          : t('platform.systems.error.load'),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  async function toggle(item: PortalModule) {
    if (item.isEnabled && !window.confirm(t('platform.systems.confirmDisable', { module: item.moduleId }))) {
      return;
    }
    setBusyId(item.moduleId);
    setError('');
    setNotice('');
    try {
      const response = await request(`/api/v1/admin/portal-modules/${encodeURIComponent(item.moduleId)}`, {
        method: 'PUT',
        body: JSON.stringify({
          version: item.version,
          moduleId: item.moduleId,
          displayNameKey: item.displayNameKey,
          contractVersion: item.contractVersion,
          apiBaseUrl: item.apiBaseUrl,
          healthPath: item.healthPath,
          requiredPermission: item.requiredPermission,
          menuGroup: item.menuGroup,
          menuOrder: item.menuOrder,
          menuIcon: item.menuIcon,
          menuLabelKey: item.menuLabelKey,
          isEnabled: !item.isEnabled,
        }),
      });
      if (!response.ok) throw new ApiError(`HTTP ${response.status}`, response.status);
      const updated = (await response.json()) as PortalModule;
      setPage((current) =>
        current
          ? {
              ...current,
              items: current.items.map((entry) => (entry.moduleId === updated.moduleId ? updated : entry)),
            }
          : current,
      );
      setNotice(t('platform.systems.notice.updated', { module: item.moduleId }));
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.status === 409
          ? t('platform.systems.error.conflict')
          : t('platform.systems.error.update'),
      );
    } finally {
      setBusyId(undefined);
    }
  }

  if (!allowed) {
    return (
      <section className="panel-card" role="status">
        <p className="mb-0">{t('platform.systems.denied')}</p>
      </section>
    );
  }

  return (
    <ModulePage
      titleId="platform-systems-title"
      eyebrow={t('platform.systems.eyebrow')}
      title={t('platform.systems.title')}
      description={t('platform.systems.description')}
      actions={
        <button
          className="btn btn-outline-secondary btn-sm"
          type="button"
          disabled={loading || Boolean(busyId)}
          onClick={() => void load()}
        >
          {t('platform.systems.refresh')}
        </button>
      }
    >
      {error && (
        <div className="error-text" role="alert">
          <p>{error}</p>
          <button className="btn btn-outline-secondary btn-sm" type="button" onClick={() => void load()}>
            {t('platform.systems.retry')}
          </button>
        </div>
      )}

      {notice && (
        <p className="text-success" role="status">
          {notice}
        </p>
      )}

      {loading && !page && (
        <p role="status" aria-live="polite">
          {t('platform.systems.loading')}
        </p>
      )}

      {!loading && !error && page?.items.length === 0 && (
        <p className="clips-empty" role="status">
          {t('platform.systems.empty')}
        </p>
      )}

      {page && page.items.length > 0 && (
        <div className="module-section table-responsive">
          <table className="table align-middle">
            <caption className="visually-hidden">{t('platform.systems.tableCaption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('platform.systems.module')}</th>
                <th scope="col">{t('platform.systems.status')}</th>
                <th scope="col">{t('platform.systems.contract')}</th>
                <th scope="col">{t('platform.systems.menu')}</th>
                <th scope="col">{t('platform.systems.permission')}</th>
                <th scope="col" className="text-end">
                  {t('platform.systems.actions')}
                </th>
              </tr>
            </thead>
            <tbody>
              {page.items.map((item) => (
                <tr key={item.moduleId}>
                  <th scope="row">
                    <span className="d-block">{item.displayNameKey}</span>
                    <span className="small text-secondary">{item.moduleId}</span>
                    {item.healthPath && (
                      <span className="d-block small text-secondary">{item.healthPath}</span>
                    )}
                  </th>
                  <td>
                    <span className={`badge ${item.isEnabled ? 'text-bg-success' : 'text-bg-secondary'}`}>
                      {item.isEnabled ? t('platform.systems.enabled') : t('platform.systems.disabled')}
                    </span>
                  </td>
                  <td>{item.contractVersion}</td>
                  <td>
                    {item.menuGroup} / {item.menuLabelKey}
                  </td>
                  <td>{item.requiredPermission ?? t('platform.systems.none')}</td>
                  <td className="text-end">
                    <button
                      className={`btn btn-sm ${item.isEnabled ? 'btn-outline-danger' : 'btn-outline-success'}`}
                      type="button"
                      disabled={Boolean(busyId)}
                      onClick={() => void toggle(item)}
                    >
                      {busyId === item.moduleId
                        ? t('platform.systems.saving')
                        : item.isEnabled
                          ? t('platform.systems.disable')
                          : t('platform.systems.enable')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <IntegrationCredentialPanel />
      <PlatformSettingsPanel />
      <HealthPanel />
    </ModulePage>
  );
}
