import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  deleteTimeSlotTemplate,
  listTimeSlotTemplates,
  type TimeSlotTemplateRecord,
} from '../../api/saasClient';
import { useSession } from '../../context/SessionContext';
import type { DashboardOutletContext } from '../../layout/ConsoleLayout';
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
  const [templates, setTemplates] = useState<TimeSlotTemplateRecord[]>([]);
  const [tplLoading, setTplLoading] = useState(false);
  const [tplErr, setTplErr] = useState<string | null>(null);
  const [deletingTplId, setDeletingTplId] = useState<string | null>(null);

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

      <section className="detail-card" style={{ width: '100%', maxWidth: '1100px' }}>
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
                      <Link
                        to={`/app/time-slots/${t.id}/edit`}
                        className="btn-ghost btn-compact"
                        style={{ marginRight: '0.45rem' }}
                      >
                        Edit
                      </Link>
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

    </>
  );
}

