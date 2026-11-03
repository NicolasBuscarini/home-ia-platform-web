import { useI18n } from 'home-ia-shared';
import { useState } from 'react';
import { AdminAccessRequestsPanel } from './features/access/AdminAccessRequestsPanel';
import { AdminProfilesPanel } from './features/access/AdminProfilesPanel';
import { AdminUsersPanel } from './features/access/AdminUsersPanel';

type AccessView = 'users' | 'profiles' | 'requests';

export interface AccessModuleProps {
  locale?: string;
  userRole?: string;
  portalModuleIds?: string[];
}

export default function AccessModule({ userRole, portalModuleIds }: AccessModuleProps) {
  const { t } = useI18n();
  const [view, setView] = useState<AccessView>('users');
  const [userIdFilter, setUserIdFilter] = useState<string>();

  const isAdministrator = userRole === 'Administrator';
  const allowed = isAdministrator && (!portalModuleIds || portalModuleIds.includes('administration'));

  if (!allowed) {
    return (
      <section className="panel-card" role="status">
        <p className="mb-0">{t('platform.access.denied')}</p>
      </section>
    );
  }

  function manageUser(userId: string) {
    setUserIdFilter(userId);
    setView('users');
  }

  const tabs: Array<{ id: AccessView; label: string }> = [
    { id: 'users', label: t('dashboard.menu.users') },
    { id: 'profiles', label: t('dashboard.menu.profiles') },
    { id: 'requests', label: t('dashboard.menu.accessRequests') },
  ];

  return (
    <section className="panel-card" aria-labelledby="platform-access-title">
      <header className="clips-header">
        <div>
          <span className="eyebrow">{t('platform.access.eyebrow')}</span>
          <h2 id="platform-access-title" className="h5 mt-2">
            {t('platform.access.title')}
          </h2>
          <p className="small text-secondary mb-0">{t('platform.access.description')}</p>
        </div>
      </header>

      <div className="nav nav-tabs mb-3" role="tablist" aria-label={t('platform.access.tabs.label')}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            id={`access-tab-${tab.id}`}
            className={`nav-link ${view === tab.id ? 'active' : ''}`}
            type="button"
            role="tab"
            aria-selected={view === tab.id}
            aria-controls={`access-view-${tab.id}`}
            onClick={() => setView(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div id={`access-view-${view}`} role="tabpanel" aria-labelledby={`access-tab-${view}`}>
        {view === 'users' && <AdminUsersPanel initialUserId={userIdFilter} />}
        {view === 'profiles' && <AdminProfilesPanel />}
        {view === 'requests' && <AdminAccessRequestsPanel onManageUser={manageUser} />}
      </div>
    </section>
  );
}
