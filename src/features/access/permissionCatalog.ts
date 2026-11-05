import type { TranslationKey } from 'home-ia-shared';

export type PermissionRisk = 'low' | 'medium' | 'high' | 'critical';
export type PermissionScopeKind = 'global' | 'module' | 'context' | 'camera';

export const SCOPE_KINDS: readonly PermissionScopeKind[] = ['global', 'module', 'context', 'camera'];

const RISK_BY_INDEX: readonly PermissionRisk[] = ['low', 'medium', 'high', 'critical'];
const SCOPE_KIND_BY_INDEX: readonly PermissionScopeKind[] = ['global', 'module', 'context', 'camera'];

interface PermissionCopy {
  name: TranslationKey;
  description: TranslationKey;
}

/**
 * Local copy for the permission catalog. The server remains the authority for keys, modules,
 * risk, availability and delegability; these labels only make the catalog readable and translatable.
 */
const PERMISSION_COPY: Record<string, PermissionCopy> = {
  'camera.list': copy('camera.list'),
  'live.video.view': copy('live.video.view'),
  'live.audio.listen': copy('live.audio.listen'),
  'events.read': copy('events.read'),
  'clips.read': copy('clips.read'),
  'clips.export': copy('clips.export'),
  'clips.analysis.request': copy('clips.analysis.request'),
  'clips.analysis.policy.manage': copy('clips.analysis.policy.manage'),
  'activitywatch.read': copy('activitywatch.read'),
  'biometrics.manage': copy('biometrics.manage'),
  'admin.cameras.read': copy('admin.cameras.read'),
  'admin.cameras.manage': copy('admin.cameras.manage'),
  'admin.users.read': copy('admin.users.read'),
  'admin.users.manage': copy('admin.users.manage'),
  'admin.permissions.read': copy('admin.permissions.read'),
  'admin.permissions.manage': copy('admin.permissions.manage'),
  'admin.modules.read': copy('admin.modules.read'),
  'admin.modules.manage': copy('admin.modules.manage'),
  'admin.integrations.manage': copy('admin.integrations.manage'),
  'admin.requests.read': copy('admin.requests.read'),
  'admin.requests.manage': copy('admin.requests.manage'),
  'admin.people.read': copy('admin.people.read'),
  'admin.people.manage': copy('admin.people.manage'),
  'admin.capture.manage': copy('admin.capture.manage'),
  'admin.retention.manage': copy('admin.retention.manage'),
  'admin.models.read': copy('admin.models.read'),
  'admin.models.manage': copy('admin.models.manage'),
  'admin.models.promote': copy('admin.models.promote'),
  'admin.configuration.manage': copy('admin.configuration.manage'),
  'admin.system.health.read': copy('admin.system.health.read'),
  'system.owner': copy('system.owner'),
};

function copy(key: string): PermissionCopy {
  return {
    name: `permission.${key}.name` as TranslationKey,
    description: `permission.${key}.description` as TranslationKey,
  };
}

/** Raw catalog entry as returned by the portal; enums may arrive as names or numeric indexes. */
export interface RawPermission {
  key: string;
  description?: string;
  module?: string;
  category?: string;
  risk?: string | number;
  allowedScopeKinds?: readonly (string | number)[];
  ownerOnly?: boolean;
  isAvailable?: boolean;
  unavailableReason?: string | null;
  isDelegable?: boolean;
}

export interface CatalogPermission {
  key: string;
  description: string;
  module: string;
  category: string;
  risk: PermissionRisk;
  allowedScopeKinds: PermissionScopeKind[];
  ownerOnly: boolean;
  isAvailable: boolean;
  isDelegable: boolean;
}

function normalizeRisk(value: string | number | undefined): PermissionRisk {
  if (typeof value === 'number') return RISK_BY_INDEX[value] ?? 'critical';
  return RISK_BY_INDEX.includes(value as PermissionRisk) ? (value as PermissionRisk) : 'critical';
}

function normalizeScopeKind(value: string | number): PermissionScopeKind | undefined {
  if (typeof value === 'number') return SCOPE_KIND_BY_INDEX[value];
  return SCOPE_KINDS.includes(value as PermissionScopeKind) ? (value as PermissionScopeKind) : undefined;
}

export function normalizeCatalogPermission(input: RawPermission): CatalogPermission {
  const allowedScopeKinds = (input.allowedScopeKinds ?? SCOPE_KINDS)
    .map(normalizeScopeKind)
    .filter((kind): kind is PermissionScopeKind => kind !== undefined);
  return {
    key: input.key,
    description: input.description ?? input.key,
    module: input.module ?? 'other',
    category: input.category ?? 'other',
    risk: normalizeRisk(input.risk),
    allowedScopeKinds: allowedScopeKinds.length > 0 ? allowedScopeKinds : [...SCOPE_KINDS],
    ownerOnly: input.ownerOnly ?? false,
    isAvailable: input.isAvailable ?? true,
    isDelegable: input.isDelegable ?? false,
  };
}

export function permissionName(key: string): TranslationKey | undefined {
  return PERMISSION_COPY[key]?.name;
}

export function permissionDescription(key: string): TranslationKey | undefined {
  return PERMISSION_COPY[key]?.description;
}

export function moduleLabel(module: string): TranslationKey {
  const known = `permission.module.${module}` as TranslationKey;
  return PERMISSION_MODULES.has(module) ? known : 'permission.module.other';
}

export function riskLabel(risk: PermissionRisk): TranslationKey {
  return `permission.risk.${risk}` as TranslationKey;
}

export function scopeKindLabel(kind: PermissionScopeKind): TranslationKey {
  return `permission.scope.${kind}` as TranslationKey;
}

const PERMISSION_MODULES = new Set([
  'cameras',
  'monitoring',
  'events',
  'clips',
  'activitywatch',
  'biometrics',
  'administration',
  'system',
]);

const MODULE_ORDER = [
  'cameras',
  'monitoring',
  'events',
  'clips',
  'activitywatch',
  'biometrics',
  'administration',
  'system',
];

export function orderedModules(modules: Iterable<string>): string[] {
  const present = [...new Set(modules)];
  return present.sort((left, right) => {
    const leftIndex = MODULE_ORDER.indexOf(left);
    const rightIndex = MODULE_ORDER.indexOf(right);
    if (leftIndex === -1 && rightIndex === -1) return left.localeCompare(right);
    if (leftIndex === -1) return 1;
    if (rightIndex === -1) return -1;
    return leftIndex - rightIndex;
  });
}
