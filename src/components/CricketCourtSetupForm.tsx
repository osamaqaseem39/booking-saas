import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createCricketCourt,
  getFutsalCourt,
  getCricketCourt,
  listFutsalCourts,
  updateCricketCourt,
  type CreateCricketCourtBody,
  type CricketCourtDetail,
  type FutsalCourtDetail,
  type NamedCourt,
} from '../api/saasClient';
import type { BusinessLocationRow } from '../types/domain';
import { ArenaCourtSharedTurfSections } from './arena/ArenaCourtSharedTurfSections';
import {
  emptySharedArenaTurfState,
  sharedDetailToFormState,
  sharedTurfFormStateToCricketPayload,
  type SharedArenaTurfFormState,
} from './arena/sharedArenaTurfFormState';

function parseIntOpt(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) ? n : undefined;
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
  const [shared, setShared] = useState<SharedArenaTurfFormState>(() =>
    emptySharedArenaTurfState(),
  );
  const [arenaLocationId, setArenaLocationId] = useState(locationId);
  const [courtStatus, setCourtStatus] = useState<
    'active' | 'maintenance' | 'draft'
  >('active');
  const [cricketFormat, setCricketFormat] = useState<
    'tape_ball' | 'tennis_ball' | 'hard_ball' | ''
  >('');
  const [cricketStumpsAvailable, setCricketStumpsAvailable] = useState(false);
  const [cricketBowlingMachine, setCricketBowlingMachine] = useState(false);
  const [cricketPracticeMode, setCricketPracticeMode] = useState<
    'full_ground' | 'nets_mode' | ''
  >('');
  const [sameFieldAsFutsal, setSameFieldAsFutsal] = useState(false);
  const [selectedFutsalTwinId, setSelectedFutsalTwinId] = useState('');
  const [futsalTwinOptions, setFutsalTwinOptions] = useState<NamedCourt[]>([]);

  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(!!existingCourtId);
  const [initialLoadError, setInitialLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!existingCourtId) {
      setLoadingDetail(false);
      setInitialLoadError(null);
      setShared(emptySharedArenaTurfState());
      setArenaLocationId(locationId);
      setCourtStatus('active');
      setCricketFormat('');
      setCricketStumpsAvailable(false);
      setCricketBowlingMachine(false);
      setCricketPracticeMode('');
      setSameFieldAsFutsal(false);
      setSelectedFutsalTwinId('');
      setFutsalTwinOptions([]);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    void (async () => {
      try {
        const d: CricketCourtDetail = await getCricketCourt(existingCourtId);
        if (cancelled) return;
        setShared({
          ...sharedDetailToFormState(d, emptySharedArenaTurfState()),
          name: d.name ?? '',
        });
        setArenaLocationId(d.businessLocationId ?? locationId);
        setCourtStatus(
          d.courtStatus === 'maintenance'
            ? 'maintenance'
            : d.courtStatus === 'draft'
              ? 'draft'
              : 'active',
        );
        const cf = d.cricketFormat;
        setCricketFormat(
          cf === 'tape_ball' || cf === 'tennis_ball' || cf === 'hard_ball'
            ? cf
            : '',
        );
        setCricketStumpsAvailable(d.cricketStumpsAvailable === true);
        setCricketBowlingMachine(d.cricketBowlingMachine === true);
        const pm = d.cricketPracticeMode;
        setCricketPracticeMode(
          pm === 'full_ground' || pm === 'nets_mode' ? pm : '',
        );
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

  useEffect(() => {
    if (!existingCourtId && locationId) {
      setArenaLocationId(locationId);
    }
  }, [locationId, existingCourtId]);

  useEffect(() => {
    if (existingCourtId || !arenaLocationId) {
      setFutsalTwinOptions([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listFutsalCourts(arenaLocationId);
        if (cancelled) return;
        setFutsalTwinOptions(rows);
      } catch {
        if (!cancelled) setFutsalTwinOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [arenaLocationId, existingCourtId]);

  useEffect(() => {
    if (existingCourtId || !sameFieldAsFutsal || !selectedFutsalTwinId) return;
    let cancelled = false;
    void (async () => {
      try {
        const twin: FutsalCourtDetail = await getFutsalCourt(selectedFutsalTwinId);
        if (cancelled) return;
        setShared((prev) => ({
          ...sharedDetailToFormState(twin, prev),
          name: twin.name ?? prev.name,
        }));
      } catch {
        // Keep manual values if twin details fail to load.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [existingCourtId, sameFieldAsFutsal, selectedFutsalTwinId]);

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
    if (!effectiveLocationId || !shared.name.trim()) return;
    const slotM = parseIntOpt(shared.slotDuration);
    if (
      slotM !== undefined &&
      (slotM < 60 || slotM % 30 !== 0)
    ) {
      setErr('Slot duration must be at least 60 and in 30-minute intervals.');
      return;
    }
    if (sameFieldAsFutsal && !selectedFutsalTwinId) {
      setErr('Select a futsal pitch to mark this as the same physical field.');
      return;
    }
    const arena = locations.find((l) => l.id === arenaLocationId);
    const sharedPayload = sharedTurfFormStateToCricketPayload(shared);
    const body: CreateCricketCourtBody = {
      businessLocationId: effectiveLocationId,
      name: shared.name.trim(),
      courtStatus,
      arenaLabel: arena?.name?.trim() || undefined,
      ...sharedPayload,
      cricketFormat: cricketFormat || undefined,
      cricketStumpsAvailable: cricketStumpsAvailable || undefined,
      cricketBowlingMachine: cricketBowlingMachine || undefined,
      cricketPracticeMode: cricketPracticeMode || undefined,
      linkedTwinCourtKind:
        !existingCourtId && sameFieldAsFutsal && selectedFutsalTwinId
          ? 'futsal_court'
          : undefined,
      linkedTwinCourtId:
        !existingCourtId && sameFieldAsFutsal && selectedFutsalTwinId
          ? selectedFutsalTwinId
          : undefined,
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

  const gameSection = (
    <div className="form-grid">
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
        <label className="turf-setup-inline">
          <input
            type="checkbox"
            checked={cricketStumpsAvailable}
            onChange={(e) => setCricketStumpsAvailable(e.target.checked)}
          />
          Stumps available
        </label>
      </div>
      <div>
        <label className="turf-setup-inline">
          <input
            type="checkbox"
            checked={cricketBowlingMachine}
            onChange={(e) => setCricketBowlingMachine(e.target.checked)}
          />
          Bowling machine
        </label>
      </div>
      <div>
        <label>Practice mode</label>
        <select
          value={cricketPracticeMode}
          onChange={(e) =>
            setCricketPracticeMode(
              e.target.value as typeof cricketPracticeMode,
            )
          }
        >
          <option value="">—</option>
          <option value="full_ground">Full ground</option>
          <option value="nets_mode">Nets mode</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="turf-setup-form-wrap">
      <form className="form-grid turf-setup-form" onSubmit={(e) => void onSubmit(e)}>
        {err && <div className="err-banner turf-setup-form-error">{err}</div>}
        <ArenaCourtSharedTurfSections
          shared={shared}
          setShared={setShared}
          locationOptions={locationOptions}
          arenaLocationId={arenaLocationId}
          setArenaLocationId={setArenaLocationId}
          courtStatus={courtStatus}
          setCourtStatus={setCourtStatus}
          existingCourtId={existingCourtId}
          gameSection={gameSection}
        />
        {!existingCourtId ? (
          <div className="connection-panel" style={{ marginTop: '0.5rem' }}>
            <label className="turf-setup-inline">
              <input
                type="checkbox"
                checked={sameFieldAsFutsal}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setSameFieldAsFutsal(checked);
                  if (!checked) setSelectedFutsalTwinId('');
                }}
              />
              Same physical field as an existing futsal pitch (shared booking calendar)
            </label>
            {sameFieldAsFutsal ? (
              <div style={{ marginTop: '0.75rem' }}>
                <label>Futsal pitch to link *</label>
                <select
                  value={selectedFutsalTwinId}
                  onChange={(e) => setSelectedFutsalTwinId(e.target.value)}
                >
                  <option value="">Select futsal pitch…</option>
                  {futsalTwinOptions.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
                <p className="muted" style={{ marginTop: '0.35rem' }}>
                  Shared turf details are auto-filled from the selected futsal
                  pitch, and both sides are treated as one field for availability.
                </p>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="turf-setup-form-actions">
          <button
            type="submit"
            className="btn-primary"
            disabled={saving || !shared.name.trim()}
          >
            {saving
              ? 'Saving…'
              : existingCourtId
                ? 'Save changes'
                : 'Create cricket pitch'}
          </button>
        </div>
      </form>
    </div>
  );
}
