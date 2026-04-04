import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createCricketCourt,
  getCricketCourt,
  updateCricketCourt,
  type CreateCricketCourtBody,
  type CricketCourtDetail,
} from '../api/saasClient';
import type { BusinessLocationRow } from '../types/domain';

function parseNum(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function parseIntOpt(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) ? n : undefined;
}

function strFromApi(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

export function CricketCourtSetupForm({
  locationId,
  locations,
  onSuccess,
  existingCourtId,
}: {
  locationId: string;
  locations: BusinessLocationRow[];
  onSuccess: () => void;
  existingCourtId?: string;
}) {
  const [name, setName] = useState('');
  const [arenaLocationId, setArenaLocationId] = useState(locationId);
  const [courtStatus, setCourtStatus] = useState<'active' | 'maintenance'>(
    'active',
  );
  const [cricketFormat, setCricketFormat] = useState<
    'tape_ball' | 'tennis_ball' | 'hard_ball' | ''
  >('');
  const [pricePerSlot, setPricePerSlot] = useState('');
  const [slotDuration, setSlotDuration] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(!!existingCourtId);
  const [initialLoadError, setInitialLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!existingCourtId) {
      setLoadingDetail(false);
      setInitialLoadError(null);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    void (async () => {
      try {
        const d: CricketCourtDetail = await getCricketCourt(existingCourtId);
        if (cancelled) return;
        setName(d.name ?? '');
        setArenaLocationId(d.businessLocationId ?? locationId);
        setCourtStatus(d.courtStatus === 'maintenance' ? 'maintenance' : 'active');
        const cf = d.cricketFormat;
        setCricketFormat(
          cf === 'tape_ball' || cf === 'tennis_ball' || cf === 'hard_ball'
            ? cf
            : '',
        );
        setPricePerSlot(strFromApi(d.pricePerSlot));
        setSlotDuration(strFromApi(d.slotDurationMinutes));
      } catch (e) {
        if (!cancelled) {
          setInitialLoadError(
            e instanceof Error ? e.message : 'Failed to load court',
          );
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [existingCourtId, locationId]);

  const locationOptions = useMemo(
    () =>
      [...locations].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      ),
    [locations],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const effectiveLocationId = existingCourtId ? arenaLocationId : locationId;
    if (!effectiveLocationId || !name.trim()) return;
    const arena = locations.find((l) => l.id === arenaLocationId);
    const slotM = parseIntOpt(slotDuration);
    if (
      slotM !== undefined &&
      (slotM < 60 || slotM % 30 !== 0)
    ) {
      setErr('Slot duration must be at least 60 and in 30-minute intervals.');
      return;
    }
    const body: CreateCricketCourtBody = {
      businessLocationId: effectiveLocationId,
      name: name.trim(),
      courtStatus,
      arenaLabel: arena?.name?.trim() || undefined,
      cricketFormat: cricketFormat || undefined,
      pricePerSlot: parseNum(pricePerSlot),
      slotDurationMinutes: slotM,
    };
    setSaving(true);
    setErr(null);
    try {
      if (existingCourtId) {
        const { businessLocationId: _b, ...patch } = body;
        await updateCricketCourt(existingCourtId, patch);
      } else {
        await createCricketCourt(body);
      }
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (initialLoadError) {
    return <div className="err-banner">{initialLoadError}</div>;
  }
  if (loadingDetail && existingCourtId) {
    return <div className="empty-state">Loading court…</div>;
  }

  return (
    <form className="form-grid turf-setup-form" onSubmit={(e) => void onSubmit(e)}>
      {err && <div className="err-banner">{err}</div>}
      <div className="turf-setup-card">
        <h4>Cricket pitch</h4>
        <div className="form-grid">
          <div>
            <label>Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={160}
            />
          </div>
          <div>
            <label>Location</label>
            <select
              value={arenaLocationId}
              onChange={(e) => setArenaLocationId(e.target.value)}
              disabled={!!existingCourtId}
            >
              {locationOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Status</label>
            <select
              value={courtStatus}
              onChange={(e) =>
                setCourtStatus(e.target.value as 'active' | 'maintenance')
              }
            >
              <option value="active">Active</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
          <div>
            <label>Ball format</label>
            <select
              value={cricketFormat}
              onChange={(e) =>
                setCricketFormat(e.target.value as typeof cricketFormat)
              }
            >
              <option value="">—</option>
              <option value="tape_ball">Tape ball</option>
              <option value="tennis_ball">Tennis ball</option>
              <option value="hard_ball">Hard ball</option>
            </select>
          </div>
          <div>
            <label>Price per slot</label>
            <input
              value={pricePerSlot}
              onChange={(e) => setPricePerSlot(e.target.value)}
              inputMode="decimal"
            />
          </div>
          <div>
            <label>Slot duration (minutes)</label>
            <input
              value={slotDuration}
              onChange={(e) => setSlotDuration(e.target.value)}
              placeholder="60, 90, …"
            />
          </div>
        </div>
      </div>
      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? 'Saving…' : existingCourtId ? 'Save changes' : 'Create'}
      </button>
    </form>
  );
}
