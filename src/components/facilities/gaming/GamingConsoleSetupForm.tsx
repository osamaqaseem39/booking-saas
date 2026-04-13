import { type FormEvent, useEffect, useMemo, useState } from 'react';
import type { BusinessLocationRow } from '../../../types/domain';
import type { GamingConsoleSetupCode } from '../../../constants/gamingFacilityTypes';
import { formatGamingSetupLabel } from '../../../constants/gamingFacilityTypes';
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

type ConsoleSpecs = {
  hdmiOutput: '1080p' | '4k' | '8k';
  controllerCount: '1' | '2' | '3' | '4';
  subscriptionTier: 'none' | 'ps-plus' | 'game-pass' | 'live-gold' | 'other';
};

const HDMI_OPTS: { value: ConsoleSpecs['hdmiOutput']; label: string }[] = [
  { value: '1080p', label: '1080p' },
  { value: '4k', label: '4K' },
  { value: '8k', label: '8K' },
];

const CTRL_OPTS: { value: ConsoleSpecs['controllerCount']; label: string }[] =
  [
    { value: '1', label: '1' },
    { value: '2', label: '2' },
    { value: '3', label: '3' },
    { value: '4', label: '4' },
  ];

const SUB_OPTS: { value: ConsoleSpecs['subscriptionTier']; label: string }[] =
  [
    { value: 'none', label: 'None' },
    { value: 'ps-plus', label: 'PS Plus' },
    { value: 'game-pass', label: 'Game Pass' },
    { value: 'live-gold', label: 'Xbox Live' },
    { value: 'other', label: 'Other' },
  ];

function specsFromRecord(specs: Record<string, unknown>): ConsoleSpecs {
  const hdmi = specs.hdmiOutput;
  const ctrl = specs.controllerCount;
  const sub = specs.subscriptionTier;
  return {
    hdmiOutput:
      hdmi === '1080p' || hdmi === '4k' || hdmi === '8k' ? hdmi : '4k',
    controllerCount:
      ctrl === '1' || ctrl === '2' || ctrl === '3' || ctrl === '4'
        ? ctrl
        : '2',
    subscriptionTier:
      sub === 'none' ||
      sub === 'ps-plus' ||
      sub === 'game-pass' ||
      sub === 'live-gold' ||
      sub === 'other'
        ? sub
        : 'none',
  };
}

export function GamingConsoleSetupForm({
  locationId,
  locations,
  setupCode,
  onSuccess,
  existingStationId,
}: {
  locationId: string;
  locations: BusinessLocationRow[];
  setupCode: GamingConsoleSetupCode;
  onSuccess: () => void;
  existingStationId?: string;
}) {
  const [shared, setShared] = useState<GamingStationSharedFormState>(() =>
    emptySharedGamingStationFormState(),
  );
  const [arenaLocationId, setArenaLocationId] = useState(locationId);
  const [specs, setSpecs] = useState<ConsoleSpecs>({
    hdmiOutput: '4k',
    controllerCount: '2',
    subscriptionTier: 'none',
  });
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!existingStationId);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const title = formatGamingSetupLabel(setupCode);

  useEffect(() => {
    if (!existingStationId) {
      setLoading(false);
      setLoadErr(null);
      setShared(emptySharedGamingStationFormState());
      setArenaLocationId(locationId);
      setSpecs({
        hdmiOutput: '4k',
        controllerCount: '2',
        subscriptionTier: 'none',
      });
      return;
    }
    void (async () => {
      const row = await getGamingStation(locationId, existingStationId);
      if (!row || row.setupCode !== setupCode) {
        setLoading(false);
        setLoadErr('Station not found for this location.');
        return;
      }
      setShared(recordToSharedFormState(row));
      setArenaLocationId(row.businessLocationId);
      setSpecs(specsFromRecord(row.specs));
      setLoading(false);
      setLoadErr(null);
    })();
  }, [existingStationId, locationId, setupCode]);

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
        setupCode,
        specs: { ...specs },
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
    record.specs = { ...specs };
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
    return <div className="empty-state">Loading stationâ€¦</div>;
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
          <h4>5. Console setup</h4>
          <p className="muted" style={{ marginBottom: '0.65rem', fontSize: '0.85rem' }}>
            Shared layout for {title}; tweak defaults per booth.
          </p>
          <div className="form-grid">
            <TurfSetupButtonSelect
              label="HDMI output"
              value={specs.hdmiOutput}
              options={HDMI_OPTS}
              onChange={(hdmiOutput) => setSpecs((s) => ({ ...s, hdmiOutput }))}
            />
            <TurfSetupButtonSelect
              label="Controllers included"
              value={specs.controllerCount}
              options={CTRL_OPTS}
              onChange={(controllerCount) =>
                setSpecs((s) => ({ ...s, controllerCount }))
              }
            />
            <TurfSetupButtonSelect
              label="Subscription / online"
              value={specs.subscriptionTier}
              options={SUB_OPTS}
              onChange={(subscriptionTier) =>
                setSpecs((s) => ({ ...s, subscriptionTier }))
              }
            />
          </div>
        </div>

        <div className="turf-setup-form-actions">
          <button type="submit" className="btn-primary btn-primary-lg" disabled={saving}>
            {saving ? 'Savingâ€¦' : existingStationId ? 'Save changes' : `Create ${title} station`}
          </button>
        </div>
      </form>
    </div>
  );
}

