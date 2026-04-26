import { type FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createTableTennisCourt,
  getTableTennisCourt,
  listTimeSlotTemplates,
  updateTableTennisCourt,
  type CreateTableTennisCourtBody,
  type TableTennisCourtDetail,
} from '../../../api/saasClient';
import type { BusinessLocationRow } from '../../../types/domain';

function parseNum(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

type Props = {
  locationId: string;
  locations: BusinessLocationRow[];
  existingCourtId?: string;
  onSuccess: () => void;
};

export function TableTennisCourtSetupForm({
  locationId,
  locations,
  existingCourtId,
  onSuccess,
}: Props) {
  const isUpdate = Boolean(existingCourtId);
  const [name, setName] = useState('Table 1');
  const [description, setDescription] = useState('');
  const [pricePerSlot, setPricePerSlot] = useState('');
  const [courtStatus, setCourtStatus] = useState<'active' | 'maintenance' | 'draft'>('active');
  const [isActive, setIsActive] = useState(true);
  const [timeSlotTemplateId, setTimeSlotTemplateId] = useState('');
  const [slotDuration, setSlotDuration] = useState<'60' | ''>('60');
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const list = await listTimeSlotTemplates();
      setTemplates(
        (list || []).map((t) => ({ id: t.id, name: t.name })),
      );
    })();
  }, []);

  useEffect(() => {
    if (!isUpdate || !existingCourtId) return;
    void (async () => {
      try {
        const c: TableTennisCourtDetail = await getTableTennisCourt(
          existingCourtId,
        );
        setName(c.name || 'Table 1');
        setDescription(c.description || '');
        setPricePerSlot(
          c.pricePerSlot != null && String(c.pricePerSlot).trim() !== ''
            ? String(c.pricePerSlot)
            : '',
        );
        if (c.courtStatus) setCourtStatus(c.courtStatus);
        if (c.isActive !== undefined) setIsActive(c.isActive);
        if (c.timeSlotTemplateId) setTimeSlotTemplateId(c.timeSlotTemplateId);
        if (c.slotDurationMinutes === 60) setSlotDuration('60');
      } catch {
        setErr('Failed to load table');
      }
    })();
  }, [existingCourtId, isUpdate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      const body: CreateTableTennisCourtBody = {
        businessLocationId: locationId,
        name: name.trim(),
        description: description.trim() || undefined,
        pricePerSlot: parseNum(pricePerSlot),
        courtStatus,
        isActive,
        slotDurationMinutes: slotDuration === '60' ? 60 : undefined,
        timeSlotTemplateId: timeSlotTemplateId || null,
      };
      if (isUpdate && existingCourtId) {
        await updateTableTennisCourt(existingCourtId, body);
      } else {
        await createTableTennisCourt(body);
      }
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="turf-setup-form">
      <p className="muted">
        <Link to="/app/Facilities" className="link-muted">
          ← Back
        </Link>
      </p>
      {err && <div className="err-banner">{err}</div>}

      <label className="form-field">
        <span>Table name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={160}
        />
      </label>

      <label className="form-field">
        <span>Description (optional)</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </label>

      <label className="form-field">
        <span>Price per hour (PKR)</span>
        <input
          type="text"
          inputMode="decimal"
          value={pricePerSlot}
          onChange={(e) => setPricePerSlot(e.target.value)}
        />
      </label>

      <label className="form-field">
        <span>Status</span>
        <select
          value={courtStatus}
          onChange={(e) =>
            setCourtStatus(e.target.value as typeof courtStatus)
          }
        >
          <option value="active">active</option>
          <option value="draft">draft</option>
          <option value="maintenance">maintenance</option>
        </select>
      </label>

      <label className="form-check">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
        <span>Active (bookable when status is active)</span>
      </label>

      <label className="form-field">
        <span>Slot length</span>
        <select
          value={slotDuration}
          onChange={(e) => setSlotDuration(e.target.value as '60' | '')}
        >
          <option value="60">60 minutes (default)</option>
        </select>
      </label>

      <label className="form-field">
        <span>Time slot template (optional)</span>
        <select
          value={timeSlotTemplateId}
          onChange={(e) => setTimeSlotTemplateId(e.target.value)}
        >
          <option value="">— None (hourly grid) —</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <input type="hidden" name="location" value={locationId} readOnly />
      {locations.length > 0 && (
        <p className="muted" style={{ fontSize: '0.85rem' }}>
          Location:{' '}
          <strong>
            {locations.find((l) => l.id === locationId)?.name ?? locationId}
          </strong>
        </p>
      )}

      <div className="form-actions">
        <button type="submit" className="btn-primary" disabled={saving}>
          {saving ? 'Saving…' : isUpdate ? 'Update table' : 'Create table'}
        </button>
      </div>
    </form>
  );
}
