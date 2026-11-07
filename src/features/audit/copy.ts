import type { TranslationKey, TranslationValues } from 'home-ia-shared';

type Translate = (key: TranslationKey, values?: TranslationValues) => string;

// The audit screen keeps a flat copy object for readability, but every string comes from the
// shared catalog so the shell and the remote never drift in wording or locale coverage.
const auditKeys = {
  eyebrow: 'audit.eyebrow',
  title: 'audit.title',
  description: 'audit.description',
  denied: 'audit.denied',
  refresh: 'audit.refresh',
  filtersLabel: 'audit.filtersLabel',
  period: 'audit.period',
  event: 'audit.event',
  context: 'audit.context',
  client: 'audit.client',
  from: 'audit.from',
  to: 'audit.to',
  eventType: 'audit.eventType',
  category: 'audit.category',
  outcome: 'audit.outcome',
  severity: 'audit.severity',
  source: 'audit.source',
  actor: 'audit.actor',
  excludeActors: 'audit.excludeActors',
  excludeActorsHint: 'audit.excludeActorsHint',
  correlation: 'audit.correlation',
  resourceType: 'audit.resourceType',
  resourceId: 'audit.resourceId',
  search: 'audit.search',
  browser: 'audit.browser',
  os: 'audit.os',
  device: 'audit.device',
  apply: 'audit.apply',
  clear: 'audit.clear',
  loading: 'audit.loading',
  loadingMore: 'audit.loadingMore',
  empty: 'audit.empty',
  error: 'audit.error',
  errorForbidden: 'audit.errorForbidden',
  retry: 'audit.retry',
  loadMore: 'audit.loadMore',
  tableCaption: 'audit.tableCaption',
  when: 'audit.when',
  type: 'audit.type',
  actorColumn: 'audit.actorColumn',
  resourceColumn: 'audit.resourceColumn',
  details: 'audit.details',
  detailsFor: 'audit.detailsFor',
  detailTitle: 'audit.detailTitle',
  close: 'audit.close',
  detailLoading: 'audit.detailLoading',
  detailError: 'audit.detailError',
  integrity: 'audit.integrity',
  integrityValid: 'audit.integrityValid',
  integrityInvalid: 'audit.integrityInvalid',
  occurredAt: 'audit.occurredAt',
  recordedAt: 'audit.recordedAt',
  eventId: 'audit.eventId',
  emitter: 'audit.emitter',
  sourceVersion: 'audit.sourceVersion',
  subject: 'audit.subject',
  causation: 'audit.causation',
  requestId: 'audit.requestId',
  sessionId: 'audit.sessionId',
  trace: 'audit.trace',
  span: 'audit.span',
  http: 'audit.http',
  method: 'audit.method',
  route: 'audit.route',
  status: 'audit.status',
  duration: 'audit.duration',
  clientIp: 'audit.clientIp',
  metadata: 'audit.metadata',
  all: 'audit.all',
  none: 'audit.none',
} as const satisfies Record<string, TranslationKey>;

type Copy = { [K in keyof typeof auditKeys]: string };

export function auditCopy(t: Translate): Copy {
  return Object.fromEntries(Object.entries(auditKeys).map(([field, key]) => [field, t(key)])) as Copy;
}

export function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{([^}]+)\}/g, (token, name: string) => {
    const value = values[name];
    return value ?? token;
  });
}
