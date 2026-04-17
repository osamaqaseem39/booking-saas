import { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  deleteTimeSlotTemplate,
  listTimeSlotTemplates,
  type TimeSlotTemplateRecord,
} from '../../api/saasClient';
import { useSession } from '../../context/SessionContext';
import type { DashboardOutletContext } from '../../layout/ConsoleLayout';
import { formatTime12h, formatTimeRange12h } from '../../utils/timeDisplay';

function toMinutes(time: string): number {
  const [hRaw, mRaw] = time.split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  return h * 60 + m;
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
        <div className="err-banner">No active tenant found. Select a business from the businesses page to manage its slots.</div>
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
                  <th>Statuses</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id}>
                    <td>{t.name}</td>
                    <td>{t.slotLines?.length ?? t.slotStarts.length}</td>
                    <td>
                      {(t.slotLines && t.slotLines.length > 0
                        ? t.slotLines
                            .slice()
                            .sort((a, b) => a.sortOrder - b.sortOrder)
                            .slice(0, 3)
                            .map((line) => formatTimeRange12h(line.startTime, line.endTime))
                        : t.slotStarts
                            .slice(0, 3)
                            .sort((a, b) => toMinutes(a) - toMinutes(b))
                            .map((start) => formatTime12h(start))
                      ).join(' · ')}
                      {(t.slotLines?.length ?? t.slotStarts.length) > 3
                        ? ` · +${(t.slotLines?.length ?? t.slotStarts.length) - 3} more`
                        : ''}
                    </td>
                    <td>
                      {t.slotLines && t.slotLines.length > 0 ? (
                        <>
                          {t.slotLines.filter((line) => line.status === 'available').length}{' '}
                          available ·{' '}
                          {t.slotLines.filter((line) => line.status === 'blocked').length} blocked
                        </>
                      ) : (
                        <span className="muted">Default available</span>
                      )}
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

