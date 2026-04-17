import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  createTimeSlotTemplate,
  listTimeSlotTemplates,
  updateTimeSlotTemplate,
} from '../../api/saasClient';
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

function deriveSlotStartsFromLines(lines: DraftSlotLine[]): string[] {
  const unique = new Set(lines.map((line) => line.startTime));
  return [...unique].sort((a, b) => toMinutes(a) - toMinutes(b));
}

function makeSlotLine(seed?: Partial<Pick<DraftSlotLine, 'startTime' | 'endTime'>>): DraftSlotLine {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startTime: seed?.startTime ?? '',
    endTime: seed?.endTime ?? '',
  };
}

export default function AddTimeSlotTemplatePage() {
  const { tenantId } = useSession();
  const navigate = useNavigate();
  const { templateId } = useParams<{ templateId: string }>();
  const isEdit = !!templateId;
  const [newTplName, setNewTplName] = useState('');
  const [newTplLines, setNewTplLines] = useState<DraftSlotLine[]>([]);
  const [tplErr, setTplErr] = useState<string | null>(null);
  const [tplSaving, setTplSaving] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [generatorStartTime, setGeneratorStartTime] = useState('09:00');
  const [generatorEndTime, setGeneratorEndTime] = useState('18:00');
  const [generatorDuration, setGeneratorDuration] = useState<'30' | '60'>('60');

  const pageTitle = useMemo(
    () => (isEdit ? 'Edit time slot template' : 'Add time slot template'),
    [isEdit],
  );

  useEffect(() => {
    if (!isEdit || !templateId || !tenantId.trim()) return;
    let cancelled = false;
    setLoadingTemplate(true);
    void (async () => {
      try {
        const rows = await listTimeSlotTemplates(tenantId);
        const row = rows.find((x) => x.id === templateId);
        if (!row) {
          if (!cancelled) setTplErr('Template not found.');
          return;
        }
        if (cancelled) return;
        setNewTplName(row.name);
        const linesSource =
          row.slotLines && row.slotLines.length > 0
            ? row.slotLines.map((line) => ({
                startTime: line.startTime,
                endTime: line.endTime,
              }))
            : row.slotStarts.map((startTime) => ({
                startTime,
                endTime: addMinutes(startTime, 60),
              }));
        setNewTplLines(linesSource.map((line) => makeSlotLine(line)));
      } catch (e) {
        if (!cancelled) setTplErr(e instanceof Error ? e.message : 'Failed to load template');
      } finally {
        if (!cancelled) setLoadingTemplate(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, templateId, tenantId]);

  async function onSaveTemplate() {
    if (!tenantId.trim()) return;
    const name = newTplName.trim();
    const invalidLine = newTplLines.find((line) => {
      if (!line.startTime || !line.endTime) return true;
      if (!isValidTimeLabel(line.startTime) || !isValidTimeLabel(line.endTime)) return true;
      if (toMinutes(line.endTime) <= toMinutes(line.startTime)) return true;
      return false;
    });
    if (invalidLine) {
      setTplErr('Each child line must include valid start/end times, with end after start.');
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
      if (isEdit && templateId) {
        const payload = { name, slotStarts };
        await updateTimeSlotTemplate(templateId, payload, tenantId);
      } else {
        const payload = { name, slotStarts };
        await createTimeSlotTemplate(payload, tenantId);
      }
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

  function onGenerateSlotLines() {
    setTplErr(null);
    if (!isValidTimeLabel(generatorStartTime) || !isValidTimeLabel(generatorEndTime)) {
      setTplErr('Pick valid start and end times for slot generation.');
      return;
    }
    const duration = Number(generatorDuration);
    const startMinutes = toMinutes(generatorStartTime);
    const endMinutes = toMinutes(generatorEndTime);
    if (endMinutes <= startMinutes) {
      setTplErr('End time must be after start time.');
      return;
    }
    const totalMinutes = endMinutes - startMinutes;
    if (totalMinutes < duration) {
      setTplErr('Selected range is too short for the chosen slot duration.');
      return;
    }
    if (totalMinutes % duration !== 0) {
      setTplErr(
        `Range must divide evenly by ${duration} minutes so slots fit exactly between start and end.`,
      );
      return;
    }
    const generated: DraftSlotLine[] = [];
    for (let cursor = startMinutes; cursor + duration <= endMinutes; cursor += duration) {
      const startTime = `${String(Math.floor(cursor / 60)).padStart(2, '0')}:${String(cursor % 60).padStart(2, '0')}`;
      const endTime = `${String(Math.floor((cursor + duration) / 60)).padStart(2, '0')}:${String((cursor + duration) % 60).padStart(2, '0')}`;
      generated.push(makeSlotLine({ startTime, endTime }));
    }
    setNewTplLines((cur) => {
      const existingPairs = new Set(cur.map((line) => `${line.startTime}-${line.endTime}`));
      const fresh = generated.filter(
        (line) => !existingPairs.has(`${line.startTime}-${line.endTime}`),
      );
      return [...cur, ...fresh];
    });
  }

  return (
    <>
      <p className="page-toolbar">
        <Link to="/app/time-slots" className="btn-ghost btn-compact">
          ← Back to templates
        </Link>
      </p>
      <h1 className="page-title">{pageTitle}</h1>
      {!tenantId.trim() && <div className="err-banner">No active tenant found. Select a business from the businesses page to manage its slots.</div>}
      {tplErr && <div className="err-banner">{tplErr}</div>}
      {loadingTemplate && <p className="muted">Loading template…</p>}

      <section className="detail-card" style={{ maxWidth: '1024px' }}>
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
              Slot generator
            </p>
            <div className="form-grid" style={{ marginBottom: '0.8rem' }}>
              <div className="form-row-2">
                <label>
                  <span className="muted" style={{ fontSize: '0.78rem', display: 'block' }}>
                    Start time
                  </span>
                  <input
                    type="time"
                    step={1800}
                    value={generatorStartTime}
                    onChange={(e) => setGeneratorStartTime(e.target.value)}
                  />
                </label>
                <label>
                  <span className="muted" style={{ fontSize: '0.78rem', display: 'block' }}>
                    End time
                  </span>
                  <input
                    type="time"
                    step={1800}
                    value={generatorEndTime}
                    onChange={(e) => setGeneratorEndTime(e.target.value)}
                  />
                </label>
              </div>
              <div className="form-row-2">
                <label>
                  <span className="muted" style={{ fontSize: '0.78rem', display: 'block' }}>
                    Slot duration
                  </span>
                  <select
                    value={generatorDuration}
                    onChange={(e) =>
                      setGeneratorDuration(e.target.value === '30' ? '30' : '60')
                    }
                  >
                    <option value="30">30 minutes</option>
                    <option value="60">60 minutes</option>
                  </select>
                </label>
                <div className="page-actions-row" style={{ alignItems: 'end' }}>
                  <button
                    type="button"
                    className="btn-ghost btn-compact"
                    disabled={!tenantId.trim() || tplSaving || loadingTemplate}
                    onClick={onGenerateSlotLines}
                  >
                    Generate slots
                  </button>
                </div>
              </div>
            </div>
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
                          step={1800}
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
                          step={1800}
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
            disabled={!tenantId.trim() || tplSaving || loadingTemplate}
            onClick={() => void onSaveTemplate()}
          >
            {tplSaving ? 'Saving…' : isEdit ? 'Update template' : 'Save template'}
          </button>
        </div>
      </section>
    </>
  );
}
