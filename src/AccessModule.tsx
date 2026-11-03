import { ModulePage, ModuleTabs, useI18n } from 'home-ia-shared';
import { useState } from 'react';
import { AdminAccessRequestsPanel } from './features/access/AdminAccessRequestsPanel';
import { AdminProfilesPanel } from './features/access/AdminProfilesPanel';
import { AdminUsersPanel } from './features/access/AdminUsersPanel';

type AccessView = 'users' | 'profiles' | 'requests';

export interface AccessModuleProps {
  locale?: string;
  userRole?: string;
  portalModuleIds?: string[];
  activeView?: string;
  onViewChange?: (view: string) => void;
}

export default function AccessModule({
  userRole,
  portalModuleIds,
  activeView,
  onViewChange,
}: AccessModuleProps) {
  const { t } = useI18n();
  const [internalView, setInternalView] = useState<AccessView>('users');
  const controlled = activeView !== undefined;
  const view: AccessView =
    activeView === 'users' || activeView === 'profiles' || activeView === 'requests'
      ? activeView
      : internalView;
  const setView = (next: AccessView) => {
    setInternalView(next);
    onViewChange?.(next);
  };
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
    <ModulePage
      titleId="platform-access-title"
      eyebrow={t('platform.access.eyebrow')}
      title={t('platform.access.title')}
      description={t('platform.access.description')}
    >
      {!controlled && (
        <ModuleTabs
          label={t('platform.access.tabs.label')}
          items={tabs.map((tab) => ({
            ...tab,
            panelId: `access-view-${tab.id}`,
          }))}
          active={view}
          onChange={setView}
        />
      )}

      <section
        id={`access-view-${view}`}
        aria-labelledby={controlled ? `module-subnav-access-${view}` : `module-tab-${view}`}
      >
        {view === 'users' && <AdminUsersPanel initialUserId={userIdFilter} />}
        {view === 'profiles' && <AdminProfilesPanel />}
        {view === 'requests' && <AdminAccessRequestsPanel onManageUser={manageUser} />}
      </section>
    </ModulePage>
  );
}
