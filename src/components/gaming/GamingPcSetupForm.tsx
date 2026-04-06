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

const SETUP_CODE = 'gaming-pc' as const;

type PcSpecs = {
  gpuTier: 'entry' | 'mid' | 'high' | 'enthusiast';
  ramGb: '8' | '16' | '32' | '64';
  monitorLayout: 'single' | 'dual' | 'triple';
  keyboardType: 'membrane' | 'mechanical' | 'none';
};

const GPU_OPTS: { value: PcSpecs['gpuTier']; label: string }[] = [
  { value: 'entry', label: 'Entry' },
  { value: 'mid', label: 'Mid' },
  { value: 'high', label: 'High' },
  { value: 'enthusiast', label: 'Enthusiast' },
];

const RAM_OPTS: { value: PcSpecs['ramGb']; label: string }[] = [
  { value: '8', label: '8 GB' },
  { value: '16', label: '16 GB' },
  { value: '32', label: '32 GB' },
  { value: '64', label: '64 GB' },
];

const MON_OPTS: { value: PcSpecs['monitorLayout']; label: string }[] = [
  { value: 'single', label: 'Single' },
  { value: 'dual', label: 'Dual' },
  { value: 'triple', label: 'Triple' },
];

const KB_OPTS: { value: PcSpecs['keyboardType']; label: string }[] = [
  { value: 'membrane', label: 'Membrane' },
  { value: 'mechanical', label: 'Mechanical' },
  { value: 'none', label: 'BYO' },
];

function specsFromRecord(specs: Record<string, unknown>): PcSpecs {
  const g = specs.gpuTier;
  const r = specs.ramGb;
  const m = specs.monitorLayout;
  const k = specs.keyboardType;
  return {
    gpuTier:
      g === 'entry' || g === 'mid' || g === 'high' || g === 'enthusiast'
        ? g
        : 'mid',
    ramGb: r === '8' || r === '16' || r === '32' || r === '64' ? r : '16',
    monitorLayout:
      m === 'single' || m === 'dual' || m === 'triple' ? m : 'single',
    keyboardType:
      k === 'membrane' || k === 'mechanical' || k === 'none'
        ? k
        : 'mechanical',
  };
}

export function GamingPcSetupForm({
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
  const [specs, setSpecs] = useState<PcSpecs>({
    gpuTier: 'mid',
    ramGb: '16',
    monitorLayout: 'single',
    keyboardType: 'mechanical',
  });
  const [gameLibraryNote, setGameLibraryNote] = useState('');
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
        gpuTier: 'mid',
        ramGb: '16',
        monitorLayout: 'single',
        keyboardType: 'mechanical',
      });
      setGameLibraryNote('');
      return;
    }
    const row = getGamingStation(locationId, existingStationId);
    if (!row || row.setupCode !== SETUP_CODE) {
      setLoading(false);
      setLoadErr('Station not found for this location.');
      return;
    }
    setShared(recordToSharedFormState(row));
    setArenaLocationId(row.businessLocationId);
    setSpecs(specsFromRecord(row.specs));
    setGameLibraryNote(
      typeof row.specs.gameLibraryNote === 'string'
        ? row.specs.gameLibraryNote
        : '',
    );
    setLoading(false);
    setLoadErr(null);
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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const effectiveLocationId = existingStationId ? arenaLocationId : locationId;
    if (!effectiveLocationId || !shared.name.trim()) return;
    const now = new Date().toISOString();
    const prev =
      existingStationId && effectiveLocationId
        ? getGamingStation(effectiveLocationId, existingStationId)
        : undefined;
    const record: GamingStationRecord = mergeSharedIntoRecord(
      {
        id: existingStationId ?? crypto.randomUUID(),
        businessLocationId: effectiveLocationId,
        setupCode: SETUP_CODE,
        specs: { ...specs, gameLibraryNote: gameLibraryNote.trim() },
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
    record.specs = { ...specs, gameLibraryNote: gameLibraryNote.trim() };
    setSaving(true);
    setErr(null);
    try {
      saveGamingStation(record);
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
          <h4>5. PC rig</h4>
          <div className="form-grid">
            <TurfSetupButtonSelect
              label="GPU tier"
              value={specs.gpuTier}
              options={GPU_OPTS}
              onChange={(gpuTier) => setSpecs((s) => ({ ...s, gpuTier }))}
            />
            <TurfSetupButtonSelect
              label="System RAM"
              value={specs.ramGb}
              options={RAM_OPTS}
              onChange={(ramGb) => setSpecs((s) => ({ ...s, ramGb }))}
            />
            <TurfSetupButtonSelect
              label="Monitor layout"
              value={specs.monitorLayout}
              options={MON_OPTS}
              onChange={(monitorLayout) => setSpecs((s) => ({ ...s, monitorLayout }))}
            />
            <TurfSetupButtonSelect
              label="Keyboard"
              value={specs.keyboardType}
              options={KB_OPTS}
              onChange={(keyboardType) => setSpecs((s) => ({ ...s, keyboardType }))}
            />
            <div>
              <label>Game library / account notes</label>
              <textarea
                rows={2}
                value={gameLibraryNote}
                onChange={(e) => setGameLibraryNote(e.target.value)}
                placeholder="Steam / Epic logins, installed titles, restrictions…"
              />
            </div>
          </div>
        </div>

        <div className="turf-setup-form-actions">
          <button type="submit" className="btn-primary btn-primary-lg" disabled={saving}>
            {saving ? 'Saving…' : existingStationId ? 'Save changes' : 'Create PC station'}
          </button>
        </div>
      </form>
    </div>
  );
}
