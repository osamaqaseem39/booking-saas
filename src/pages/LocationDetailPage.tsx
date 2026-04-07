import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { listBusinessLocations } from '../api/saasClient';
import { formatFacilityTypeLabel } from '../constants/locationFacilityTypes';
import type { BusinessLocationRow } from '../types/domain';

type FacilityCountsUi = {
  futsal: number;
  cricket: number;
  padel: number;
};

function countsFromLocation(loc: BusinessLocationRow | null): FacilityCountsUi {
  const fc = loc?.facilityCounts;
  if (!fc) {
    return { futsal: 0, cricket: 0, padel: 0 };
  }
  return {
    futsal: fc.futsal ?? 0,
    cricket: fc.cricket ?? 0,
    padel: fc.padel ?? 0,
  };
}

function toTitle(value?: string | null): string {
  if (!value) return '—';
  return value
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export default function LocationDetailPage() {
  const { locationId = '' } = useParams<{ locationId: string }>();
  const [rows, setRows] = useState<BusinessLocationRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const location = useMemo(
    () => rows.find((r) => r.id === locationId) ?? null,
    [rows, locationId],
  );
  const counts = useMemo(() => countsFromLocation(location), [location]);
  const availableFacilityCards = useMemo(
    () =>
      [
        { key: 'futsal', label: 'Futsal', count: counts.futsal },
        { key: 'cricket', label: 'Cricket', count: counts.cricket },
        { key: 'padel', label: 'Padel', count: counts.padel },
      ].filter((item) => item.count > 0),
    [counts.cricket, counts.futsal, counts.padel],
  );

  const courtsByType = useMemo(() => {
    const courts = location?.facilityCourts ?? [];
    const order = ['padel', 'futsal', 'cricket'] as const;
    const map = new Map<string, typeof courts>();
    for (const c of courts) {
      const list = map.get(c.facilityType) ?? [];
      list.push(c);
      map.set(c.facilityType, list);
    }
    return order
      .filter((t) => (map.get(t)?.length ?? 0) > 0)
      .map((facilityType) => ({
        facilityType,
        items: map.get(facilityType) ?? [],
      }));
  }, [location?.facilityCourts]);

  useEffect(() => {
    if (!locationId.trim()) return;
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const locs = await listBusinessLocations();
        setRows(locs);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load location details');
      } finally {
        setLoading(false);
      }
    })();
  }, [locationId]);

  if (!locationId.trim()) return <p className="muted">Missing location id.</p>;

  return (
    <div>
      <p className="page-toolbar">
        <Link to="/app/locations" className="btn-ghost btn-compact">
          ← Locations
        </Link>
      </p>
      <h1 className="page-title">Location details</h1>
      {err && <div className="err-banner">{err}</div>}

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : !location ? (
        <div className="err-banner">Location not found or not visible for your user.</div>
      ) : (
        <>
          <section className="connection-panel business-profile-card" style={{ margin: 0 }}>
            <div className="business-profile-card__head">
              <h2>{location.name}</h2>
              <p className="muted">
                Location profile, available facilities, and quick actions.
              </p>
            </div>
            <div className="business-profile-grid">
              <div className="business-profile-item">
                <span className="business-profile-item__label">Business</span>
                <strong className="business-profile-item__value">
                  {location.business?.businessName ?? location.businessId}
                </strong>
              </div>
              <div className="business-profile-item">
                <span className="business-profile-item__label">Tenant</span>
                <strong className="business-profile-item__value business-profile-item__value--code">
                  <code>{location.business?.tenantId ?? '—'}</code>
                </strong>
              </div>
              <div className="business-profile-item">
                <span className="business-profile-item__label">Type</span>
                <strong className="business-profile-item__value">
                  {toTitle(location.locationType)}
                </strong>
              </div>
              <div className="business-profile-item">
                <span className="business-profile-item__label">Status</span>
                <strong className="business-profile-item__value">
                  {location.isActive ? 'Active' : 'Inactive'}
                </strong>
              </div>
              <div className="business-profile-item">
                <span className="business-profile-item__label">City</span>
                <strong className="business-profile-item__value">{location.city ?? '—'}</strong>
              </div>
              <div className="business-profile-item">
                <span className="business-profile-item__label">Phone</span>
                <strong className="business-profile-item__value">{location.phone ?? '—'}</strong>
              </div>
              <div className="business-profile-item business-profile-item--wide">
                <span className="business-profile-item__label">Facility types</span>
                <strong className="business-profile-item__value">
                  {location.facilityTypes?.length
                    ? location.facilityTypes.map(formatFacilityTypeLabel).join(', ')
                    : '—'}
                </strong>
              </div>
            </div>
          </section>

          {location.details?.trim() ? (
            <div className="connection-panel" style={{ marginTop: '1rem' }}>
              <h2>Details</h2>
              <p
                className="muted"
                style={{ marginTop: '0.45rem', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
              >
                {location.details.trim()}
              </p>
            </div>
          ) : null}

          {availableFacilityCards.length > 0 ? (
            <div className="connection-grid" style={{ marginTop: '1rem' }}>
              {availableFacilityCards.map((card) => (
                <article
                  key={card.key}
                  className={`connection-panel overview-metric-card sport-stat-card--${card.key}`}
                  style={{ margin: 0, padding: '0.9rem 1rem' }}
                >
                  <span className="overview-metric-label">{card.label}</span>
                  <strong className="overview-metric-value">{card.count}</strong>
                  <span className="overview-metric-hint muted">Available facilities</span>
                </article>
              ))}
            </div>
          ) : (
            <div className="connection-panel" style={{ marginTop: '1rem' }}>
              <h2>Available facility types</h2>
              <p className="muted" style={{ marginTop: '0.45rem' }}>
                No facilities added yet for this location.
              </p>
            </div>
          )}

          {courtsByType.length > 0 ? (
            <div className="connection-panel" style={{ marginTop: '1rem' }}>
              <h2>Courts &amp; fields</h2>
              <div className="location-courts-grid">
                {courtsByType.map(({ facilityType, items }) => (
                  <article key={facilityType} className="location-courts-card">
                    <h3>{formatFacilityTypeLabel(facilityType)}</h3>
                    <ul className="items-list">
                      {items.map((c) => (
                        <li key={c.id}>{c.name}</li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          <div className="page-actions-row">
            <Link to={`/app/locations/${location.id}/edit`} className="btn-primary">
              Edit location
            </Link>
            <Link
              to={`/app/bookings/new?locationId=${encodeURIComponent(location.id)}`}
              className="btn-primary"
            >
              Add booking
            </Link>
            <Link
              to="/app/Facilites"
              className="btn-ghost"
            >
              Manage facilities
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
