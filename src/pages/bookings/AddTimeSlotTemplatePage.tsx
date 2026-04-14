import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createTimeSlotTemplate } from '../../api/saasClient';
import { useSession } from '../../context/SessionContext';

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

function addMinutes(time: string, minutes: number): string {
  const total = toMinutes(time) + minutes;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function isValidTimeLabel(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isHourBoundary(value: string): boolean {
  return value.endsWith(':00');
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

export default function AddTimeSlotTemplatePage() {
  const { tenantId } = useSession();
  const navigate = useNavigate();
  const [newTplName, setNewTplName] = useState('');
  const [newTplLines, setNewTplLines] = useState<DraftSlotLine[]>([]);
  const [tplErr, setTplErr] = useState<string | null>(null);
  const [tplSaving, setTplSaving] = useState(false);

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
      navigate('/app/time-slots');
    } catch (e) {
      setTplErr(e instanceof Error ? e.message : 'Could not save template');
    } finally {
      setTplSaving(false);
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
        <Link to="/app/time-slots" className="btn-ghost btn-compact">
          ← Back to templates
        </Link>
      </p>
      <h1 className="page-title">Add time slot template</h1>
      {!tenantId.trim() && <div className="err-banner">Pick an active tenant in the top bar.</div>}
      {tplErr && <div className="err-banner">{tplErr}</div>}

      <section className="detail-card" style={{ maxWidth: '720px' }}>
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
            {tplSaving ? 'Saving…' : 'Save template'}
          </button>
        </div>
      </section>
    </>
  );
}
