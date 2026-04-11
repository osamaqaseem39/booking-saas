import { type FormEvent, useEffect, useMemo, useState } from 'react';
import type { BusinessLocationRow } from '../../types/domain';
import {
  getGamingStation,
  saveGamingStation,
  type GamingStationRecord,
} from '../../utils/gamingStationLocalStore';
import { GamingStationSharedSections } from './GamingStationSharedSections';
import { TurfSetupButtonSelect } from './TurfSetupButtonSelect';
import {
  emptySharedGamingStationFormState,
  mergeSharedIntoRecord,
  recordToSharedFormState,
  type GamingStationSharedFormState,
} from './sharedGamingStationFormState';

const SETUP_CODE = 'gaming-vr' as const;

type VrSpecs = {
  headset: 'quest3' | 'psvr2' | 'index' | 'other';
  playSpace: 'seated' | 'standing' | 'roomscale';
  sanitizationGap: '5' | '10' | '15' | '20';
};

const HEADSET_OPTS: { value: VrSpecs['headset']; label: string }[] = [
  { value: 'quest3', label: 'Quest 3 / similar' },
  { value: 'psvr2', label: 'PS VR2' },
  { value: 'index', label: 'Valve Index' },
  { value: 'other', label: 'Other' },
];

const SPACE_OPTS: { value: VrSpecs['playSpace']; label: string }[] = [
  { value: 'seated', label: 'Seated' },
  { value: 'standing', label: 'Standing' },
  { value: 'roomscale', label: 'Room-scale' },
];

const SAN_OPTS: { value: VrSpecs['sanitizationGap']; label: string }[] = [
  { value: '5', label: '5 min' },
  { value: '10', label: '10 min' },
  { value: '15', label: '15 min' },
  { value: '20', label: '20 min' },
];

function specsFromRecord(specs: Record<string, unknown>): VrSpecs {
  const h = specs.headset;
  const p = specs.playSpace;
  const s = specs.sanitizationGap;
  return {
    headset:
      h === 'quest3' || h === 'psvr2' || h === 'index' || h === 'other'
        ? h
        : 'quest3',
    playSpace:
      p === 'seated' || p === 'standing' || p === 'roomscale'
        ? p
        : 'roomscale',
    sanitizationGap:
      s === '5' || s === '10' || s === '15' || s === '20' ? s : '10',
  };
}

export function GamingVrSetupForm({
  locationId,
  locations,
  onSuccess,
  existingStationId,
}: {
  locationId: string;
  locations: BusinessLocationRow[];
  onSuccess: () => void;
  existingStationId?: string;
}) {
  const [shared, setShared] = useState<GamingStationSharedFormState>(() =>
    emptySharedGamingStationFormState(),
  );
  const [arenaLocationId, setArenaLocationId] = useState(locationId);
  const [specs, setSpecs] = useState<VrSpecs>({
    headset: 'quest3',
    playSpace: 'roomscale',
    sanitizationGap: '10',
  });
  const [hygieneNotes, setHygieneNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!existingStationId);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    if (!existingStationId) {
      setLoading(false);
      setLoadErr(null);
      setShared(emptySharedGamingStationFormState());
      setArenaLocationId(locationId);
      setSpecs({
        headset: 'quest3',
        playSpace: 'roomscale',
        sanitizationGap: '10',
      });
      setHygieneNotes('');
      return;
    }
    void (async () => {
      const row = await getGamingStation(locationId, existingStationId);
      if (!row || row.setupCode !== SETUP_CODE) {
        setLoading(false);
        setLoadErr('Station not found for this location.');
        return;
      }
      setShared(recordToSharedFormState(row));
      setArenaLocationId(row.businessLocationId);
      setSpecs(specsFromRecord(row.specs));
      setHygieneNotes(
        typeof row.specs.hygieneNotes === 'string' ? row.specs.hygieneNotes : '',
      );
      setLoading(false);
      setLoadErr(null);
    })();
  }, [existingStationId, locationId]);

  useEffect(() => {
    if (!existingStationId && locationId) setArenaLocationId(locationId);
  }, [locationId, existingStationId]);

  const locationOptions = useMemo(
    () =>
      [...locations].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      ),
    [locations],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const effectiveLocationId = existingStationId ? arenaLocationId : locationId;
    if (!effectiveLocationId || !shared.name.trim()) return;
    const now = new Date().toISOString();
    const prev =
      existingStationId && effectiveLocationId
        ? await getGamingStation(effectiveLocationId, existingStationId)
        : undefined;
    const record: GamingStationRecord = mergeSharedIntoRecord(
      {
        id: existingStationId ?? '',
        businessLocationId: effectiveLocationId,
        setupCode: SETUP_CODE,
        specs: { ...specs, hygieneNotes: hygieneNotes.trim() },
        createdAt: prev?.createdAt ?? now,
        updatedAt: now,
        name: '',
        unitStatus: 'active',
        description: '',
        isActive: true,
        imageLines: '',
        pricePerSlot: '',
        peakWeekdayEvening: '',
        peakWeekend: '',
        bundleNote: '',
        slotDuration: '60',
        bufferMinutes: '',
        amenSnacksNearby: false,
        amenExtraControllers: false,
        amenStreamingCapture: false,
      },
      shared,
    );
    record.specs = { ...specs, hygieneNotes: hygieneNotes.trim() };
    setSaving(true);
    setErr(null);
    try {
      await saveGamingStation(record);
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loadErr) {
    return <div className="err-banner">{loadErr}</div>;
  }
  if (loading && existingStationId) {
    return <div className="empty-state">Loading station…</div>;
  }

  return (
    <div className="turf-setup-form-wrap">
      <form className="form-grid turf-setup-form" onSubmit={(e) => void onSubmit(e)}>
        {err && <div className="err-banner turf-setup-form-error">{err}</div>}

        <GamingStationSharedSections
          shared={shared}
          setShared={setShared}
          locationOptions={locationOptions}
          arenaLocationId={arenaLocationId}
          setArenaLocationId={setArenaLocationId}
          existingStationId={existingStationId}
        />

        <div className="turf-setup-card">
          <h4>5. VR booth</h4>
          <div className="form-grid">
            <TurfSetupButtonSelect
              label="Headset / platform"
              value={specs.headset}
              options={HEADSET_OPTS}
              onChange={(headset) => setSpecs((s) => ({ ...s, headset }))}
            />
            <TurfSetupButtonSelect
              label="Play space"
              value={specs.playSpace}
              options={SPACE_OPTS}
              onChange={(playSpace) => setSpecs((s) => ({ ...s, playSpace }))}
            />
            <TurfSetupButtonSelect
              label="Sanitization gap between sessions"
              value={specs.sanitizationGap}
              options={SAN_OPTS}
              onChange={(sanitizationGap) =>
                setSpecs((s) => ({ ...s, sanitizationGap }))
              }
            />
            <div>
              <label>Hygiene / face cushion policy</label>
              <textarea
                rows={2}
                value={hygieneNotes}
                onChange={(e) => setHygieneNotes(e.target.value)}
                placeholder="Disposable covers, UV cabinet, staff wipe-down…"
              />
            </div>
          </div>
        </div>

        <div className="turf-setup-form-actions">
          <button type="submit" className="btn-primary btn-primary-lg" disabled={saving}>
            {saving ? 'Saving…' : existingStationId ? 'Save changes' : 'Create VR station'}
          </button>
        </div>
      </form>
    </div>
  );
}
