import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createCricketCourt,
  getCricketCourt,
  updateCricketCourt,
  type CreateCricketCourtBody,
  type CricketCourtDetail,
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
  const [courtStatus, setCourtStatus] = useState<'active' | 'maintenance'>(
    'active',
  );
  const [cricketFormat, setCricketFormat] = useState<
    'tape_ball' | 'tennis_ball' | 'hard_ball' | ''
  >('');
  const [cricketStumpsAvailable, setCricketStumpsAvailable] = useState(false);
  const [cricketBowlingMachine, setCricketBowlingMachine] = useState(false);
  const [cricketPracticeMode, setCricketPracticeMode] = useState<
    'full_ground' | 'nets_mode' | ''
  >('');

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
        setCourtStatus(d.courtStatus === 'maintenance' ? 'maintenance' : 'active');
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
