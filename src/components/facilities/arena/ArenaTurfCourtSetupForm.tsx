import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createCricketCourt,
  createFutsalCourt,
  getCricketCourt,
  getFutsalCourt,
  listTimeSlotTemplates,
  updateCricketCourt,
  updateFutsalCourt,
  type CreateCricketCourtBody,
  type CreateFutsalCourtBody,
  type CricketCourtDetail,
  type FutsalCourtDetail,
} from '../../../api/saasClient';
import type { BusinessLocationRow } from '../../../types/domain';
import { ArenaCourtSharedTurfSections } from './ArenaCourtSharedTurfSections';
import {
  emptySharedArenaTurfState,
  sharedDetailToFormState,
  sharedTurfFormStateToCricketPayload,
  sharedTurfFormStateToPayload,
  type SharedArenaTurfFormState,
} from './sharedArenaTurfFormState';
import type { ArenaCourtStatus } from './arenaCourtSetupFormModels';

type ArenaTurfKind = 'futsal' | 'cricket' | 'both';

export function ArenaTurfCourtSetupForm({
  courtKind,
  locationId,
  locations,
  onSuccess,
  existingCourtId,
}: {
  courtKind: ArenaTurfKind;
  locationId: string;
  locations: BusinessLocationRow[];
  onSuccess: () => void;
  existingCourtId?: string;
}) {
  const defaultIncludesFutsal = courtKind === 'futsal' || courtKind === 'both';
  const defaultIncludesCricket = courtKind === 'cricket' || courtKind === 'both';
  const [includeFutsal, setIncludeFutsal] = useState(defaultIncludesFutsal);
  const [includeCricket, setIncludeCricket] = useState(defaultIncludesCricket);
  const includesFutsal = includeFutsal;
  const includesCricket = includeCricket;
  const ownKindLabel =
    includesFutsal && includesCricket
      ? 'futsal + cricket pitches'
      : includesFutsal
        ? 'futsal pitch'
        : 'cricket pitch';

  const [shared, setShared] = useState<SharedArenaTurfFormState>(() =>
    emptySharedArenaTurfState(),
  );
  const [arenaLocationId, setArenaLocationId] = useState(locationId);
  const [courtStatus, setCourtStatus] = useState<ArenaCourtStatus>('active');

  const [futsalFormat, setFutsalFormat] = useState<'5v5' | '6v6' | '7v7' | ''>('');
  const [futsalGoalPostsAvailable, setFutsalGoalPostsAvailable] = useState(false);
  const [futsalGoalPostSize, setFutsalGoalPostSize] = useState('');
  const [futsalLineMarkings, setFutsalLineMarkings] = useState<
    'permanent' | 'temporary' | ''
  >('');

  const [cricketFormat, setCricketFormat] = useState<
    'tape_ball' | 'tennis_ball' | 'hard_ball' | ''
  >('');
  const [cricketStumpsAvailable, setCricketStumpsAvailable] = useState(false);
  const [cricketBowlingMachine, setCricketBowlingMachine] = useState(false);
  const [cricketPracticeMode, setCricketPracticeMode] = useState<
    'full_ground' | 'nets_mode' | ''
  >('');

  const [timeSlotTemplateOptions, setTimeSlotTemplateOptions] = useState<
    { id: string; name: string }[]
  >([]);

  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(!!existingCourtId);
  const [initialLoadError, setInitialLoadError] = useState<string | null>(null);
  /** One DB row on `futsal_courts` with `supportsCricket` (no twin link / no cricket row). */
  const [dualSingleTurfRow, setDualSingleTurfRow] = useState(false);
  const [futsalId, setFutsalId] = useState<string | null>(null);
  const [cricketId, setCricketId] = useState<string | null>(null);

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
      setCricketFormat('');
      setCricketStumpsAvailable(false);
      setCricketBowlingMachine(false);
      setCricketPracticeMode('');
      setIncludeFutsal(defaultIncludesFutsal);
      setDualSingleTurfRow(false);
      setFutsalId(null);
      setCricketId(null);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    void (async () => {
      try {
        if (courtKind === 'both' && existingCourtId) {
          let f: FutsalCourtDetail | null = null;
          try {
            f = await getFutsalCourt(existingCourtId);
          } catch {
            f = null;
          }
          if (f?.supportsCricket) {
            if (cancelled) return;
            setDualSingleTurfRow(true);
            setFutsalId(existingCourtId);
            setCricketId(null);
            setIncludeFutsal(true);
            setIncludeCricket(true);
            setShared({
              ...sharedDetailToFormState(f, emptySharedArenaTurfState()),
              name: f.name ?? '',
            });
            setArenaLocationId(f.businessLocationId ?? locationId);
            setCourtStatus(
              f.courtStatus === 'maintenance'
                ? 'maintenance'
                : f.courtStatus === 'draft'
                  ? 'draft'
                  : 'active',
            );
            const ff = f.futsalFormat;
            setFutsalFormat(ff === '5v5' || ff === '6v6' || ff === '7v7' ? ff : '');
            setFutsalGoalPostsAvailable(f.futsalGoalPostsAvailable === true);
            setFutsalGoalPostSize(f.futsalGoalPostSize ?? '');
            const lm = f.futsalLineMarkings;
            setFutsalLineMarkings(
              lm === 'permanent' || lm === 'temporary' ? lm : '',
            );
            const cf = f.cricketFormat;
            setCricketFormat(
              cf === 'tape_ball' || cf === 'tennis_ball' || cf === 'hard_ball'
                ? cf
                : '',
            );
            setCricketStumpsAvailable(f.cricketStumpsAvailable === true);
            setCricketBowlingMachine(f.cricketBowlingMachine === true);
            const pm = f.cricketPracticeMode;
            setCricketPracticeMode(
              pm === 'full_ground' || pm === 'nets_mode' ? pm : '',
            );
            return;
          }
          if (f && f.linkedTwinCourtId) {
            if (cancelled) return;
            setDualSingleTurfRow(false);
            setFutsalId(existingCourtId);
            setCricketId(f.linkedTwinCourtId);
            setIncludeFutsal(true);
            setIncludeCricket(true);
            setShared({
              ...sharedDetailToFormState(f, emptySharedArenaTurfState()),
              name: f.name ?? '',
            });
            setArenaLocationId(f.businessLocationId ?? locationId);
            setCourtStatus(
              f.courtStatus === 'maintenance'
                ? 'maintenance'
                : f.courtStatus === 'draft'
                  ? 'draft'
                  : 'active',
            );
            const ff = f.futsalFormat;
            setFutsalFormat(ff === '5v5' || ff === '6v6' || ff === '7v7' ? ff : '');
            setFutsalGoalPostsAvailable(f.futsalGoalPostsAvailable === true);
            setFutsalGoalPostSize(f.futsalGoalPostSize ?? '');
            const lm = f.futsalLineMarkings;
            setFutsalLineMarkings(
              lm === 'permanent' || lm === 'temporary' ? lm : '',
            );
            const twin = await getCricketCourt(f.linkedTwinCourtId);
            if (cancelled) return;
            const cf = twin.cricketFormat;
            setCricketFormat(
              cf === 'tape_ball' || cf === 'tennis_ball' || cf === 'hard_ball'
                ? cf
                : '',
            );
            setCricketStumpsAvailable(twin.cricketStumpsAvailable === true);
            setCricketBowlingMachine(twin.cricketBowlingMachine === true);
            const pm = twin.cricketPracticeMode;
            setCricketPracticeMode(
              pm === 'full_ground' || pm === 'nets_mode' ? pm : '',
            );
            return;
          }
          const c: CricketCourtDetail = await getCricketCourt(existingCourtId);
          if (cancelled) return;
          setDualSingleTurfRow(false);
          setFutsalId(c.linkedTwinCourtId ?? null);
          setCricketId(existingCourtId);
          setIncludeFutsal(!!c.linkedTwinCourtId);
          setIncludeCricket(true);
          setShared({
            ...sharedDetailToFormState(c, emptySharedArenaTurfState()),
            name: c.name ?? '',
          });
          setArenaLocationId(c.businessLocationId ?? locationId);
          setCourtStatus(
            c.courtStatus === 'maintenance'
              ? 'maintenance'
              : c.courtStatus === 'draft'
                ? 'draft'
                : 'active',
          );
          const cf = c.cricketFormat;
          setCricketFormat(
            cf === 'tape_ball' || cf === 'tennis_ball' || cf === 'hard_ball'
              ? cf
              : '',
          );
          setCricketStumpsAvailable(c.cricketStumpsAvailable === true);
          setCricketBowlingMachine(c.cricketBowlingMachine === true);
          const pm = c.cricketPracticeMode;
          setCricketPracticeMode(
            pm === 'full_ground' || pm === 'nets_mode' ? pm : '',
          );

          if (c.linkedTwinCourtId) {
            const twinF = await getFutsalCourt(c.linkedTwinCourtId);
            if (cancelled) return;
            const ff = twinF.futsalFormat;
            setFutsalFormat(ff === '5v5' || ff === '6v6' || ff === '7v7' ? ff : '');
            setFutsalGoalPostsAvailable(twinF.futsalGoalPostsAvailable === true);
            setFutsalGoalPostSize(twinF.futsalGoalPostSize ?? '');
            const lm = twinF.futsalLineMarkings;
            setFutsalLineMarkings(
              lm === 'permanent' || lm === 'temporary' ? lm : '',
            );
          }
          return;
        }

        if (includesFutsal) {
          const d: FutsalCourtDetail = await getFutsalCourt(existingCourtId);
          if (cancelled) return;
          setDualSingleTurfRow(d.supportsCricket === true);
          setFutsalId(existingCourtId);
          setCricketId(null);
          setIncludeFutsal(true);
          setIncludeCricket(d.supportsCricket === true);
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
          const ff = d.futsalFormat;
          setFutsalFormat(ff === '5v5' || ff === '6v6' || ff === '7v7' ? ff : '');
          setFutsalGoalPostsAvailable(d.futsalGoalPostsAvailable === true);
          setFutsalGoalPostSize(d.futsalGoalPostSize ?? '');
          const lm = d.futsalLineMarkings;
          setFutsalLineMarkings(
            lm === 'permanent' || lm === 'temporary' ? lm : '',
          );
        } else {
          const d: CricketCourtDetail = await getCricketCourt(existingCourtId);
          if (cancelled) return;
          setDualSingleTurfRow(false);
          setFutsalId(null);
          setCricketId(existingCourtId);
          setIncludeFutsal(false);
          setIncludeCricket(true);
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
        }
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
  }, [
    courtKind,
    defaultIncludesCricket,
    defaultIncludesFutsal,
    existingCourtId,
    locationId,
  ]);

  useEffect(() => {
    if (!existingCourtId && locationId) setArenaLocationId(locationId);
  }, [locationId, existingCourtId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listTimeSlotTemplates();
        if (cancelled) return;
        setTimeSlotTemplateOptions(rows.map((r) => ({ id: r.id, name: r.name })));
      } catch {
        if (!cancelled) setTimeSlotTemplateOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const locationOptions = useMemo(
    () =>
      [...locations].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
      ),
    [locations],
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!includesFutsal && !includesCricket) {
      setErr('Select at least one sport type (Futsal or Cricket).');
      return;
    }
    const effectiveLocationId = existingCourtId ? arenaLocationId : locationId;
    if (!effectiveLocationId || !shared.name.trim()) return;
    const arena = locations.find((l) => l.id === arenaLocationId);
    const templatePayload = shared.timeSlotTemplateId.trim()
      ? { timeSlotTemplateId: shared.timeSlotTemplateId.trim() }
      : existingCourtId
        ? { timeSlotTemplateId: null as null }
        : {};
    setSaving(true);
    setErr(null);
    try {
      if (
        dualSingleTurfRow &&
        existingCourtId &&
        includesFutsal &&
        includesCricket
      ) {
        const body: CreateFutsalCourtBody = {
          businessLocationId: effectiveLocationId,
          name: shared.name.trim(),
          courtStatus,
          arenaLabel: arena?.name?.trim() || undefined,
          ...sharedTurfFormStateToPayload(shared),
          ...templatePayload,
          supportsCricket: true,
          futsalFormat: futsalFormat || undefined,
          futsalGoalPostsAvailable: futsalGoalPostsAvailable || undefined,
          futsalGoalPostSize: futsalGoalPostSize.trim() || undefined,
          futsalLineMarkings: futsalLineMarkings || undefined,
          cricketFormat: cricketFormat || undefined,
          cricketStumpsAvailable: cricketStumpsAvailable || undefined,
          cricketBowlingMachine: cricketBowlingMachine || undefined,
          cricketPracticeMode: cricketPracticeMode || undefined,
        };
        const { businessLocationId: _b, ...patch } = body;
        await updateFutsalCourt(futsalId!, patch);
        onSuccess();
        return;
      }

      if (!existingCourtId && includesFutsal && includesCricket) {
        const body: CreateFutsalCourtBody = {
          businessLocationId: effectiveLocationId,
          name: shared.name.trim(),
          courtStatus,
          arenaLabel: arena?.name?.trim() || undefined,
          ...sharedTurfFormStateToPayload(shared),
          ...templatePayload,
          supportsCricket: true,
          futsalFormat: futsalFormat || undefined,
          futsalGoalPostsAvailable: futsalGoalPostsAvailable || undefined,
          futsalGoalPostSize: futsalGoalPostSize.trim() || undefined,
          futsalLineMarkings: futsalLineMarkings || undefined,
          cricketFormat: cricketFormat || undefined,
          cricketStumpsAvailable: cricketStumpsAvailable || undefined,
          cricketBowlingMachine: cricketBowlingMachine || undefined,
          cricketPracticeMode: cricketPracticeMode || undefined,
        };
        await createFutsalCourt(body);
        onSuccess();
        return;
      }

      if (includesFutsal) {
        const body: CreateFutsalCourtBody = {
          businessLocationId: effectiveLocationId,
          name: shared.name.trim(),
          courtStatus,
          arenaLabel: arena?.name?.trim() || undefined,
          ...sharedTurfFormStateToPayload(shared),
          ...templatePayload,
          futsalFormat: futsalFormat || undefined,
          futsalGoalPostsAvailable: futsalGoalPostsAvailable || undefined,
          futsalGoalPostSize: futsalGoalPostSize.trim() || undefined,
          futsalLineMarkings: futsalLineMarkings || undefined,
        };
        if (futsalId && existingCourtId) {
          const { businessLocationId: _b, ...patch } = body;
          await updateFutsalCourt(futsalId, patch);
        } else {
          await createFutsalCourt(body);
        }
      }
      if (includesCricket) {
        const body: CreateCricketCourtBody = {
          businessLocationId: effectiveLocationId,
          name: shared.name.trim(),
          courtStatus,
          arenaLabel: arena?.name?.trim() || undefined,
          ...sharedTurfFormStateToCricketPayload(shared),
          ...templatePayload,
          cricketFormat: cricketFormat || undefined,
          cricketStumpsAvailable: cricketStumpsAvailable || undefined,
          cricketBowlingMachine: cricketBowlingMachine || undefined,
          cricketPracticeMode: cricketPracticeMode || undefined,
        };
        if (cricketId && existingCourtId) {
          const { businessLocationId: _b, ...patch } = body;
          await updateCricketCourt(cricketId, patch);
        } else {
          await createCricketCourt(body);
        }
      }
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (initialLoadError) return <div className="err-banner">{initialLoadError}</div>;
  if (loadingDetail && existingCourtId) return <div className="empty-state">Loading court…</div>;

  const futsalSection = (
    <div className="form-grid">
      <div>
        <label>Format</label>
        <select value={futsalFormat} onChange={(e) => setFutsalFormat(e.target.value as typeof futsalFormat)}>
          <option value="">—</option>
          <option value="5v5">5v5</option>
          <option value="6v6">6v6</option>
          <option value="7v7">7v7</option>
        </select>
      </div>
      <div>
        <label className="turf-setup-inline">
          <input type="checkbox" checked={futsalGoalPostsAvailable} onChange={(e) => setFutsalGoalPostsAvailable(e.target.checked)} />
          Goal posts available
        </label>
      </div>
      <div>
        <label>Goal post size</label>
        <input value={futsalGoalPostSize} onChange={(e) => setFutsalGoalPostSize(e.target.value)} maxLength={80} />
      </div>
      <div>
        <label>Line markings</label>
        <select value={futsalLineMarkings} onChange={(e) => setFutsalLineMarkings(e.target.value as typeof futsalLineMarkings)}>
          <option value="">—</option>
          <option value="permanent">Permanent</option>
          <option value="temporary">Temporary</option>
        </select>
      </div>
    </div>
  );

  const cricketSection = (
    <div className="form-grid">
      <div>
        <label>Ball format</label>
        <select value={cricketFormat} onChange={(e) => setCricketFormat(e.target.value as typeof cricketFormat)}>
          <option value="">—</option>
          <option value="tape_ball">Tape ball</option>
          <option value="tennis_ball">Tennis ball</option>
          <option value="hard_ball">Hard ball</option>
        </select>
      </div>
      <div>
        <label className="turf-setup-inline">
          <input type="checkbox" checked={cricketStumpsAvailable} onChange={(e) => setCricketStumpsAvailable(e.target.checked)} />
          Stumps available
        </label>
      </div>
      <div>
        <label className="turf-setup-inline">
          <input type="checkbox" checked={cricketBowlingMachine} onChange={(e) => setCricketBowlingMachine(e.target.checked)} />
          Bowling machine
        </label>
      </div>
      <div>
        <label>Practice mode</label>
        <select value={cricketPracticeMode} onChange={(e) => setCricketPracticeMode(e.target.value as typeof cricketPracticeMode)}>
          <option value="">—</option>
          <option value="full_ground">Full ground</option>
          <option value="nets_mode">Nets mode</option>
        </select>
      </div>
    </div>
  );

  const gameSection = (
    <>
      {includesFutsal ? futsalSection : null}
      {includesCricket ? cricketSection : null}
    </>
  );

  return (
    <div className="turf-setup-form-wrap">
      <form className="form-grid turf-setup-form" onSubmit={(e) => void onSubmit(e)}>
        {err && <div className="err-banner turf-setup-form-error">{err}</div>}
        <div className="turf-setup-card">
          <h4>0. Facility type</h4>
          <div className="turf-setup-checkrow">
            <label className="turf-setup-inline">
              <input
                type="checkbox"
                checked={includesFutsal}
                disabled={!!existingCourtId}
                onChange={(e) => setIncludeFutsal(e.target.checked)}
              />
              Futsal
            </label>
            <label className="turf-setup-inline">
              <input
                type="checkbox"
                checked={includesCricket}
                disabled={!!existingCourtId}
                onChange={(e) => setIncludeCricket(e.target.checked)}
              />
              Cricket
            </label>
          </div>
          {existingCourtId ? (
            <p className="muted" style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>
              Sport type cannot be changed while editing an existing facility.
            </p>
          ) : null}
        </div>
        <ArenaCourtSharedTurfSections
          shared={shared}
          setShared={setShared}
          locationOptions={locationOptions}
          arenaLocationId={arenaLocationId}
          setArenaLocationId={setArenaLocationId}
          courtStatus={courtStatus}
          setCourtStatus={setCourtStatus}
          existingCourtId={existingCourtId}
          timeSlotTemplateOptions={timeSlotTemplateOptions}
          gameSection={gameSection}
        />
        <div className="turf-setup-form-actions">
          <button type="submit" className="btn-primary" disabled={saving || !shared.name.trim()}>
            {saving ? 'Saving…' : existingCourtId ? 'Save changes' : `Create ${ownKindLabel}`}
          </button>
        </div>
      </form>
    </div>
  );
}

