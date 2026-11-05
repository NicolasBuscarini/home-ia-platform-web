import { ApiError, getJson, ModulePage, useI18n } from 'home-ia-shared';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { auditCopy, fill } from './features/audit/copy';

interface EventListItem {
  publicId: string;
  occurredAtUtc: string;
  eventType: string;
  category: string;
  severity: string;
  outcome: string;
  source: string;
  actorPublicId: string | null;
  actorUsername: string | null;
  resourceType: string | null;
  resourceId: string | null;
  correlationId: string | null;
}

interface EventPage {
  items: EventListItem[];
  nextCursor: string | null;
}

interface EventEnvelope {
  schemaVersion: string;
  eventId: string;
  eventType: string;
  category: string;
  severity: string;
  outcome: string;
  occurredAtUtc: string;
  source: string;
  sourceVersion: string | null;
  emitter: string;
  actor: { userPublicId: string | null; username: string | null; displayName: string | null } | null;
  subject: { type: string; publicId: string } | null;
  resource: { type: string; publicId: string } | null;
  correlationId: string | null;
  causationId: string | null;
  requestId: string | null;
  sessionId: string | null;
  traceId: string | null;
  spanId: string | null;
  http: { method: string; route: string; statusCode: number; durationMs: number } | null;
  client: {
    userAgent: string | null;
    browser: string | null;
    os: string | null;
    device: string | null;
    ip: string | null;
  } | null;
  metadata: Record<string, unknown> | null;
}

interface EventDetail {
  record: {
    publicId: string;
    recordedAtUtc: string;
    payloadHash: string;
    event: EventEnvelope;
  };
  actorPublicId: string | null;
  subjectPublicId: string | null;
  integrityValid: boolean;
  metadata: Record<string, unknown> | null;
}

interface Filters {
  from: string;
  to: string;
  eventType: string;
  category: string;
  outcome: string;
  source: string;
  actor: string;
  correlationId: string;
  resourceType: string;
  resourceId: string;
  q: string;
  browser: string;
  os: string;
  device: string;
}

const emptyFilters: Filters = {
  from: '',
  to: '',
  eventType: '',
  category: '',
  outcome: '',
  source: '',
  actor: '',
  correlationId: '',
  resourceType: '',
  resourceId: '',
  q: '',
  browser: '',
  os: '',
  device: '',
};

const categories = [
  'authentication',
  'authorization',
  'administration',
  'configuration',
  'media',
  'biometrics',
  'integration',
  'navigation',
  'system',
  'legacy',
];

const outcomes = ['success', 'failure', 'denied', 'error', 'unknown'];

export interface AuditModuleProps {
  locale?: string;
  userRole?: string;
  portalModuleIds?: string[];
}

function iso(value: string): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function queryString(filters: Filters, cursor?: string | null): string {
  const params = new URLSearchParams();
  const values: Array<[string, string | null]> = [
    ['fromUtc', iso(filters.from)],
    ['toUtc', iso(filters.to)],
    ['eventType', filters.eventType.trim() || null],
    ['category', filters.category || null],
    ['outcome', filters.outcome || null],
    ['source', filters.source.trim() || null],
    ['actor', filters.actor.trim() || null],
    ['correlationId', filters.correlationId.trim() || null],
    ['resourceType', filters.resourceType.trim() || null],
    ['resourceId', filters.resourceId.trim() || null],
    ['q', filters.q.trim() || null],
    ['browser', filters.browser.trim() || null],
    ['os', filters.os.trim() || null],
    ['device', filters.device.trim() || null],
  ];
  for (const [key, value] of values) {
    if (value) params.set(key, value);
  }
  params.set('pageSize', '50');
  if (cursor) params.set('cursor', cursor);
  return params.toString();
}

function outcomeClass(outcome: string): string {
  if (outcome === 'success') return 'text-bg-success';
  if (outcome === 'denied' || outcome === 'failure') return 'text-bg-warning';
  if (outcome === 'error') return 'text-bg-danger';
  return 'text-bg-secondary';
}

function formatDate(value: string, locale: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' }).format(parsed);
}

export default function AuditModule({ userRole, portalModuleIds }: AuditModuleProps) {
  const { locale } = useI18n();
  const copy = useMemo(() => auditCopy(locale), [locale]);
  const [draft, setDraft] = useState<Filters>(emptyFilters);
  const [applied, setApplied] = useState<Filters>(emptyFilters);
  const [items, setItems] = useState<EventListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<EventDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const lastTrigger = useRef<HTMLButtonElement | null>(null);
  const closeButton = useRef<HTMLButtonElement | null>(null);

  const isAdministrator = userRole === 'Administrator';
  const allowed = isAdministrator && (!portalModuleIds || portalModuleIds.includes('administration'));

  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    getJson<EventPage>(`/api/v1/admin/events?${queryString(applied)}`, controller.signal)
      .then((page) => {
        setItems(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch((failure: unknown) => {
        if (controller.signal.aborted) return;
        setItems([]);
        setNextCursor(null);
        setError(failure instanceof ApiError && failure.status === 403 ? copy.errorForbidden : copy.error);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [allowed, applied, copy]);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    getJson<EventDetail>(`/api/v1/admin/events/${encodeURIComponent(selected)}`, controller.signal)
      .then((value) => setDetail(value))
      .catch((failure: unknown) => {
        if (controller.signal.aborted) return;
        setDetailError(
          failure instanceof ApiError && failure.status === 403 ? copy.errorForbidden : copy.detailError,
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false);
      });
    return () => controller.abort();
  }, [selected, copy]);

  useEffect(() => {
    if (selected) closeButton.current?.focus();
  }, [selected]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const page = await getJson<EventPage>(`/api/v1/admin/events?${queryString(applied, nextCursor)}`);
      setItems((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (failure) {
      setError(failure instanceof ApiError && failure.status === 403 ? copy.errorForbidden : copy.error);
    } finally {
      setLoadingMore(false);
    }
  }, [applied, copy, loadingMore, nextCursor]);

  function closeDetail() {
    setSelected(null);
    setDetail(null);
    setDetailError('');
    lastTrigger.current?.focus();
  }

  if (!allowed) {
    return (
      <section className="panel-card" role="status">
        <p className="mb-0">{copy.denied}</p>
      </section>
    );
  }

  function field(label: string, key: keyof Filters, id: string, type = 'text') {
    return (
      <div className="col-md-4">
        <label className="form-label" htmlFor={id}>
          {label}
        </label>
        <input
          className="form-control"
          id={id}
          type={type}
          value={draft[key]}
          onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
        />
      </div>
    );
  }

  return (
    <ModulePage
      titleId="platform-audit-title"
      eyebrow={copy.eyebrow}
      title={copy.title}
      description={copy.description}
      actions={
        <button
          className="btn btn-outline-secondary btn-sm"
          type="button"
          disabled={loading}
          onClick={() => setApplied({ ...draft })}
        >
          {copy.refresh}
        </button>
      }
    >
      <form
        className="module-section"
        aria-label={copy.filtersLabel}
        onSubmit={(event) => {
          event.preventDefault();
          setApplied({ ...draft });
        }}
      >
        <fieldset className="mb-3">
          <legend className="h6">{copy.period}</legend>
          <div className="row g-3">
            {field(copy.from, 'from', 'audit-from', 'datetime-local')}
            {field(copy.to, 'to', 'audit-to', 'datetime-local')}
          </div>
        </fieldset>
        <fieldset className="mb-3">
          <legend className="h6">{copy.event}</legend>
          <div className="row g-3">
            {field(copy.eventType, 'eventType', 'audit-event-type')}
            <div className="col-md-4">
              <label className="form-label" htmlFor="audit-category">
                {copy.category}
              </label>
              <select
                className="form-select"
                id="audit-category"
                value={draft.category}
                onChange={(event) => setDraft({ ...draft, category: event.target.value })}
              >
                <option value="">{copy.all}</option>
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4">
              <label className="form-label" htmlFor="audit-outcome">
                {copy.outcome}
              </label>
              <select
                className="form-select"
                id="audit-outcome"
                value={draft.outcome}
                onChange={(event) => setDraft({ ...draft, outcome: event.target.value })}
              >
                <option value="">{copy.all}</option>
                {outcomes.map((outcome) => (
                  <option key={outcome} value={outcome}>
                    {outcome}
                  </option>
                ))}
              </select>
            </div>
            {field(copy.source, 'source', 'audit-source')}
          </div>
        </fieldset>
        <fieldset className="mb-3">
          <legend className="h6">{copy.context}</legend>
          <div className="row g-3">
            {field(copy.actor, 'actor', 'audit-actor')}
            {field(copy.correlation, 'correlationId', 'audit-correlation')}
            {field(copy.resourceType, 'resourceType', 'audit-resource-type')}
            {field(copy.resourceId, 'resourceId', 'audit-resource-id')}
            <div className="col-md-8">
              <label className="form-label" htmlFor="audit-search">
                {copy.search}
              </label>
              <input
                className="form-control"
                id="audit-search"
                type="search"
                value={draft.q}
                onChange={(event) => setDraft({ ...draft, q: event.target.value })}
              />
            </div>
          </div>
        </fieldset>
        <fieldset>
          <legend className="h6">{copy.client}</legend>
          <div className="row g-3">
            {field(copy.browser, 'browser', 'audit-browser')}
            {field(copy.os, 'os', 'audit-os')}
            {field(copy.device, 'device', 'audit-device')}
          </div>
        </fieldset>
        <div className="d-flex flex-wrap gap-2 mt-3">
          <button className="btn btn-primary btn-sm" type="submit" disabled={loading}>
            {copy.apply}
          </button>
          <button
            className="btn btn-outline-secondary btn-sm"
            type="button"
            onClick={() => {
              setDraft(emptyFilters);
              setApplied(emptyFilters);
            }}
          >
            {copy.clear}
          </button>
        </div>
      </form>

      {error && (
        <div className="error-text" role="alert">
          <p>{error}</p>
          <button
            className="btn btn-outline-secondary btn-sm"
            type="button"
            onClick={() => setApplied({ ...applied })}
          >
            {copy.retry}
          </button>
        </div>
      )}

      {loading && (
        <p role="status" aria-live="polite">
          {copy.loading}
        </p>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="clips-empty" role="status">
          {copy.empty}
        </p>
      )}

      {items.length > 0 && (
        <div className="module-section table-responsive">
          <table className="table align-middle">
            <caption className="visually-hidden">{copy.tableCaption}</caption>
            <thead>
              <tr>
                <th scope="col">{copy.when}</th>
                <th scope="col">{copy.type}</th>
                <th scope="col">{copy.category}</th>
                <th scope="col">{copy.outcome}</th>
                <th scope="col">{copy.source}</th>
                <th scope="col">{copy.actorColumn}</th>
                <th scope="col">{copy.resourceColumn}</th>
                <th scope="col" className="text-end">
                  {copy.details}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.publicId}>
                  <td>
                    <time dateTime={item.occurredAtUtc}>{formatDate(item.occurredAtUtc, locale)}</time>
                  </td>
                  <th scope="row">
                    <span className="d-block">{item.eventType}</span>
                    <span className="small text-secondary">{item.publicId}</span>
                  </th>
                  <td>{item.category}</td>
                  <td>
                    <span className={`badge ${outcomeClass(item.outcome)}`}>{item.outcome}</span>
                  </td>
                  <td>{item.source}</td>
                  <td>{item.actorPublicId ?? item.actorUsername ?? copy.none}</td>
                  <td>
                    {item.resourceType && item.resourceId
                      ? `${item.resourceType}/${item.resourceId}`
                      : (item.resourceId ?? copy.none)}
                  </td>
                  <td className="text-end">
                    <button
                      className="btn btn-outline-secondary btn-sm"
                      type="button"
                      aria-label={fill(copy.detailsFor, { publicId: item.publicId })}
                      onClick={(event) => {
                        lastTrigger.current = event.currentTarget;
                        setSelected(item.publicId);
                      }}
                    >
                      {copy.details}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {nextCursor && (
            <button
              className="btn btn-outline-primary btn-sm"
              type="button"
              disabled={loadingMore}
              onClick={() => void loadMore()}
            >
              {loadingMore ? copy.loadingMore : copy.loadMore}
            </button>
          )}
        </div>
      )}

      {selected && (
        <section
          className="panel-card mt-3"
          aria-labelledby="audit-detail-title"
          onKeyDown={(event) => {
            if (event.key === 'Escape') closeDetail();
          }}
        >
          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
            <h3 className="h5 mb-0" id="audit-detail-title">
              {copy.detailTitle}
            </h3>
            <button
              className="btn btn-outline-secondary btn-sm"
              type="button"
              ref={closeButton}
              onClick={closeDetail}
            >
              {copy.close}
            </button>
          </div>
          {detailLoading && (
            <p className="mt-3 mb-0" role="status" aria-live="polite">
              {copy.detailLoading}
            </p>
          )}
          {detailError && (
            <p className="error-text mt-3 mb-0" role="alert">
              {detailError}
            </p>
          )}
          {detail && <EventDetailView detail={detail} locale={locale} copy={copy} />}
        </section>
      )}
    </ModulePage>
  );
}

function EventDetailView({
  detail,
  locale,
  copy,
}: {
  detail: EventDetail;
  locale: string;
  copy: ReturnType<typeof auditCopy>;
}) {
  const event = detail.record.event;
  return (
    <>
      <p className="mt-2 mb-1">
        <strong>{detail.record.publicId}</strong> · {event.eventType}
      </p>
      <p className="mb-3">
        <span className={`badge ${outcomeClass(event.outcome)}`}>{event.outcome}</span>{' '}
        <span className={`badge ${detail.integrityValid ? 'text-bg-success' : 'text-bg-danger'}`}>
          {copy.integrity}: {detail.integrityValid ? copy.integrityValid : copy.integrityInvalid}
        </span>
      </p>
      <dl className="row small mb-0">
        <DetailRow label={copy.occurredAt}>{formatDate(event.occurredAtUtc, locale)}</DetailRow>
        <DetailRow label={copy.recordedAt}>{formatDate(detail.record.recordedAtUtc, locale)}</DetailRow>
        <DetailRow label={copy.eventId}>{event.eventId}</DetailRow>
        <DetailRow label={copy.category}>{event.category}</DetailRow>
        <DetailRow label={copy.severity}>{event.severity}</DetailRow>
        <DetailRow label={copy.source}>{event.source}</DetailRow>
        <DetailRow label={copy.sourceVersion}>{event.sourceVersion ?? copy.none}</DetailRow>
        <DetailRow label={copy.emitter}>{event.emitter}</DetailRow>
        <DetailRow label={copy.actorColumn}>
          {detail.actorPublicId ?? event.actor?.userPublicId ?? event.actor?.username ?? copy.none}
        </DetailRow>
        <DetailRow label={copy.subject}>
          {event.subject ? `${event.subject.type}/${event.subject.publicId}` : copy.none}
        </DetailRow>
        <DetailRow label={copy.resourceColumn}>
          {event.resource ? `${event.resource.type}/${event.resource.publicId}` : copy.none}
        </DetailRow>
        <DetailRow label={copy.correlation}>{event.correlationId ?? copy.none}</DetailRow>
        <DetailRow label={copy.causation}>{event.causationId ?? copy.none}</DetailRow>
        <DetailRow label={copy.requestId}>{event.requestId ?? copy.none}</DetailRow>
        <DetailRow label={copy.sessionId}>{event.sessionId ?? copy.none}</DetailRow>
        <DetailRow label={copy.trace}>{event.traceId ?? copy.none}</DetailRow>
        <DetailRow label={copy.span}>{event.spanId ?? copy.none}</DetailRow>
        <DetailRow label={copy.http}>
          {event.http
            ? `${event.http.method} ${event.http.route} · ${event.http.statusCode} · ${event.http.durationMs} ms`
            : copy.none}
        </DetailRow>
        <DetailRow label={copy.client}>
          {event.client
            ? [event.client.browser, event.client.os, event.client.device, event.client.ip]
                .filter(Boolean)
                .join(' · ') || copy.none
            : copy.none}
        </DetailRow>
      </dl>
      {event.metadata && Object.keys(event.metadata).length > 0 && (
        <div className="mt-3">
          <h4 className="h6">{copy.metadata}</h4>
          <pre className="small mb-0">{JSON.stringify(event.metadata, null, 2)}</pre>
        </div>
      )}
    </>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="col-md-6">
      <dt className="text-secondary fw-normal">{label}</dt>
      <dd className="mb-2">{children}</dd>
    </div>
  );
}
