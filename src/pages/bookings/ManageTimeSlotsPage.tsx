import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  createTimeSlotTemplate,
  deleteTimeSlotTemplate,
  listCourtOptions,
  listTimeSlotTemplates,
  type TimeSlotTemplateRecord,
} from '../../api/saasClient';
import { useSession } from '../../context/SessionContext';
import type { DashboardOutletContext } from '../../layout/ConsoleLayout';
import type { BookingSportType, CourtOption } from '../../types/booking';
import { formatTimeRange12h } from '../../utils/timeDisplay';

type DraftSlotLine = {
  id: string;
  startTime: string;
  endTime: string;
};

function toMinutes(time: string): number {
  const [hRaw, mRaw] = time.split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  return h * 60 + m;
}

function isValidTimeLabel(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isHourBoundary(value: string): boolean {
  return value.endsWith(':00');
}

function addMinutes(time: string, minutes: number): string {
  const total = toMinutes(time) + minutes;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function deriveSlotStartsFromLines(lines: DraftSlotLine[]): string[] {
  const unique = new Set(lines.map((line) => line.startTime));
  return [...unique].sort((a, b) => toMinutes(a) - toMinutes(b));
}

function makeSlotLine(): DraftSlotLine {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startTime: '',
    endTime: '',
  };
}

export default function ManageTimeSlotsPage() {
  const { tenantId } = useSession();
  const { selectedLocationId } = useOutletContext<DashboardOutletContext>();
  const [sport, setSport] = useState<BookingSportType>('futsal');
  const [courts, setCourts] = useState<CourtOption[]>([]);
  const [facilityKey, setFacilityKey] = useState('');
  const [templates, setTemplates] = useState<TimeSlotTemplateRecord[]>([]);
  const [tplLoading, setTplLoading] = useState(false);
  const [newTplName, setNewTplName] = useState('');
  const [newTplLines, setNewTplLines] = useState<DraftSlotLine[]>([]);
  const [tplErr, setTplErr] = useState<string | null>(null);
  const [tplSaving, setTplSaving] = useState(false);
  const [deletingTplId, setDeletingTplId] = useState<string | null>(null);

  const selected = useMemo(
    () => courts.find((c) => `${c.kind}:${c.id}` === facilityKey) ?? null,
    [courts, facilityKey],
  );

  const loadCourts = useCallback(async () => {
    if (!tenantId.trim()) {
      setCourts([]);
      return;
    }
    try {
      const rows = await listCourtOptions(
        sport,
        selectedLocationId === 'all' ? undefined : selectedLocationId,
      );
      setCourts(rows);
    } catch {
      setCourts([]);
    }
  }, [sport, tenantId, selectedLocationId]);

  const activeTemplate = useMemo(() => {
    const id = selected?.timeSlotTemplateId;
    if (!id) return null;
    return templates.find((t) => t.id === id) ?? null;
  }, [selected, templates]);

  useEffect(() => {
    setFacilityKey('');
  }, [sport]);

  useEffect(() => {
    void loadCourts();
  }, [loadCourts]);

  useEffect(() => {
    const onFocus = () => {
      void loadCourts();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [loadCourts]);

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

  async function onSaveTemplate() {
    if (!tenantId.trim()) return;
    const name = newTplName.trim();
    const invalidLine = newTplLines.find((line) => {
      if (!line.startTime || !line.endTime) return true;
      if (!isValidTimeLabel(line.startTime) || !isValidTimeLabel(line.endTime)) return true;
      if (!isHourBoundary(line.startTime) || !isHourBoundary(line.endTime)) return true;
      if (toMinutes(line.endTime) <= toMinutes(line.startTime)) return true;
      return line.endTime !== addMinutes(line.startTime, 60);
    });
    if (invalidLine) {
      setTplErr(
        'Each child line must include valid start/end times on the hour, and each slot must be exactly 1 hour.',
      );
      return;
    }
    const slotStarts = deriveSlotStartsFromLines(newTplLines);
    if (!name) {
      setTplErr('Template name is required.');
      return;
    }
    if (!slotStarts.length) {
      setTplErr('Add at least one slot line first.');
      return;
    }
    setTplSaving(true);
    setTplErr(null);
    try {
      await createTimeSlotTemplate({ name, slotStarts }, tenantId);
      const rows = await listTimeSlotTemplates(tenantId);
      setTemplates(rows);
      setNewTplName('');
      setNewTplLines([]);
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

  function onAddSlotLine() {
    setTplErr(null);
    setNewTplLines((cur) => [...cur, makeSlotLine()]);
  }

  function onRemoveSlotLine(id: string) {
    setTplErr(null);
    setNewTplLines((cur) => cur.filter((line) => line.id !== id));
  }

  function onChangeSlotLine(id: string, patch: Partial<Pick<DraftSlotLine, 'startTime' | 'endTime'>>) {
    setTplErr(null);
    setNewTplLines((cur) =>
      cur.map((line) => {
        if (line.id !== id) return line;
        return { ...line, ...patch };
      }),
    );
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
        Turn booking on or off per hourly window for a facility. Booked slots cannot be toggled
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
      {tplErr && <div className="err-banner">{tplErr}</div>}

      <section className="detail-card" style={{ maxWidth: '720px' }}>
        <h3 style={{ marginTop: 0, fontSize: '1.05rem' }}>Time slot templates</h3>
        <p className="muted" style={{ marginBottom: '1rem' }}>
          Templates are reusable lists of hourly start times. Assign one on each facility under
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
                  <div className="muted" style={{ marginTop: '0.2rem' }}>
                    {t.slotStarts
                      .slice(0, 3)
                      .map((start) => formatTimeRange12h(start, addMinutes(start, 60)))
                      .join(' · ')}
                    {t.slotStarts.length > 3 ? ` · +${t.slotStarts.length - 3} more` : ''}
                  </div>
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
              Parent template name
            </span>
            <input
              value={newTplName}
              onChange={(e) => setNewTplName(e.target.value)}
              placeholder="e.g. Weekday evenings"
              maxLength={120}
            />
          </label>
          <div
            style={{
              border: '1px solid var(--border-subtle, #2a2f3a)',
              borderRadius: '10px',
              padding: '0.75rem',
            }}
          >
            <p className="muted" style={{ marginTop: 0, marginBottom: '0.6rem' }}>
              Child slot lines (start time / end time)
            </p>
            {newTplLines.length > 0 && (
              <div className="form-grid">
                {newTplLines.map((line, idx) => (
                  <div
                    key={line.id}
                    style={{
                      border: '1px solid var(--border-subtle, #2a2f3a)',
                      borderRadius: '8px',
                      padding: '0.65rem',
                    }}
                  >
                    <div className="form-row-2">
                      <label>
                        <span className="muted" style={{ fontSize: '0.78rem', display: 'block' }}>
                          Child #{idx + 1} start time
                        </span>
                        <input
                          type="time"
                          step={3600}
                          value={line.startTime}
                          onChange={(e) =>
                            onChangeSlotLine(line.id, { startTime: e.target.value })
                          }
                        />
                      </label>
                      <label>
                        <span className="muted" style={{ fontSize: '0.78rem', display: 'block' }}>
                          Child #{idx + 1} end time
                        </span>
                        <input
                          type="time"
                          step={3600}
                          value={line.endTime}
                          onChange={(e) =>
                            onChangeSlotLine(line.id, { endTime: e.target.value })
                          }
                        />
                      </label>
                    </div>
                    <div className="page-actions-row" style={{ marginTop: '0.35rem' }}>
                      <button
                        type="button"
                        className="btn-ghost btn-compact"
                        onClick={() => onRemoveSlotLine(line.id)}
                      >
                        Remove child line
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="page-actions-row" style={{ marginTop: '0.6rem' }}>
              <button
                type="button"
                className="btn-ghost btn-compact"
                disabled={!tenantId.trim() || tplSaving}
                onClick={onAddSlotLine}
              >
                Add child line
              </button>
              {newTplLines.length > 0 && (
                <span className="muted">{newTplLines.length} child line(s)</span>
              )}
            </div>
          </div>
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

