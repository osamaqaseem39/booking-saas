import { type FormEvent, useEffect, useMemo, useState } from 'react';
import type { BusinessLocationRow } from '../../../types/domain';
import {
  getGamingStation,
  saveGamingStation,
  type GamingStationRecord,
} from '../../../utils/gamingStationLocalStore';
import { GamingStationSharedSections } from './GamingStationSharedSections';
import { TurfSetupButtonSelect } from './TurfSetupButtonSelect';
import {
  emptySharedGamingStationFormState,
  mergeSharedIntoRecord,
  recordToSharedFormState,
  type GamingStationSharedFormState,
} from './sharedGamingStationFormState';

const SETUP_CODE = 'gaming-steering-sim' as const;

type SimSpecs = {
  wheelTier: 'entry' | 'mid' | 'pro';
  shifter: 'none' | 'h-pattern' | 'sequential';
  rigMotion: 'static' | 'seat-mover' | 'full-motion';
  primaryPlatform: 'pc' | 'console' | 'both';
};

const WHEEL_OPTS: { value: SimSpecs['wheelTier']; label: string }[] = [
  { value: 'entry', label: 'Entry' },
  { value: 'mid', label: 'Mid' },
  { value: 'pro', label: 'Pro / direct drive' },
];

const SHIFT_OPTS: { value: SimSpecs['shifter']; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'h-pattern', label: 'H-pattern' },
  { value: 'sequential', label: 'Sequential' },
];

const RIG_OPTS: { value: SimSpecs['rigMotion']; label: string }[] = [
  { value: 'static', label: 'Static rig' },
  { value: 'seat-mover', label: 'Seat mover' },
  { value: 'full-motion', label: 'Full motion' },
];

const PLAT_OPTS: { value: SimSpecs['primaryPlatform']; label: string }[] = [
  { value: 'pc', label: 'PC' },
  { value: 'console', label: 'Console' },
  { value: 'both', label: 'Both' },
];

function specsFromRecord(specs: Record<string, unknown>): SimSpecs {
  const w = specs.wheelTier;
  const sh = specs.shifter;
  const r = specs.rigMotion;
  const p = specs.primaryPlatform;
  return {
    wheelTier: w === 'entry' || w === 'mid' || w === 'pro' ? w : 'mid',
    shifter:
      sh === 'none' || sh === 'h-pattern' || sh === 'sequential'
        ? sh
        : 'h-pattern',
    rigMotion:
      r === 'static' || r === 'seat-mover' || r === 'full-motion'
        ? r
        : 'static',
    primaryPlatform:
      p === 'pc' || p === 'console' || p === 'both' ? p : 'pc',
  };
}

export function GamingSteeringSimSetupForm({
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
  const [specs, setSpecs] = useState<SimSpecs>({
    wheelTier: 'mid',
    shifter: 'h-pattern',
    rigMotion: 'static',
    primaryPlatform: 'pc',
  });
  const [cockpitNotes, setCockpitNotes] = useState('');
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
        wheelTier: 'mid',
        shifter: 'h-pattern',
        rigMotion: 'static',
        primaryPlatform: 'pc',
      });
      setCockpitNotes('');
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
      setCockpitNotes(
        typeof row.specs.cockpitNotes === 'string' ? row.specs.cockpitNotes : '',
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
        specs: { ...specs, cockpitNotes: cockpitNotes.trim() },
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
    record.specs = { ...specs, cockpitNotes: cockpitNotes.trim() };
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
          <h4>5. Simulator rig</h4>
          <div className="form-grid">
            <TurfSetupButtonSelect
              label="Wheel base tier"
              value={specs.wheelTier}
              options={WHEEL_OPTS}
              onChange={(wheelTier) => setSpecs((s) => ({ ...s, wheelTier }))}
            />
            <TurfSetupButtonSelect
              label="Shifter"
              value={specs.shifter}
              options={SHIFT_OPTS}
              onChange={(shifter) => setSpecs((s) => ({ ...s, shifter }))}
            />
            <TurfSetupButtonSelect
              label="Motion"
              value={specs.rigMotion}
              options={RIG_OPTS}
              onChange={(rigMotion) => setSpecs((s) => ({ ...s, rigMotion }))}
            />
            <TurfSetupButtonSelect
              label="Primary platform"
              value={specs.primaryPlatform}
              options={PLAT_OPTS}
              onChange={(primaryPlatform) =>
                setSpecs((s) => ({ ...s, primaryPlatform }))
              }
            />
            <div>
              <label>Games / cockpit notes</label>
              <textarea
                rows={2}
                value={cockpitNotes}
                onChange={(e) => setCockpitNotes(e.target.value)}
                placeholder="iRacing, F1, Forza, wheel torque limits…"
              />
            </div>
          </div>
        </div>

        <div className="turf-setup-form-actions">
          <button type="submit" className="btn-primary btn-primary-lg" disabled={saving}>
            {saving ? 'Saving…' : existingStationId ? 'Save changes' : 'Create simulator'}
          </button>
        </div>
      </form>
    </div>
  );
}

