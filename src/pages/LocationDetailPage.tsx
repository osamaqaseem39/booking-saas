import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  listBusinessLocations,
  listCricketIndoor,
  listFutsalFields,
  listPadelCourts,
  listTurfCourts,
} from '../api/saasClient';
import type { BusinessLocationRow } from '../types/domain';

type FacilityCounts = {
  turf: number;
  padel: number;
  futsal: number;
  cricket: number;
};

export default function LocationDetailPage() {
  const { locationId = '' } = useParams<{ locationId: string }>();
  const [rows, setRows] = useState<BusinessLocationRow[]>([]);
  const [counts, setCounts] = useState<FacilityCounts>({
    turf: 0,
    padel: 0,
    futsal: 0,
    cricket: 0,
  });
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const location = useMemo(
    () => rows.find((r) => r.id === locationId) ?? null,
    [rows, locationId],
  );

  useEffect(() => {
    if (!locationId.trim()) return;
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [locs, turf, padel, futsal, cricket] = await Promise.all([
          listBusinessLocations(),
          listTurfCourts(undefined, locationId),
          listPadelCourts(locationId),
          listFutsalFields(locationId),
          listCricketIndoor(locationId),
        ]);
        setRows(locs);
        setCounts({
          turf: turf.length,
          padel: padel.length,
          futsal: futsal.length,
          cricket: cricket.length,
        });
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
      <p className="muted" style={{ marginBottom: '0.75rem' }}>
        <Link to="/app/locations">← Locations</Link>
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
              <span>{location.facilityTypes?.join(', ') || '—'}</span>
            </div>
          </div>

          <div className="connection-grid" style={{ marginTop: '1rem' }}>
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>Turf courts</h2>
              <strong style={{ fontSize: '1.25rem' }}>{counts.turf}</strong>
            </div>
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>Padel courts</h2>
              <strong style={{ fontSize: '1.25rem' }}>{counts.padel}</strong>
            </div>
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>Futsal fields</h2>
              <strong style={{ fontSize: '1.25rem' }}>{counts.futsal}</strong>
            </div>
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>Cricket indoor</h2>
              <strong style={{ fontSize: '1.25rem' }}>{counts.cricket}</strong>
            </div>
          </div>

          <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
            <Link to={`/app/locations/${location.id}/edit`}>Edit location</Link>
            <Link to={`/app/locations/${location.id}/facilities`}>Manage facilities</Link>
          </div>
        </>
      )}
    </div>
  );
}
