import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createFutsalCourt,
  getFutsalCourt,
  updateFutsalCourt,
  type CreateFutsalCourtBody,
  type FutsalCourtDetail,
} from '../api/saasClient';
import type { BusinessLocationRow } from '../types/domain';
import { ArenaCourtSharedTurfSections } from './arena/ArenaCourtSharedTurfSections';
import {
  emptySharedArenaTurfState,
  sharedDetailToFormState,
  sharedTurfFormStateToPayload,
  type SharedArenaTurfFormState,
} from './arena/sharedArenaTurfFormState';

function parseIntOpt(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) ? n : undefined;
}

export function FutsalCourtSetupForm({
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
  const [futsalFormat, setFutsalFormat] = useState<
    '5v5' | '6v6' | '7v7' | ''
  >('');
  const [futsalGoalPostsAvailable, setFutsalGoalPostsAvailable] =
    useState(false);
  const [futsalGoalPostSize, setFutsalGoalPostSize] = useState('');
  const [futsalLineMarkings, setFutsalLineMarkings] = useState<
    'permanent' | 'temporary' | ''
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
      setFutsalFormat('');
      setFutsalGoalPostsAvailable(false);
      setFutsalGoalPostSize('');
      setFutsalLineMarkings('');
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    void (async () => {
      try {
        const d: FutsalCourtDetail = await getFutsalCourt(existingCourtId);
        if (cancelled) return;
        setShared({
          ...sharedDetailToFormState(d, emptySharedArenaTurfState()),
          name: d.name ?? '',
        });
        setArenaLocationId(d.businessLocationId ?? locationId);
        setCourtStatus(d.courtStatus === 'maintenance' ? 'maintenance' : 'active');
        const ff = d.futsalFormat;
        setFutsalFormat(ff === '5v5' || ff === '6v6' || ff === '7v7' ? ff : '');
        setFutsalGoalPostsAvailable(d.futsalGoalPostsAvailable === true);
        setFutsalGoalPostSize(d.futsalGoalPostSize ?? '');
        const lm = d.futsalLineMarkings;
        setFutsalLineMarkings(
          lm === 'permanent' || lm === 'temporary' ? lm : '',
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
    const sharedPayload = sharedTurfFormStateToPayload(shared);
    const body: CreateFutsalCourtBody = {
      businessLocationId: effectiveLocationId,
      name: shared.name.trim(),
      courtStatus,
      arenaLabel: arena?.name?.trim() || undefined,
      ...sharedPayload,
      futsalFormat: futsalFormat || undefined,
      futsalGoalPostsAvailable: futsalGoalPostsAvailable || undefined,
      futsalGoalPostSize: futsalGoalPostSize.trim() || undefined,
      futsalLineMarkings: futsalLineMarkings || undefined,
    };
    setSaving(true);
    setErr(null);
    try {
      if (existingCourtId) {
        const { businessLocationId: _b, ...patch } = body;
        await updateFutsalCourt(existingCourtId, patch);
      } else {
        await createFutsalCourt(body);
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
        <label>Format</label>
        <select
          value={futsalFormat}
          onChange={(e) =>
            setFutsalFormat(e.target.value as typeof futsalFormat)
          }
        >
          <option value="">—</option>
          <option value="5v5">5v5</option>
          <option value="6v6">6v6</option>
          <option value="7v7">7v7</option>
        </select>
      </div>
      <div>
        <label className="turf-setup-inline">
          <input
            type="checkbox"
            checked={futsalGoalPostsAvailable}
            onChange={(e) => setFutsalGoalPostsAvailable(e.target.checked)}
          />
          Goal posts available
        </label>
      </div>
      <div>
        <label>Goal post size</label>
        <input
          value={futsalGoalPostSize}
          onChange={(e) => setFutsalGoalPostSize(e.target.value)}
          maxLength={80}
        />
      </div>
      <div>
        <label>Line markings</label>
        <select
          value={futsalLineMarkings}
          onChange={(e) =>
            setFutsalLineMarkings(e.target.value as typeof futsalLineMarkings)
          }
        >
          <option value="">—</option>
          <option value="permanent">Permanent</option>
          <option value="temporary">Temporary</option>
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
                : 'Create futsal pitch'}
          </button>
        </div>
      </form>
    </div>
  );
}
