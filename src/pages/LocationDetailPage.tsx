import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { listBusinessLocations } from '../api/saasClient';
import { useSession } from '../context/SessionContext';
import { formatFacilityTypeLabel } from '../constants/locationFacilityTypes';
import { canManageBusinessLocations } from '../rbac';
import type { BusinessLocationRow } from '../types/domain';
import { findBusinessLocationByRouteId } from '../utils/businessLocation';

type FacilityCountsUi = {
  turf: number;
  padel: number;
  futsal: number;
  cricket: number;
};

function countsFromLocation(loc: BusinessLocationRow | null): FacilityCountsUi {
  const fc = loc?.facilityCounts;
  if (!fc) {
    return { turf: 0, padel: 0, futsal: 0, cricket: 0 };
  }
  return {
    turf: fc['turf-court'] ?? 0,
    padel: fc['padel-court'] ?? 0,
    futsal: fc['futsal-field'] ?? 0,
    cricket: fc['cricket-indoor'] ?? 0,
  };
}

export default function LocationDetailPage() {
  const { session } = useSession();
  const { locationId = '' } = useParams<{ locationId: string }>();
  const canManage = canManageBusinessLocations(session?.roles ?? []);
  const [rows, setRows] = useState<BusinessLocationRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const location = useMemo(
    () => findBusinessLocationByRouteId(rows, locationId),
    [rows, locationId],
  );
  const counts = useMemo(() => countsFromLocation(location), [location]);
  const availableFacilityCards = useMemo(
    () =>
      [
        { key: 'turf', label: 'Turf courts', count: counts.turf },
        { key: 'padel', label: 'Padel courts', count: counts.padel },
        { key: 'futsal', label: 'Futsal fields', count: counts.futsal },
        { key: 'cricket', label: 'Cricket indoor', count: counts.cricket },
      ].filter((item) => item.count > 0),
    [counts.cricket, counts.futsal, counts.padel, counts.turf],
  );

  const courtsByType = useMemo(() => {
    const courts = location?.facilityCourts ?? [];
    const order = [
      'padel-court',
      'futsal-field',
      'cricket-indoor',
      'turf-court',
    ] as const;
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
            {canManage ? (
              <>
                <Link to={`/app/locations/${location.id}/edit`} className="btn-primary">
                  Edit location
                </Link>
                <Link to="/app/Facilites" className="btn-ghost">
                  Manage facilities
                </Link>
              </>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
