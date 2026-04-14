import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  generateCourtFacilityDaySlots,
  getCourtSlots,
  listCourtOptions,
  patchCourtFacilitySlot,
} from '../../api/saasClient';
import { useSession } from '../../context/SessionContext';
import type { DashboardOutletContext } from '../../layout/ConsoleLayout';
import type { BookingSportType, CourtOption, CourtSlotsRecord } from '../../types/booking';
import { formatTimeRange12h } from '../../utils/timeDisplay';

export default function FacilitySlotsPage() {
  const { tenantId } = useSession();
  const { selectedLocationId } = useOutletContext<DashboardOutletContext>();
  const [sport, setSport] = useState<BookingSportType>('futsal');
  const [courts, setCourts] = useState<CourtOption[]>([]);
  const [facilityKey, setFacilityKey] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [slots, setSlots] = useState<CourtSlotsRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyStart, setBusyStart] = useState<string | null>(null);

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
        const rows = await listCourtOptions(
          sport,
          selectedLocationId === 'all' ? undefined : selectedLocationId,
        );
        setCourts(rows);
      } catch {
        setCourts([]);
      }
    })();
  }, [sport, tenantId, selectedLocationId]);

  useEffect(() => {
    if (!courts.length) {
      setFacilityKey('');
      return;
    }
    if (!facilityKey || !courts.some((c) => `${c.kind}:${c.id}` === facilityKey)) {
      setFacilityKey(`${courts[0].kind}:${courts[0].id}`);
    }
  }, [courts, facilityKey]);

  const loadSlots = useCallback(async () => {
    if (!selected) {
      setSlots(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const row = await getCourtSlots({
        courtKind: selected.kind,
        courtId: selected.id,
        date,
      });
      setSlots(row);
    } catch (e) {
      setSlots(null);
      setError(e instanceof Error ? e.message : 'Failed to load slots');
    } finally {
      setLoading(false);
    }
  }, [selected, date]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  async function onGenerateDay() {
    if (!selected) return;
    setGenerating(true);
    setError(null);
    try {
      await generateCourtFacilityDaySlots({
        courtKind: selected.kind,
        courtId: selected.id,
        date,
      });
      await loadSlots();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generate failed');
    } finally {
      setGenerating(false);
    }
  }

  async function onToggleSlot(startTime: string, next: 'available' | 'blocked') {
    if (!selected) return;
    setBusyStart(startTime);
    setError(null);
    try {
      await patchCourtFacilitySlot({
        courtKind: selected.kind,
        courtId: selected.id,
        date,
        startTime,
        status: next,
      });
      await loadSlots();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusyStart(null);
    }
  }

  return (
    <>
      <p className="page-toolbar">
        <Link to="/app/Facilites" className="btn-ghost btn-compact">
          ← Facilities
        </Link>
        <Link to="/app/bookings" className="btn-ghost btn-compact" style={{ marginLeft: '0.5rem' }}>
          Bookings
        </Link>
        <Link to="/app/time-slots" className="btn-ghost btn-compact" style={{ marginLeft: '0.5rem' }}>
          Manage time slots
        </Link>
      </p>
      <h1 className="page-title">Daily slots</h1>
      <p className="muted" style={{ maxWidth: '720px', marginBottom: '1.25rem' }}>
        Per-court rows for a single calendar day (hourly steps). Generate the day in the database,
        then mark segments blocked or open. Booked times follow live bookings and cannot be toggled
        here. For recurring grid rules and templates, use Manage time slots.
      </p>
      {selectedLocationId !== 'all' && (
        <p className="muted" style={{ marginTop: '-0.75rem', marginBottom: '1rem' }}>
          Location filter is active; only facilities at the selected location are listed.
        </p>
      )}

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
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
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
          <div className="page-actions-row" style={{ marginTop: '0.25rem' }}>
            <button
              type="button"
              className="btn-primary"
              disabled={!selected || generating || !tenantId.trim()}
              onClick={() => void onGenerateDay()}
            >
              {generating ? 'Generating…' : 'Generate day slots (DB)'}
            </button>
            <button
              type="button"
              className="btn-ghost"
              disabled={!selected || loading || !tenantId.trim()}
              onClick={() => void loadSlots()}
            >
              Refresh
            </button>
          </div>
        </div>
      </section>

      <section className="detail-card" style={{ maxWidth: '720px', marginTop: '1rem' }}>
        {loading && <p className="muted">Loading slots…</p>}
        {!loading && slots?.slots.length === 0 && (
          <p className="muted">No slot data for this selection.</p>
        )}
        {!loading && slots && slots.slots.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {slots.slots.map((slot) => {
              const booked = slot.availability === 'booked';
              const blocked = slot.availability === 'blocked';
              const available = slot.availability === 'available';
              const disabled = booked || busyStart === slot.startTime;
              const nextStatus: 'available' | 'blocked' = blocked ? 'available' : 'blocked';
              return (
                <li
                  key={slot.startTime}
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
                    <strong>{formatTimeRange12h(slot.startTime, slot.endTime)}</strong>
                    <span className="muted" style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                      {booked
                        ? `Booked (${slot.status})`
                        : blocked
                          ? 'Blocked'
                          : 'Available'}
                    </span>
                  </div>
                  <label
                    className="ui-switch"
                    style={{ opacity: booked ? 0.55 : 1, flexShrink: 0 }}
                  >
                    <input
                      type="checkbox"
                      checked={available}
                      disabled={disabled}
                      onChange={() => {
                        if (booked) return;
                        void onToggleSlot(slot.startTime, nextStatus);
                      }}
                    />
                    <span className="ui-switch-track" aria-hidden />
                    <span className="ui-switch-text" style={{ fontSize: '0.8rem' }}>
                      {booked ? 'Booked' : blocked ? 'Blocked' : 'Open'}
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
