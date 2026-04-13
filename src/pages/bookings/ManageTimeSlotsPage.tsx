import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  createTimeSlotTemplate,
  deleteTimeSlotTemplate,
  getCourtSlotGrid,
  listCourtOptions,
  listTimeSlotTemplates,
  setCourtSlotBlock,
  type TimeSlotTemplateRecord,
} from '../../api/saasClient';
import { useSession } from '../../context/SessionContext';
import type { DashboardOutletContext } from '../../layout/ConsoleLayout';
import type { BookingSportType, CourtOption, CourtSlotGridSegment } from '../../types/booking';
import { formatTimeRange12h } from '../../utils/timeDisplay';

function segmentBookingAllowed(seg: CourtSlotGridSegment): boolean {
  return seg.state === 'free';
}

function parseSlotStartsInput(text: string): string[] {
  return text
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function ManageTimeSlotsPage() {
  const { tenantId } = useSession();
  const { selectedLocationId } = useOutletContext<DashboardOutletContext>();
  const [sport, setSport] = useState<BookingSportType>('futsal');
  const [courts, setCourts] = useState<CourtOption[]>([]);
  const [facilityKey, setFacilityKey] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [useWorkingHours, setUseWorkingHours] = useState(false);
  const [gridLoading, setGridLoading] = useState(false);
  const [grid, setGrid] = useState<Awaited<ReturnType<typeof getCourtSlotGrid>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [togglingStart, setTogglingStart] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TimeSlotTemplateRecord[]>([]);
  const [tplLoading, setTplLoading] = useState(false);
  const [newTplName, setNewTplName] = useState('');
  const [newTplTimes, setNewTplTimes] = useState('');
  const [tplErr, setTplErr] = useState<string | null>(null);
  const [tplSaving, setTplSaving] = useState(false);
  const [deletingTplId, setDeletingTplId] = useState<string | null>(null);

  const selected = useMemo(
    () => courts.find((c) => `${c.kind}:${c.id}` === facilityKey) ?? null,
    [courts, facilityKey],
  );

  const activeTemplate = useMemo(() => {
    const id = selected?.timeSlotTemplateId;
    if (!id) return null;
    return templates.find((t) => t.id === id) ?? null;
  }, [selected, templates]);

  const displaySegments = useMemo(() => {
    if (!grid) return [];
    const starts = activeTemplate?.slotStarts;
    if (!starts?.length) return grid.segments;
    const set = new Set(starts);
    return grid.segments.filter(
      (s) => set.has(s.startTime) || s.state === 'booked',
    );
  }, [grid, activeTemplate]);

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
    if (!tenantId.trim()) {
      setTemplates([]);
      return;
    }
    let cancelled = false;
    setTplLoading(true);
    void (async () => {
      try {
        const rows = await listTimeSlotTemplates(tenantId);
        if (!cancelled) setTemplates(rows);
      } catch {
        if (!cancelled) setTemplates([]);
      } finally {
        if (!cancelled) setTplLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

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
    if (!selected || seg.state === 'booked' || seg.state === 'closed') return;
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

  async function onSaveTemplate() {
    if (!tenantId.trim()) return;
    const name = newTplName.trim();
    const slotStarts = parseSlotStartsInput(newTplTimes);
    if (!name) {
      setTplErr('Template name is required.');
      return;
    }
    if (!slotStarts.length) {
      setTplErr('Add at least one start time (HH:mm, 30-minute aligned), separated by commas or new lines.');
      return;
    }
    setTplSaving(true);
    setTplErr(null);
    try {
      await createTimeSlotTemplate({ name, slotStarts }, tenantId);
      const rows = await listTimeSlotTemplates(tenantId);
      setTemplates(rows);
      setNewTplName('');
      setNewTplTimes('');
    } catch (e) {
      setTplErr(e instanceof Error ? e.message : 'Could not save template');
    } finally {
      setTplSaving(false);
    }
  }

  async function onDeleteTemplate(id: string) {
    if (!tenantId.trim()) return;
    setDeletingTplId(id);
    setTplErr(null);
    try {
      await deleteTimeSlotTemplate(id, tenantId);
      setTemplates((cur) => cur.filter((t) => t.id !== id));
    } catch (e) {
      setTplErr(e instanceof Error ? e.message : 'Could not delete template');
    } finally {
      setDeletingTplId(null);
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
      {selectedLocationId !== 'all' && (
        <p className="muted" style={{ marginTop: '-0.75rem', marginBottom: '1rem' }}>
          Top bar location filter is active. Showing facilities for the selected location only.
        </p>
      )}

      {!tenantId.trim() && (
        <div className="err-banner">Pick an active tenant in the top bar.</div>
      )}
      {error && <div className="err-banner">{error}</div>}
      {tplErr && <div className="err-banner">{tplErr}</div>}

      <section className="detail-card" style={{ maxWidth: '720px' }}>
        <h3 style={{ marginTop: 0, fontSize: '1.05rem' }}>Time slot templates</h3>
        <p className="muted" style={{ marginBottom: '1rem' }}>
          Templates are reusable lists of half-hour start times. Assign one on each facility under
          slot timing, then this page shows those windows first (plus any bookings outside the
          template).
        </p>
        {tplLoading && <p className="muted">Loading templates…</p>}
        {!tplLoading && templates.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1rem' }}>
            {templates.map((t) => (
              <li
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  padding: '0.4rem 0',
                  borderBottom: '1px solid var(--border-subtle, #2a2f3a)',
                }}
              >
                <span>
                  <strong>{t.name}</strong>
                  <span className="muted" style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                    {t.slotStarts.length} slot{t.slotStarts.length === 1 ? '' : 's'}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn-ghost btn-compact"
                  disabled={!tenantId.trim() || deletingTplId === t.id}
                  onClick={() => void onDeleteTemplate(t.id)}
                >
                  {deletingTplId === t.id ? 'Removing…' : 'Remove'}
                </button>
              </li>
            ))}
          </ul>
        )}
        {!tplLoading && !templates.length && tenantId.trim() && (
          <p className="muted" style={{ marginBottom: '1rem' }}>
            No templates yet. Add one below.
          </p>
        )}
        <div className="form-grid">
          <label>
            <span className="muted" style={{ fontSize: '0.78rem', display: 'block' }}>
              New template name
            </span>
            <input
              value={newTplName}
              onChange={(e) => setNewTplName(e.target.value)}
              placeholder="e.g. Weekday evenings"
              maxLength={120}
            />
          </label>
          <label>
            <span className="muted" style={{ fontSize: '0.78rem', display: 'block' }}>
              Slot start times (HH:mm, 30-minute steps — one per line or comma-separated)
            </span>
            <textarea
              rows={4}
              value={newTplTimes}
              onChange={(e) => setNewTplTimes(e.target.value)}
              placeholder={'16:00\n16:30\n17:00'}
            />
          </label>
          <button
            type="button"
            className="btn-primary"
            disabled={!tenantId.trim() || tplSaving}
            onClick={() => void onSaveTemplate()}
          >
            {tplSaving ? 'Saving…' : 'Add time slot template'}
          </button>
        </div>
      </section>

      <section className="detail-card" style={{ maxWidth: '720px', marginTop: '1rem' }}>
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
            <span className="ui-switch-text">Apply working-hours overlay (info)</span>
          </label>
        </div>
      </section>

      <section className="detail-card" style={{ maxWidth: '720px', marginTop: '1rem' }}>
        {activeTemplate && (
          <p className="muted" style={{ marginBottom: '0.75rem' }}>
            Facility uses template <strong>{activeTemplate.name}</strong>. Showing template starts
            plus any booked intervals outside the template.
          </p>
        )}
        {gridLoading && <p className="muted">Loading slot grid…</p>}
        {!gridLoading && grid?.locationClosed && (
          <p className="muted">
            Working-hours overlay marks this date as closed. This is informational only; actual
            booking availability is controlled by slot blocks/bookings.
          </p>
        )}
        {!gridLoading && grid && !grid.locationClosed && grid.segments.length === 0 && (
          <p className="muted">No segments in the grid for this selection.</p>
        )}
        {!gridLoading &&
          grid &&
          !grid.locationClosed &&
          displaySegments.length === 0 &&
          grid.segments.length > 0 &&
          activeTemplate && (
            <p className="muted">
              No segments match this template for the current overlay. Try turning off the
              working-hours overlay or adjust the template times.
            </p>
          )}
        {!gridLoading && grid && displaySegments.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {displaySegments.map((seg) => {
              const busy = seg.state === 'booked';
              const dayClosed = seg.state === 'closed';
              const allowed = !busy && !dayClosed && segmentBookingAllowed(seg);
              const disabled = busy || dayClosed || togglingStart === seg.startTime;
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
                    {dayClosed && (
                      <span className="muted" style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                        Closed (working-hours info)
                      </span>
                    )}
                    {!busy && !dayClosed && seg.state === 'blocked' && (
                      <span className="muted" style={{ marginLeft: '0.5rem', fontSize: '0.85rem' }}>
                        Booking off
                      </span>
                    )}
                  </div>
                  <label
                    className="ui-switch"
                    style={{ opacity: busy || dayClosed ? 0.55 : 1, flexShrink: 0 }}
                  >
                    <input
                      type="checkbox"
                      checked={allowed}
                      disabled={disabled}
                      onChange={() => void onToggleSegment(seg)}
                    />
                    <span className="ui-switch-track" aria-hidden />
                    <span className="ui-switch-text" style={{ fontSize: '0.8rem' }}>
                      {busy ? 'Booked' : dayClosed ? 'Closed' : 'Booking on'}
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

