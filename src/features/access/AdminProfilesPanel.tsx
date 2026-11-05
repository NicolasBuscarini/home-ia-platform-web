import { ApiError, getJson, request, useI18n } from 'home-ia-shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  type CatalogPermission,
  moduleLabel,
  normalizeCatalogPermission,
  orderedModules,
  permissionDescription,
  permissionName,
  type RawPermission,
  riskLabel,
  scopeKindLabel,
} from './permissionCatalog';

interface Profile {
  publicId: string;
  currentVersionPublicId: string;
  name: string;
  isActive: boolean;
  version: number;
  updatedAtUtc: string;
  permissionKeys: string[];
}

type ErrorKind = 'load' | 'permissions' | 'save' | 'forbidden' | 'conflict' | 'session';

function errorKind(error: unknown, fallback: ErrorKind): ErrorKind {
  if (error instanceof ApiError && error.status === 401) return 'session';
  if (error instanceof ApiError && error.status === 403) return 'forbidden';
  if (error instanceof ApiError && error.status === 409) return 'conflict';
  return fallback;
}

export function AdminProfilesPanel() {
  const { t } = useI18n();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [permissions, setPermissions] = useState<CatalogPermission[]>([]);
  const [profileName, setProfileName] = useState('');
  const [editingProfileId, setEditingProfileId] = useState('');
  const [permissionKeys, setPermissionKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorKind | ''>('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const [profilesResult, permissionsResult] = await Promise.allSettled([
        getJson<Profile[]>('/api/v1/admin/access-rules', signal),
        getJson<RawPermission[]>('/api/v1/admin/permission-catalog', signal),
      ]);
      if (profilesResult.status === 'rejected') throw profilesResult.reason;
      setProfiles(profilesResult.value);
      if (permissionsResult.status === 'fulfilled') {
        setPermissions(permissionsResult.value.map(normalizeCatalogPermission));
      } else {
        setPermissions([]);
        if (!signal?.aborted) setError('permissions');
      }
    } catch (failure) {
      if (!signal?.aborted) setError(errorKind(failure, 'load'));
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function saveProfile() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const editing = profiles.find((item) => item.publicId === editingProfileId);
      const response = await request(
        editing ? `/api/v1/admin/access-rules/${editing.publicId}/versions` : '/api/v1/admin/access-rules',
        {
          method: 'POST',
          body: JSON.stringify(
            editing
              ? { expectedVersion: editing.version, permissionKeys }
              : { name: profileName, permissionKeys },
          ),
        },
      );
      if (!response.ok) throw new ApiError(`HTTP ${response.status}`, response.status);
      setProfileName('');
      setEditingProfileId('');
      setPermissionKeys([]);
      await load();
      setNotice(t('admin.profiles.notice.saved'));
    } catch (failure) {
      setError(errorKind(failure, 'save'));
    } finally {
      setBusy(false);
    }
  }

  const editing = profiles.find((profile) => profile.publicId === editingProfileId);

  const selectable = useMemo(() => permissions.filter((permission) => permission.isDelegable), [permissions]);
  const restricted = useMemo(
    () => permissions.filter((permission) => !permission.isDelegable),
    [permissions],
  );
  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, CatalogPermission[]>();
    for (const permission of selectable) {
      const items = groups.get(permission.module) ?? [];
      items.push(permission);
      groups.set(permission.module, items);
    }
    return orderedModules(groups.keys()).map((module) => ({
      module,
      items: groups.get(module) ?? [],
    }));
  }, [selectable]);
  const unknownKeys = useMemo(
    () => permissionKeys.filter((key) => !permissions.some((permission) => permission.key === key)),
    [permissionKeys, permissions],
  );

  function permissionLabel(permission: CatalogPermission) {
    const name = permissionName(permission.key);
    return name ? t(name) : permission.description;
  }

  function permissionHelp(permission: CatalogPermission) {
    const description = permissionDescription(permission.key);
    return description ? t(description) : permission.description;
  }

  return (
    <section className="panel-card admin-profiles-panel" aria-labelledby="admin-profiles-title">
      <div className="admin-users-heading">
        <div>
          <span className="eyebrow">{t('admin.profiles.eyebrow')}</span>
          <h2 id="admin-profiles-title" className="h4 mt-2">
            {t('admin.profiles.title')}
          </h2>
          <p className="text-secondary mb-0">{t('admin.profiles.description')}</p>
        </div>
      </div>

      {loading && (
        <p role="status" aria-live="polite">
          {t('admin.profiles.loading')}
        </p>
      )}
      {error && (
        <div className="error-text" role="alert">
          <p>{t(`admin.profiles.error.${error}`)}</p>
          {(error === 'load' || error === 'permissions') && (
            <button className="btn btn-outline-light btn-sm" type="button" onClick={() => void load()}>
              {t('admin.profiles.retry')}
            </button>
          )}
        </div>
      )}
      {notice && (
        <p className="admin-notice" role="status" aria-live="polite">
          {notice}
        </p>
      )}

      <fieldset className="admin-fieldset admin-profile-editor mt-3">
        <legend>{t('admin.profiles.editor')}</legend>
        <div className="profile-editor-fields">
          <div>
            <label className="form-label" htmlFor="access-profile-name">
              {t('admin.profiles.name')}
            </label>
            <input
              id="access-profile-name"
              className="form-control"
              value={profileName}
              onChange={(event) => setProfileName(event.currentTarget.value)}
              disabled={busy || !!editingProfileId}
              placeholder={t('admin.profiles.namePlaceholder')}
            />
          </div>
          <div>
            <label className="form-label" htmlFor="access-profile-edit">
              {t('admin.profiles.editExisting')}
            </label>
            <select
              id="access-profile-edit"
              className="form-select"
              value={editingProfileId}
              disabled={busy}
              onChange={(event) => {
                const id = event.currentTarget.value;
                const selected = profiles.find((profile) => profile.publicId === id);
                setEditingProfileId(id);
                setProfileName(selected?.name ?? '');
                setPermissionKeys(selected?.permissionKeys ?? []);
              }}
            >
              <option value="">{t('admin.profiles.newProfile')}</option>
              {profiles.map((profile) => (
                <option key={profile.publicId} value={profile.publicId} disabled={!profile.isActive}>
                  {profile.name} · v{profile.version}
                </option>
              ))}
            </select>
          </div>
        </div>
        {editing && (
          <p className="small text-secondary mt-2 mb-0">
            {t('admin.profiles.versionNotice', { version: editing.version })}
          </p>
        )}
        {unknownKeys.length > 0 && (
          <p className="small text-secondary mb-0" role="status">
            {t('admin.profiles.unknownKeys', { count: unknownKeys.length })}{' '}
            <code>{unknownKeys.join(', ')}</code>
          </p>
        )}

        <div className="profile-selection-summary">
          <p className="small text-secondary mb-0" role="status" aria-live="polite">
            {t('admin.profiles.selectedCount', {
              selected: permissionKeys.length,
              total: selectable.length,
            })}
          </p>
          {permissionKeys.length > 0 && (
            <button
              className="btn btn-link btn-sm"
              type="button"
              disabled={busy}
              onClick={() => setPermissionKeys([])}
            >
              {t('admin.profiles.clearSelection')}
            </button>
          )}
        </div>

        <div className="permission-groups">
          {permissions.length === 0 && (
            <p className="small text-secondary mb-0">{t('admin.profiles.noPermissions')}</p>
          )}
          {groupedPermissions.map((group) => {
            const selectedInGroup = group.items.filter((permission) =>
              permissionKeys.includes(permission.key),
            ).length;
            return (
              <fieldset className="permission-group" key={group.module}>
                <legend>
                  <span>{t(moduleLabel(group.module))}</span>
                  <span className="permission-group-count" aria-hidden="true">
                    {selectedInGroup}/{group.items.length}
                  </span>
                </legend>
                <div className="permission-options">
                  {group.items.map((permission) => {
                    const checked = permissionKeys.includes(permission.key);
                    return (
                      <label
                        className={`permission-option${checked ? ' is-selected' : ''}`}
                        key={permission.key}
                      >
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={checked}
                          disabled={busy}
                          onChange={(event) =>
                            setPermissionKeys((current) =>
                              event.target.checked
                                ? [...current, permission.key]
                                : current.filter((key) => key !== permission.key),
                            )
                          }
                        />
                        <span className="permission-option-copy">
                          <strong>{permissionLabel(permission)}</strong>
                          <span>{permissionHelp(permission)}</span>
                          <span className="permission-option-meta">
                            <span className="permission-badge">{t(riskLabel(permission.risk))}</span>
                            <span className="permission-badge">{t('admin.profiles.scopeKinds')}</span>
                            {permission.allowedScopeKinds.map((kind) => (
                              <span className="permission-badge" key={kind}>
                                {t(scopeKindLabel(kind))}
                              </span>
                            ))}
                          </span>
                          <code>{permission.key}</code>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            );
          })}
        </div>

        {restricted.length > 0 && (
          <section className="mt-2" aria-labelledby="admin-profiles-restricted-title">
            <h3 id="admin-profiles-restricted-title" className="h6 mb-1">
              {t('admin.profiles.restrictedTitle')}
            </h3>
            <p className="small text-secondary mb-2">{t('admin.profiles.restrictedHelp')}</p>
            <ul className="profile-permission-tags">
              {restricted.map((permission) => (
                <li className="permission-tag" key={permission.key}>
                  <span>{permissionLabel(permission)}</span>
                  <span className="permission-badge">
                    {permission.ownerOnly ? t('admin.profiles.ownerOnly') : t('admin.profiles.unavailable')}
                  </span>
                  <code>{permission.key}</code>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="profile-editor-actions">
          <button
            className="btn btn-primary btn-sm"
            type="button"
            onClick={() => void saveProfile()}
            disabled={busy || (!editingProfileId && !profileName.trim())}
          >
            {editingProfileId ? t('admin.profiles.publishVersion') : t('admin.profiles.create')}
          </button>
          {editingProfileId && (
            <button
              className="btn btn-outline-light btn-sm"
              type="button"
              disabled={busy}
              onClick={() => {
                setEditingProfileId('');
                setProfileName('');
                setPermissionKeys([]);
              }}
            >
              {t('admin.profiles.cancelEdit')}
            </button>
          )}
        </div>
      </fieldset>

      <section className="mt-4" aria-labelledby="admin-profile-list-title">
        <h3 id="admin-profile-list-title" className="h5">
          {t('admin.profiles.listTitle')}
        </h3>
        {!loading && profiles.length === 0 && (
          <p className="small text-secondary" role="status">
            {t('admin.profiles.empty')}
          </p>
        )}
        <ul className="admin-profile-list">
          {profiles.map((profile) => (
            <li className="admin-profile-card" key={profile.publicId}>
              <div className="admin-user-summary">
                <div>
                  <h4 className="h6 mb-1">
                    {profile.name} · v{profile.version}
                  </h4>
                  <span className={`admin-account-state${profile.isActive ? ' is-active' : ''}`}>
                    {profile.isActive ? t('admin.profiles.active') : t('admin.profiles.inactive')}
                  </span>
                </div>
                {profile.isActive && (
                  <button
                    className="btn btn-outline-light btn-sm"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditingProfileId(profile.publicId);
                      setProfileName(profile.name);
                      setPermissionKeys(profile.permissionKeys);
                    }}
                  >
                    {t('admin.profiles.edit')}
                  </button>
                )}
              </div>
              <p className="small text-secondary mb-1 mt-3">{t('admin.profiles.permissions')}</p>
              {profile.permissionKeys.length > 0 ? (
                <ul className="profile-permission-tags">
                  {profile.permissionKeys.map((key) => {
                    const name = permissionName(key);
                    return (
                      <li className="permission-tag" key={key}>
                        <span>{name ? t(name) : key}</span>
                        <code>{key}</code>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="small text-secondary mb-0">{t('admin.profiles.noPermissions')}</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
