import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createTurfTwinLink,
  createFutsalCourt,
  getCricketCourt,
  getFutsalCourt,
  listCricketCourts,
  listTimeSlotTemplates,
  removeTurfTwinLink,
  updateFutsalCourt,
  type CricketCourtDetail,
  type CreateFutsalCourtBody,
  type FutsalCourtDetail,
} from '../../../api/saasClient';
import type { BusinessLocationRow, NamedCourt } from '../../../types/domain';
import { ArenaCourtSharedTurfSections } from './ArenaCourtSharedTurfSections';
import {
  emptySharedArenaTurfState,
  sharedDetailToFormState,
  sharedTurfFormStateToPayload,
  type SharedArenaTurfFormState,
} from './sharedArenaTurfFormState';

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
  const [courtStatus, setCourtStatus] = useState<
    'active' | 'maintenance' | 'draft'
  >('active');
  const [futsalFormat, setFutsalFormat] = useState<
    '5v5' | '6v6' | '7v7' | ''
  >('');
  const [futsalGoalPostsAvailable, setFutsalGoalPostsAvailable] =
    useState(false);
  const [futsalGoalPostSize, setFutsalGoalPostSize] = useState('');
  const [futsalLineMarkings, setFutsalLineMarkings] = useState<
    'permanent' | 'temporary' | ''
  >('');
  const [sameFieldAsCricket, setSameFieldAsCricket] = useState(false);
  const [selectedCricketTwinId, setSelectedCricketTwinId] = useState('');
  const [initialCricketTwinId, setInitialCricketTwinId] = useState('');
  const [cricketTwinOptions, setCricketTwinOptions] = useState<NamedCourt[]>([]);
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
      setSameFieldAsCricket(false);
      setSelectedCricketTwinId('');
      setInitialCricketTwinId('');
      setCricketTwinOptions([]);
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
        const linkedCricketId =
          d.linkedTwinCourtKind === 'cricket_court'
            ? (d.linkedTwinCourtId ?? '').trim()
            : '';
        setInitialCricketTwinId(linkedCricketId);
        setSameFieldAsCricket(Boolean(linkedCricketId));
        setSelectedCricketTwinId(linkedCricketId);
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
    if (!arenaLocationId) {
      setCricketTwinOptions([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const rows = await listCricketCourts(arenaLocationId);
        if (cancelled) return;
        setCricketTwinOptions(rows);
      } catch {
        if (!cancelled) setCricketTwinOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [arenaLocationId]);

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
    if (existingCourtId || !sameFieldAsCricket || !selectedCricketTwinId) return;
    let cancelled = false;
    void (async () => {
      try {
        const twin: CricketCourtDetail = await getCricketCourt(selectedCricketTwinId);
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
  }, [existingCourtId, sameFieldAsCricket, selectedCricketTwinId]);

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
    if (sameFieldAsCricket && !selectedCricketTwinId) {
      setErr('Select a cricket pitch to mark this as the same physical field.');
      return;
    }
    const arena = locations.find((l) => l.id === arenaLocationId);
    const sharedPayload = sharedTurfFormStateToPayload(shared);
    const templatePayload = shared.timeSlotTemplateId.trim()
      ? { timeSlotTemplateId: shared.timeSlotTemplateId.trim() }
      : existingCourtId
        ? { timeSlotTemplateId: null as null }
        : {};
    const shouldLinkCricket = sameFieldAsCricket && !!selectedCricketTwinId.trim();
    const body: CreateFutsalCourtBody = {
      businessLocationId: effectiveLocationId,
      name: shared.name.trim(),
      courtStatus,
      arenaLabel: arena?.name?.trim() || undefined,
      ...sharedPayload,
      ...templatePayload,
      futsalFormat: futsalFormat || undefined,
      futsalGoalPostsAvailable: futsalGoalPostsAvailable || undefined,
      futsalGoalPostSize: futsalGoalPostSize.trim() || undefined,
      futsalLineMarkings: futsalLineMarkings || undefined,
      linkedTwinCourtKind:
        !existingCourtId && shouldLinkCricket
          ? 'cricket_court'
          : undefined,
      linkedTwinCourtId:
        !existingCourtId && shouldLinkCricket
          ? selectedCricketTwinId
          : undefined,
    };
    setSaving(true);
    setErr(null);
    try {
      if (existingCourtId) {
        const { businessLocationId: _b, ...patch } = body;
        await updateFutsalCourt(existingCourtId, patch);
        if (initialCricketTwinId && !shouldLinkCricket) {
          await removeTurfTwinLink({
            courtKind: 'futsal_court',
            courtId: existingCourtId,
          });
        } else if (
          shouldLinkCricket &&
          selectedCricketTwinId !== initialCricketTwinId
        ) {
          if (initialCricketTwinId) {
            await removeTurfTwinLink({
              courtKind: 'futsal_court',
              courtId: existingCourtId,
            });
          }
          await createTurfTwinLink({
            futsalCourtId: existingCourtId,
            cricketCourtId: selectedCricketTwinId,
          });
        }
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
          timeSlotTemplateOptions={timeSlotTemplateOptions}
          gameSection={gameSection}
        />
        <div className="connection-panel" style={{ marginTop: '0.5rem' }}>
          <label className="turf-setup-inline">
            <input
              type="checkbox"
              checked={sameFieldAsCricket}
              onChange={(e) => {
                const checked = e.target.checked;
                setSameFieldAsCricket(checked);
                if (!checked) setSelectedCricketTwinId('');
              }}
            />
            Same physical field as an existing cricket pitch (shared booking calendar)
          </label>
          {sameFieldAsCricket ? (
            <div style={{ marginTop: '0.75rem' }}>
              <label>Cricket pitch to link *</label>
              <select
                value={selectedCricketTwinId}
                onChange={(e) => setSelectedCricketTwinId(e.target.value)}
              >
                <option value="">Select cricket pitch…</option>
                {cricketTwinOptions.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
              <p className="muted" style={{ marginTop: '0.35rem' }}>
                {existingCourtId
                  ? 'Save changes to apply updated shared-field linking.'
                  : 'Shared turf details are auto-filled from the selected cricket pitch, and both sides are treated as one field for availability.'}
              </p>
            </div>
          ) : null}
        </div>
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



