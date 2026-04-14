import { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  deleteTimeSlotTemplate,
  listCourtOptions,
  listTimeSlotTemplates,
  type TimeSlotTemplateRecord,
} from '../../api/saasClient';
import { useSession } from '../../context/SessionContext';
import type { DashboardOutletContext } from '../../layout/ConsoleLayout';
import type { BookingSportType, CourtOption } from '../../types/booking';
import { formatTimeRange12h } from '../../utils/timeDisplay';

function toMinutes(time: string): number {
  const [hRaw, mRaw] = time.split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  return h * 60 + m;
}

function addMinutes(time: string, minutes: number): string {
  const total = toMinutes(time) + minutes;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export default function ManageTimeSlotsPage() {
  const { tenantId } = useSession();
  const { selectedLocationId } = useOutletContext<DashboardOutletContext>();
  const [sport, setSport] = useState<BookingSportType>('futsal');
  const [courts, setCourts] = useState<CourtOption[]>([]);
  const [facilityKey, setFacilityKey] = useState('');
  const [templates, setTemplates] = useState<TimeSlotTemplateRecord[]>([]);
  const [tplLoading, setTplLoading] = useState(false);
  const [tplErr, setTplErr] = useState<string | null>(null);
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

  useEffect(() => {
    if (!selected?.timeSlotTemplateId) return;
    if (templates.some((t) => t.id === selected.timeSlotTemplateId)) return;
    void (async () => {
      try {
        const rows = await listTimeSlotTemplates(tenantId);
        setTemplates(rows);
      } catch {
        // Keep current state; page already handles missing template gracefully.
      }
    })();
  }, [selected, templates, tenantId]);

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
        View and manage reusable time-slot templates. Use the add button to open the separate form
        page for creating a new template.
      </p>
      {selectedLocationId !== 'all' && (
        <p className="muted" style={{ marginTop: '-0.75rem', marginBottom: '1rem' }}>
          Top bar location filter is active. Showing facilities for the selected location only.
        </p>
      )}

      {!tenantId.trim() && (
        <div className="err-banner">Pick an active tenant in the top bar.</div>
      )}
      {tplErr && <div className="err-banner">{tplErr}</div>}

      <section className="detail-card" style={{ maxWidth: '720px' }}>
        <h3 style={{ marginTop: 0, fontSize: '1.05rem' }}>Time slot templates</h3>
        <div className="page-actions-row" style={{ marginBottom: '0.8rem' }}>
          <Link to="/app/time-slots/new" className="btn-primary">
            Add time slot template
          </Link>
        </div>
        {tplLoading && <p className="muted">Loading templates…</p>}
        {!tplLoading && templates.length > 0 && (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Template name</th>
                  <th>Total slots</th>
                  <th>Preview</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{t.slotStarts.length}</td>
                    <td>
                      {t.slotStarts
                        .slice(0, 3)
                        .map((start) => formatTimeRange12h(start, addMinutes(start, 60)))
                        .join(' · ')}
                      {t.slotStarts.length > 3 ? ` · +${t.slotStarts.length - 3} more` : ''}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-ghost btn-compact"
                        disabled={!tenantId.trim() || deletingTplId === t.id}
                        onClick={() => void onDeleteTemplate(t.id)}
                      >
                        {deletingTplId === t.id ? 'Removing…' : 'Remove'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!tplLoading && !templates.length && tenantId.trim() && (
          <p className="muted" style={{ marginBottom: '1rem' }}>
            No templates yet. Click "Add time slot template" to create one.
          </p>
        )}
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
        </div>
      </section>

      <section className="detail-card" style={{ maxWidth: '720px', marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0, fontSize: '1rem' }}>Template slots for selected facility</h3>
        {!selected && <p className="muted">Select a facility to view its template slots.</p>}
        {selected && !activeTemplate && (
          <p className="muted">
            No template is assigned to this facility yet. Assign one in the facility setup.
          </p>
        )}
        {selected && activeTemplate && (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              Showing template: <strong>{activeTemplate.name}</strong>
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {activeTemplate.slotStarts.map((start) => (
                <li
                  key={start}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    padding: '0.45rem 0',
                    borderBottom: '1px solid var(--border-subtle, #2a2f3a)',
                  }}
                >
                  <strong>{formatTimeRange12h(start, addMinutes(start, 60))}</strong>
                  <span className="muted" style={{ fontSize: '0.85rem' }}>
                    Template slot
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

    </>
  );
}

