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
          <div className="connection-panel" style={{ margin: 0 }}>
            <div className="detail-row">
              <span>Name</span>
              <span>{location.name}</span>
            </div>
            <div className="detail-row">
              <span>Business</span>
              <span>{location.business?.businessName ?? location.businessId}</span>
            </div>
            <div className="detail-row">
              <span>Tenant</span>
              <span>{location.business?.tenantId ?? '—'}</span>
            </div>
            <div className="detail-row">
              <span>Type</span>
              <span>{location.locationType ?? '—'}</span>
            </div>
            <div className="detail-row">
              <span>City</span>
              <span>{location.city ?? '—'}</span>
            </div>
            <div className="detail-row">
              <span>Phone</span>
              <span>{location.phone ?? '—'}</span>
            </div>
            <div className="detail-row">
              <span>Status</span>
              <span>{location.isActive ? 'Active' : 'Inactive'}</span>
            </div>
            <div className="detail-row">
              <span>Facility types</span>
              <span>
                {location.facilityTypes?.length
                  ? location.facilityTypes.map(formatFacilityTypeLabel).join(', ')
                  : '—'}
              </span>
            </div>
          </div>

          {location.details?.trim() ? (
            <div className="connection-panel" style={{ marginTop: '1rem' }}>
              <h2>Details</h2>
              <p
                className="muted"
                style={{ marginTop: '0.45rem', whiteSpace: 'pre-wrap' }}
              >
                {location.details.trim()}
              </p>
            </div>
          ) : null}

          {availableFacilityCards.length > 0 ? (
            <div className="connection-grid" style={{ marginTop: '1rem' }}>
              {availableFacilityCards.map((card) => (
                <div
                  key={card.key}
                  className="connection-panel"
                  style={{ margin: 0, padding: '0.9rem 1rem' }}
                >
                  <h2>{card.label}</h2>
                  <strong style={{ fontSize: '1.25rem' }}>{card.count}</strong>
                </div>
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
              <div style={{ marginTop: '0.65rem', display: 'grid', gap: '1rem' }}>
                {courtsByType.map(({ facilityType, items }) => (
                  <div key={facilityType}>
                    <div className="muted" style={{ fontWeight: 600, marginBottom: '0.35rem' }}>
                      {formatFacilityTypeLabel(facilityType)}
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                      {items.map((c) => (
                        <li key={c.id}>{c.name}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="page-actions-row">
            <Link to={`/app/locations/${location.id}/edit`} className="btn-primary">
              Edit location
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
