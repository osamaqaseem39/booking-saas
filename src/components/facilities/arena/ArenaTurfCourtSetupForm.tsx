import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createCricketCourt,
  createFutsalCourt,
  createTurfTwinLink,
  getCricketCourt,
  getFutsalCourt,
  listCricketCourts,
  listFutsalCourts,
  listTimeSlotTemplates,
  removeTurfTwinLink,
  updateCricketCourt,
  updateFutsalCourt,
  type CreateCricketCourtBody,
  type CreateFutsalCourtBody,
  type CricketCourtDetail,
  type FutsalCourtDetail,
} from '../../../api/saasClient';
import type { BusinessLocationRow, NamedCourt } from '../../../types/domain';
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
  const includesFutsal = courtKind === 'futsal' || courtKind === 'both';
  const includesCricket = courtKind === 'cricket' || courtKind === 'both';
  const isSingleKind = includesFutsal !== includesCricket;
  const ownKindLabel =
    courtKind === 'both'
      ? 'field'
      : includesFutsal
        ? 'futsal pitch'
        : 'cricket pitch';
  const twinKindLabel = includesFutsal ? 'cricket pitch' : 'futsal pitch';

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

  const [shareSameField, setShareSameField] = useState(false);
  const [linkedTwinCourtId, setLinkedTwinCourtId] = useState('');
  const [initialTwinCourtId, setInitialTwinCourtId] = useState('');
  const [twinOptions, setTwinOptions] = useState<NamedCourt[]>([]);
  const [timeSlotTemplateOptions, setTimeSlotTemplateOptions] = useState<
    { id: string; name: string }[]
  >([]);

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
      setCricketFormat('');
      setCricketStumpsAvailable(false);
      setCricketBowlingMachine(false);
      setCricketPracticeMode('');
      setShareSameField(false);
      setLinkedTwinCourtId('');
      setInitialTwinCourtId('');
      setTwinOptions([]);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    void (async () => {
      try {
        if (includesFutsal) {
          const d: FutsalCourtDetail = await getFutsalCourt(existingCourtId);
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
          const ff = d.futsalFormat;
          setFutsalFormat(ff === '5v5' || ff === '6v6' || ff === '7v7' ? ff : '');
          setFutsalGoalPostsAvailable(d.futsalGoalPostsAvailable === true);
          setFutsalGoalPostSize(d.futsalGoalPostSize ?? '');
          const lm = d.futsalLineMarkings;
          setFutsalLineMarkings(
            lm === 'permanent' || lm === 'temporary' ? lm : '',
          );
          const linkedId =
            d.linkedTwinCourtKind === 'cricket_court'
              ? (d.linkedTwinCourtId ?? '').trim()
              : '';
          setInitialTwinCourtId(linkedId);
          setShareSameField(Boolean(linkedId));
          setLinkedTwinCourtId(linkedId);
        } else {
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
          const linkedId =
            d.linkedTwinCourtKind === 'futsal_court'
              ? (d.linkedTwinCourtId ?? '').trim()
              : '';
          setInitialTwinCourtId(linkedId);
          setShareSameField(Boolean(linkedId));
          setLinkedTwinCourtId(linkedId);
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
  }, [existingCourtId, includesFutsal, locationId]);

  useEffect(() => {
    if (!existingCourtId && locationId) setArenaLocationId(locationId);
  }, [locationId, existingCourtId]);

  useEffect(() => {
    if (!arenaLocationId) {
      setTwinOptions([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const rows = includesFutsal
          ? await listCricketCourts(arenaLocationId)
          : await listFutsalCourts(arenaLocationId);
        if (cancelled) return;
        setTwinOptions(rows);
      } catch {
        if (!cancelled) setTwinOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [arenaLocationId, includesFutsal]);

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

  useEffect(() => {
    if (existingCourtId || !isSingleKind || !shareSameField || !linkedTwinCourtId)
      return;
    let cancelled = false;
    void (async () => {
      try {
        const twin: CricketCourtDetail | FutsalCourtDetail = includesFutsal
          ? await getCricketCourt(linkedTwinCourtId)
          : await getFutsalCourt(linkedTwinCourtId);
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
  }, [
    existingCourtId,
    includesFutsal,
    isSingleKind,
    linkedTwinCourtId,
    shareSameField,
  ]);

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
    if (isSingleKind && shareSameField && !linkedTwinCourtId) {
      setErr(`Select a ${twinKindLabel} to mark this as the same physical field.`);
      return;
    }
    const arena = locations.find((l) => l.id === arenaLocationId);
    const templatePayload = shared.timeSlotTemplateId.trim()
      ? { timeSlotTemplateId: shared.timeSlotTemplateId.trim() }
      : existingCourtId
        ? { timeSlotTemplateId: null as null }
        : {};
    const shouldLinkTwin =
      isSingleKind && shareSameField && !!linkedTwinCourtId.trim();
    setSaving(true);
    setErr(null);
    try {
      if (!existingCourtId && courtKind === 'both') {
        const futsalBody: CreateFutsalCourtBody = {
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
        const cricketBody: CreateCricketCourtBody = {
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
        const createdFutsal = await createFutsalCourt(futsalBody);
        const createdCricket = await createCricketCourt(cricketBody);
        await createTurfTwinLink({
          futsalCourtId: createdFutsal.id,
          cricketCourtId: createdCricket.id,
        });
      } else if (includesFutsal) {
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
          linkedTwinCourtKind:
            !existingCourtId && shouldLinkTwin ? 'cricket_court' : undefined,
          linkedTwinCourtId:
            !existingCourtId && shouldLinkTwin ? linkedTwinCourtId : undefined,
        };
        if (existingCourtId) {
          const { businessLocationId: _b, ...patch } = body;
          await updateFutsalCourt(existingCourtId, patch);
          if (initialTwinCourtId && !shouldLinkTwin) {
            await removeTurfTwinLink({ courtKind: 'futsal_court', courtId: existingCourtId });
          } else if (shouldLinkTwin && linkedTwinCourtId !== initialTwinCourtId) {
            if (initialTwinCourtId) {
              await removeTurfTwinLink({ courtKind: 'futsal_court', courtId: existingCourtId });
            }
            await createTurfTwinLink({
              futsalCourtId: existingCourtId,
              cricketCourtId: linkedTwinCourtId,
            });
          }
        } else {
          await createFutsalCourt(body);
        }
      } else {
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
          linkedTwinCourtKind:
            !existingCourtId && shouldLinkTwin ? 'futsal_court' : undefined,
          linkedTwinCourtId:
            !existingCourtId && shouldLinkTwin ? linkedTwinCourtId : undefined,
        };
        if (existingCourtId) {
          const { businessLocationId: _b, ...patch } = body;
          await updateCricketCourt(existingCourtId, patch);
          if (initialTwinCourtId && !shouldLinkTwin) {
            await removeTurfTwinLink({ courtKind: 'cricket_court', courtId: existingCourtId });
          } else if (shouldLinkTwin && linkedTwinCourtId !== initialTwinCourtId) {
            if (initialTwinCourtId) {
              await removeTurfTwinLink({ courtKind: 'cricket_court', courtId: existingCourtId });
            }
            await createTurfTwinLink({
              futsalCourtId: linkedTwinCourtId,
              cricketCourtId: existingCourtId,
            });
          }
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
        {isSingleKind ? (
          <div className="connection-panel" style={{ marginTop: '0.5rem' }}>
          <label className="turf-setup-inline">
            <input
              type="checkbox"
              checked={shareSameField}
              onChange={(e) => {
                const checked = e.target.checked;
                setShareSameField(checked);
                if (!checked) setLinkedTwinCourtId('');
              }}
            />
            Same physical field as an existing {twinKindLabel} (shared booking calendar)
          </label>
          {shareSameField ? (
            <div style={{ marginTop: '0.75rem' }}>
              <label>{twinKindLabel.charAt(0).toUpperCase() + twinKindLabel.slice(1)} to link *</label>
              <select value={linkedTwinCourtId} onChange={(e) => setLinkedTwinCourtId(e.target.value)}>
                <option value="">Select {twinKindLabel}…</option>
                {twinOptions.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
              <p className="muted" style={{ marginTop: '0.35rem' }}>
                {existingCourtId
                  ? 'Save changes to apply updated shared-field linking.'
                  : `Shared turf details are auto-filled from the selected ${twinKindLabel}, and both sides are treated as one field for availability.`}
              </p>
            </div>
          ) : null}
          </div>
        ) : (
          <div className="connection-panel" style={{ marginTop: '0.5rem' }}>
            <p className="muted" style={{ margin: 0 }}>
              Both sports are enabled. This submission creates futsal + cricket
              together as one linked field.
            </p>
          </div>
        )}
        <div className="turf-setup-form-actions">
          <button type="submit" className="btn-primary" disabled={saving || !shared.name.trim()}>
            {saving ? 'Saving…' : existingCourtId ? 'Save changes' : `Create ${ownKindLabel}`}
          </button>
        </div>
      </form>
    </div>
  );
}

