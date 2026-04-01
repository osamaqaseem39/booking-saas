import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCourtSlotGrid, listCourtOptions, setCourtSlotBlock } from '../api/saasClient';
import { useSession } from '../context/SessionContext';
import type { BookingSportType, CourtOption, CourtSlotGridSegment } from '../types/booking';
import { formatTimeRange12h } from '../utils/timeDisplay';

function segmentBookingAllowed(seg: CourtSlotGridSegment): boolean {
  return seg.state === 'free';
}

export default function ManageTimeSlotsPage() {
  const { tenantId } = useSession();
  const [sport, setSport] = useState<BookingSportType>('futsal');
  const [courts, setCourts] = useState<CourtOption[]>([]);
  const [facilityKey, setFacilityKey] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [useWorkingHours, setUseWorkingHours] = useState(true);
  const [gridLoading, setGridLoading] = useState(false);
  const [grid, setGrid] = useState<Awaited<ReturnType<typeof getCourtSlotGrid>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [togglingStart, setTogglingStart] = useState<string | null>(null);

  const selected = useMemo(
    () => courts.find((c) => `${c.kind}:${c.id}` === facilityKey) ?? null,
    [courts, facilityKey],
  );

  useEffect(() => {
    setFacilityKey('');
  }, [sport]);

  useEffect(() => {
    if (!tenantId.trim()) {
      setCourts([]);
      return;
    }
    void (async () => {
      try {
        const rows = await listCourtOptions(sport);
        setCourts(rows);
      } catch {
        setCourts([]);
      }
    })();
  }, [sport, tenantId]);

  useEffect(() => {
    if (!courts.length) {
      setFacilityKey('');
      return;
    }
    if (!facilityKey || !courts.some((c) => `${c.kind}:${c.id}` === facilityKey)) {
      setFacilityKey(`${courts[0].kind}:${courts[0].id}`);
    }
  }, [courts, facilityKey]);

  const loadGrid = useCallback(async () => {
    if (!selected) {
      setGrid(null);
      return;
    }
    setGridLoading(true);
    setError(null);
    try {
      const g = await getCourtSlotGrid({
        courtKind: selected.kind,
        courtId: selected.id,
        date,
        useWorkingHours,
        availableOnly: false,
      });
      setGrid(g);
    } catch (e) {
      setGrid(null);
      setError(e instanceof Error ? e.message : 'Failed to load slots');
    } finally {
      setGridLoading(false);
    }
  }, [selected, date, useWorkingHours]);

  useEffect(() => {
    void loadGrid();
  }, [loadGrid]);

  async function onToggleSegment(seg: CourtSlotGridSegment) {
    if (!selected || seg.state === 'booked') return;
    const allowed = segmentBookingAllowed(seg);
    setTogglingStart(seg.startTime);
    setError(null);
    try {
      await setCourtSlotBlock({
        courtKind: selected.kind,
        courtId: selected.id,
        date,
        startTime: seg.startTime,
        blocked: allowed,
      });
      await loadGrid();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setTogglingStart(null);
    }
  }

  return (
    <>
      <p className="page-toolbar">
        <Link to="/app/bookings" className="btn-ghost btn-compact">
          ← Bookings
        </Link>
      </p>
      <h1 className="page-title">Manage time slots</h1>
      <p className="muted" style={{ maxWidth: '640px', marginBottom: '1.25rem' }}>
        Turn booking on or off per 30-minute window for a facility. Booked slots cannot be toggled
        here; change or cancel the booking instead.
      </p>

      {!tenantId.trim() && (
        <div className="err-banner">Pick an active tenant in the top bar.</div>
      )}
      {error && <div className="err-banner">{error}</div>}

      <section className="detail-card" style={{ maxWidth: '720px' }}>
        <div className="form-grid">
          <div className="form-row-2">
            <label>
              <span className="muted" style={{ fontSize: '0.78rem', display: 'block' }}>
                Sport
              </span>
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value as BookingSportType)}
              >
                <option value="futsal">Futsal</option>
                <option value="cricket">Cricket</option>
                <option value="padel">Padel</option>
              </select>
            </label>
            <label>
              <span className="muted" style={{ fontSize: '0.78rem', display: 'block' }}>
                Date
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </label>
          </div>
          <label>
            <span className="muted" style={{ fontSize: '0.78rem', display: 'block' }}>
              Facility
            </span>
            <select
              value={facilityKey}
              onChange={(e) => setFacilityKey(e.target.value)}
              disabled={!courts.length}
            >
              {courts.map((c) => (
                <option key={`${c.kind}:${c.id}`} value={`${c.kind}:${c.id}`}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="ui-switch" style={{ marginTop: '0.25rem' }}>
            <input
              type="checkbox"
              checked={useWorkingHours}
              onChange={(e) => setUseWorkingHours(e.target.checked)}
            />
            <span className="ui-switch-track" aria-hidden />
            <span className="ui-switch-text">Limit grid to location working hours</span>
          </label>
        </div>
      </section>

      <section className="detail-card" style={{ maxWidth: '720px', marginTop: '1rem' }}>
        {gridLoading && <p className="muted">Loading slot grid…</p>}
        {!gridLoading && grid?.locationClosed && (
          <p className="muted">This location is closed on the selected date (per working hours).</p>
        )}
        {!gridLoading && grid && !grid.locationClosed && grid.segments.length === 0 && (
          <p className="muted">No segments in the grid for this selection.</p>
        )}
        {!gridLoading && grid && !grid.locationClosed && grid.segments.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {grid.segments.map((seg) => {
              const busy = seg.state === 'booked';
              const allowed = !busy && segmentBookingAllowed(seg);
              const disabled = busy || togglingStart === seg.startTime;
              return (
                <li
                  key={seg.startTime}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    padding: '0.55rem 0',
                    borderBottom: '1px solid var(--border-subtle, #2a2f3a)',
                  }}
                >
                  <div>
                    <strong>{formatTimeRange12h(seg.startTime, seg.endTime)}</strong>
                    {busy && (
                      <span className="muted" style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                        Booked ({seg.status})
                      </span>
                    )}
                    {!busy && seg.state === 'blocked' && (
                      <span className="muted" style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                        Booking off
                      </span>
                    )}
                  </div>
                  <label
                    className="ui-switch"
                    style={{ opacity: busy ? 0.55 : 1, flexShrink: 0 }}
                  >
                    <input
                      type="checkbox"
                      checked={allowed}
                      disabled={disabled}
                      onChange={() => void onToggleSegment(seg)}
                    />
                    <span className="ui-switch-track" aria-hidden />
                    <span className="ui-switch-text" style={{ fontSize: '0.8rem' }}>
                      {busy ? 'Booked' : 'Booking on'}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
