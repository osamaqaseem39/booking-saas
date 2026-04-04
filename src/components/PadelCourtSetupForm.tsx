import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createPadelCourt,
  getPadelCourt,
  updatePadelCourt,
  type CreatePadelCourtBody,
  type PadelCourtDetail,
} from '../api/saasClient';
import type { BusinessLocationRow } from '../types/domain';

function parseNum(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

function parseIntOpt(s: string): number | undefined {
  const t = s.trim();
  if (!t) return undefined;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) ? n : undefined;
}

function glassBool(s: 'yes' | 'no'): boolean {
  return s === 'yes';
}

function strFromApi(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

function buildPayload(
  locationId: string,
  p: {
    name: string;
    arenaLocationId: string;
    locations: BusinessLocationRow[];
    courtStatus: 'active' | 'maintenance';
    imageLines: string;
    ceilingHeightValue: string;
    ceilingHeightUnit: 'ft' | 'm';
    coveredType: CreatePadelCourtBody['coveredType'];
    glassWalls: 'yes' | 'no';
    wallType: CreatePadelCourtBody['wallType'];
    lighting: string;
    ventilation: string;
    lengthM: string;
    widthM: string;
    surfaceType: CreatePadelCourtBody['surfaceType'];
    matchType: NonNullable<CreatePadelCourtBody['matchType']>;
    maxPlayers: string;
    pricePerSlot: string;
    peakWeekdayEvening: string;
    peakWeekend: string;
    membershipPrice: string;
    slotDuration: '60' | '90' | '';
    bufferMinutes: string;
    extraRacket: boolean;
    extraBall: boolean;
    extraCoaching: boolean;
    amenSeating: boolean;
    amenChanging: boolean;
    amenParking: boolean;
    gameRules: string;
    cancellationPolicy: string;
    description: string;
    isActive: boolean;
  },
): CreatePadelCourtBody {
  const ceilingH = parseNum(p.ceilingHeightValue);
  if (ceilingH === undefined) {
    throw new Error('Ceiling height is required (critical for lobs).');
  }
  if (!p.coveredType) {
    throw new Error('Select covered type (indoor or semi-covered).');
  }
  if (!p.wallType) {
    throw new Error('Select wall type.');
  }

  const arena = p.locations.find((l) => l.id === p.arenaLocationId);
  const imageUrls = p.imageLines
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

  const len = parseNum(p.lengthM);
  const wid = parseNum(p.widthM);
  const maxP = parseIntOpt(p.maxPlayers);

  const body: CreatePadelCourtBody = {
    businessLocationId: locationId,
    name: p.name.trim(),
    courtStatus: p.courtStatus,
    arenaLabel: arena?.name?.trim() || undefined,
    imageUrls: imageUrls.length ? imageUrls : undefined,
    ceilingHeightValue: ceilingH,
    ceilingHeightUnit: p.ceilingHeightUnit,
    coveredType: p.coveredType,
    glassWalls: glassBool(p.glassWalls),
    wallType: p.wallType,
    lighting: p.lighting.trim() || undefined,
    ventilation: p.ventilation.trim() || undefined,
    lengthM: len ?? 20,
    widthM: wid ?? 10,
    surfaceType: p.surfaceType,
    matchType: p.matchType,
    maxPlayers: maxP ?? 4,
    pricePerSlot: parseNum(p.pricePerSlot),
    membershipPrice: parseNum(p.membershipPrice),
    slotDurationMinutes:
      p.slotDuration === '60' ? 60 : p.slotDuration === '90' ? 90 : undefined,
    bufferBetweenSlotsMinutes: parseIntOpt(p.bufferMinutes),
  };

  const wd = parseNum(p.peakWeekdayEvening);
  const we = parseNum(p.peakWeekend);
  if (wd !== undefined || we !== undefined) {
    body.peakPricing = {
      ...(wd !== undefined ? { weekdayEvening: wd } : {}),
      ...(we !== undefined ? { weekend: we } : {}),
    };
  }

  const extras: NonNullable<CreatePadelCourtBody['extras']> = {};
  if (p.extraRacket) extras.racketRental = true;
  if (p.extraBall) extras.ballRental = true;
  if (p.extraCoaching) extras.coachingAvailable = true;
  if (Object.keys(extras).length) body.extras = extras;

  const amenities: NonNullable<CreatePadelCourtBody['amenities']> = {};
  if (p.amenSeating) amenities.seating = true;
  if (p.amenChanging) amenities.changingRoom = true;
  if (p.amenParking) amenities.parking = true;
  if (Object.keys(amenities).length) body.amenities = amenities;

  const gr = p.gameRules.trim();
  const cp = p.cancellationPolicy.trim();
  const rulesMax = maxP ?? 4;
  if (gr || cp) {
    body.rules = {
      maxPlayers: rulesMax,
      ...(gr ? { gameRules: gr } : {}),
      ...(cp ? { cancellationPolicy: cp } : {}),
    };
  }

  const desc = p.description.trim();
  if (desc) body.description = desc;
  body.isActive = p.isActive;

  return body;
}

export function PadelCourtSetupForm({
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
  const [name, setName] = useState('');
  const [arenaLocationId, setArenaLocationId] = useState(locationId);
  const [courtStatus, setCourtStatus] = useState<'active' | 'maintenance'>(
    'active',
  );
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [imageLines, setImageLines] = useState('');

  const [ceilingHeightValue, setCeilingHeightValue] = useState('');
  const [ceilingHeightUnit, setCeilingHeightUnit] = useState<'ft' | 'm'>('m');
  const [coveredType, setCoveredType] = useState<
    '' | 'indoor' | 'semi_covered'
  >('indoor');
  const [glassWalls, setGlassWalls] = useState<'yes' | 'no'>('yes');
  const [wallType, setWallType] = useState<
    '' | 'full_glass' | 'glass_mesh'
  >('full_glass');
  const [lighting, setLighting] = useState('');
  const [ventilation, setVentilation] = useState('');

  const [lengthM, setLengthM] = useState('20');
  const [widthM, setWidthM] = useState('10');

  const [surfaceType, setSurfaceType] = useState<
    '' | 'synthetic_turf' | 'acrylic'
  >('');
  const [matchType, setMatchType] = useState<'singles' | 'doubles'>('doubles');
  const [maxPlayers, setMaxPlayers] = useState('4');

  const [pricePerSlot, setPricePerSlot] = useState('');
  const [peakWeekdayEvening, setPeakWeekdayEvening] = useState('');
  const [peakWeekend, setPeakWeekend] = useState('');
  const [membershipPrice, setMembershipPrice] = useState('');

  const [slotDuration, setSlotDuration] = useState<'60' | '90' | ''>('60');
  const [bufferMinutes, setBufferMinutes] = useState('');

  const [extraRacket, setExtraRacket] = useState(false);
  const [extraBall, setExtraBall] = useState(false);
  const [extraCoaching, setExtraCoaching] = useState(false);

  const [amenSeating, setAmenSeating] = useState(false);
  const [amenChanging, setAmenChanging] = useState(false);
  const [amenParking, setAmenParking] = useState(false);

  const [gameRules, setGameRules] = useState('');
  const [cancellationPolicy, setCancellationPolicy] = useState('');

  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(!!existingCourtId);
  const [initialLoadError, setInitialLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!existingCourtId) {
      setLoadingDetail(false);
      setInitialLoadError(null);
      return;
    }
    let cancelled = false;
    setLoadingDetail(true);
    setInitialLoadError(null);
    void (async () => {
      try {
        const d: PadelCourtDetail = await getPadelCourt(existingCourtId);
        if (cancelled) return;

        setName(d.name ?? '');
        setArenaLocationId(d.businessLocationId ?? locationId);
        setCourtStatus(d.courtStatus === 'maintenance' ? 'maintenance' : 'active');
        setDescription(d.description ?? '');
        setIsActive(d.isActive !== false);
        setImageLines(Array.isArray(d.imageUrls) ? d.imageUrls.join('\n') : '');
        setCeilingHeightValue(strFromApi(d.ceilingHeightValue));
        setCeilingHeightUnit(
          d.ceilingHeightUnit === 'ft' || d.ceilingHeightUnit === 'm'
            ? d.ceilingHeightUnit
            : 'm',
        );
        const cov = d.coveredType;
        setCoveredType(
          cov === 'indoor' || cov === 'semi_covered' ? cov : 'indoor',
        );
        setGlassWalls(d.glassWalls === false ? 'no' : 'yes');
        const wt = d.wallType;
        setWallType(wt === 'full_glass' || wt === 'glass_mesh' ? wt : 'full_glass');
        setLighting(d.lighting ?? '');
        setVentilation(d.ventilation ?? '');
        setLengthM(strFromApi(d.lengthM) || '20');
        setWidthM(strFromApi(d.widthM) || '10');
        const st = d.surfaceType;
        setSurfaceType(
          st === 'synthetic_turf' || st === 'acrylic' ? st : '',
        );
        setMatchType(d.matchType === 'singles' ? 'singles' : 'doubles');
        setPricePerSlot(strFromApi(d.pricePerSlot));
        const peak = d.peakPricing;
        if (peak && typeof peak === 'object') {
          setPeakWeekdayEvening(strFromApi(peak.weekdayEvening));
          setPeakWeekend(strFromApi(peak.weekend));
        } else {
          setPeakWeekdayEvening('');
          setPeakWeekend('');
        }
        setMembershipPrice(strFromApi(d.membershipPrice));
        const sd = d.slotDurationMinutes;
        setSlotDuration(sd === 60 ? '60' : sd === 90 ? '90' : '');
        setBufferMinutes(strFromApi(d.bufferBetweenSlotsMinutes));

        const ex = d.extras;
        setExtraRacket(!!ex?.racketRental);
        setExtraBall(!!ex?.ballRental);
        setExtraCoaching(!!ex?.coachingAvailable);

        const am = d.amenities;
        setAmenSeating(!!am?.seating);
        setAmenChanging(!!am?.changingRoom);
        setAmenParking(!!am?.parking);

        const rules = d.rules;
        setGameRules(rules?.gameRules ?? '');
        setCancellationPolicy(rules?.cancellationPolicy ?? '');
        if (rules?.maxPlayers !== undefined && rules.maxPlayers !== null) {
          setMaxPlayers(String(rules.maxPlayers));
        } else if (d.maxPlayers !== undefined && d.maxPlayers !== null) {
          setMaxPlayers(String(d.maxPlayers));
        } else {
          setMaxPlayers('4');
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
  }, [existingCourtId, locationId]);

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
    if (!effectiveLocationId || !name.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const payload = buildPayload(effectiveLocationId, {
        name,
        arenaLocationId,
        locations,
        courtStatus,
        imageLines,
        ceilingHeightValue,
        ceilingHeightUnit,
        coveredType: coveredType || undefined,
        glassWalls,
        wallType: wallType || undefined,
        lighting,
        ventilation,
        lengthM,
        widthM,
        surfaceType: surfaceType || undefined,
        matchType,
        maxPlayers,
        pricePerSlot,
        peakWeekdayEvening,
        peakWeekend,
        membershipPrice,
        slotDuration,
        bufferMinutes,
        extraRacket,
        extraBall,
        extraCoaching,
        amenSeating,
        amenChanging,
        amenParking,
        gameRules,
        cancellationPolicy,
        description,
        isActive,
      });
      if (existingCourtId) {
        const { businessLocationId: _loc, ...patch } = payload;
        await updatePadelCourt(existingCourtId, patch);
      } else {
        await createPadelCourt(payload);
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

  return (
    <div className="turf-setup-form-wrap">
      <form className="form-grid turf-setup-form" onSubmit={(e) => void onSubmit(e)}>
        {err && <div className="err-banner turf-setup-form-error">{err}</div>}

      <div className="turf-setup-card">
        <h4>1. Basic information</h4>
        <div className="form-grid">
          <div>
            <label>Court name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={160}
              placeholder="e.g. Padel court 1"
            />
          </div>
          <div>
            <label>Arena</label>
            <select
              value={arenaLocationId}
              onChange={(e) => setArenaLocationId(e.target.value)}
              disabled={!!existingCourtId}
              title={
                existingCourtId
                  ? 'Location cannot be changed for an existing court.'
                  : undefined
              }
            >
              {locationOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Court status</label>
            <select
              value={courtStatus}
              onChange={(e) =>
                setCourtStatus(e.target.value as 'active' | 'maintenance')
              }
            >
              <option value="active">Active</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
          <div>
            <label>Description (optional)</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short public description"
            />
          </div>
          <div>
            <label className="turf-setup-inline">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Accepting bookings (active listing)
            </label>
          </div>
          <div>
            <label>Image URLs (one per line)</label>
            <textarea
              rows={3}
              value={imageLines}
              onChange={(e) => setImageLines(e.target.value)}
              placeholder="https://…"
            />
            <p className="muted" style={{ marginTop: '0.35rem', fontSize: '0.85rem' }}>
              Paste image links; file upload can be added later if your storage
              is connected.
            </p>
          </div>
        </div>
      </div>

      <div className="turf-setup-card">
        <h4>2. Structure details</h4>
        <p className="muted" style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
          Fixed padel-specific structure (ceiling height is required for lobs).
        </p>
        <div className="form-grid">
          <div className="form-row-2">
            <div>
              <label>Ceiling height (required)</label>
              <input
                type="text"
                inputMode="decimal"
                value={ceilingHeightValue}
                onChange={(e) => setCeilingHeightValue(e.target.value)}
                placeholder="e.g. 8"
                required
              />
            </div>
            <div>
              <label>Unit</label>
              <select
                value={ceilingHeightUnit}
                onChange={(e) =>
                  setCeilingHeightUnit(e.target.value as 'ft' | 'm')
                }
              >
                <option value="m">m</option>
                <option value="ft">ft</option>
              </select>
            </div>
          </div>
          <div>
            <label>Covered type</label>
            <select
              value={coveredType}
              onChange={(e) =>
                setCoveredType(e.target.value as '' | 'indoor' | 'semi_covered')
              }
            >
              <option value="indoor">Indoor</option>
              <option value="semi_covered">Semi-covered</option>
            </select>
          </div>
          <div>
            <label>Glass walls</label>
            <select
              value={glassWalls}
              onChange={(e) => setGlassWalls(e.target.value as 'yes' | 'no')}
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label>Wall type</label>
            <select
              value={wallType}
              onChange={(e) =>
                setWallType(e.target.value as '' | 'full_glass' | 'glass_mesh')
              }
            >
              <option value="full_glass">Full glass</option>
              <option value="glass_mesh">Glass + mesh</option>
            </select>
          </div>
          <div>
            <label>Lighting</label>
            <input
              value={lighting}
              onChange={(e) => setLighting(e.target.value)}
              maxLength={80}
              placeholder="e.g. LED overhead"
            />
          </div>
          <div>
            <label>Ventilation</label>
            <input
              value={ventilation}
              onChange={(e) => setVentilation(e.target.value)}
              maxLength={80}
              placeholder="e.g. Natural + fans"
            />
          </div>
        </div>
      </div>

      <div className="turf-setup-card">
        <h4>3. Dimensions (meters)</h4>
        <p className="muted" style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
          Standard padel is ~20m × ~10m; adjust if your court differs.
        </p>
        <div className="form-row-2">
          <div>
            <label>Length (m)</label>
            <input
              type="text"
              inputMode="decimal"
              value={lengthM}
              onChange={(e) => setLengthM(e.target.value)}
              placeholder="20"
            />
          </div>
          <div>
            <label>Width (m)</label>
            <input
              type="text"
              inputMode="decimal"
              value={widthM}
              onChange={(e) => setWidthM(e.target.value)}
              placeholder="10"
            />
          </div>
        </div>
      </div>

      <div className="turf-setup-card">
        <h4>4. Surface</h4>
        <div>
          <label>Surface type</label>
          <select
            value={surfaceType}
            onChange={(e) =>
              setSurfaceType(
                e.target.value as '' | 'synthetic_turf' | 'acrylic',
              )
            }
          >
            <option value="">—</option>
            <option value="synthetic_turf">Synthetic turf</option>
            <option value="acrylic">Acrylic</option>
          </select>
        </div>
      </div>

      <div className="turf-setup-card">
        <h4>5. Game settings</h4>
        <div className="form-grid">
          <div>
            <label>Match type</label>
            <select
              value={matchType}
              onChange={(e) =>
                setMatchType(e.target.value as 'singles' | 'doubles')
              }
            >
              <option value="singles">Singles</option>
              <option value="doubles">Doubles</option>
            </select>
          </div>
          <div>
            <label>Max players</label>
            <input
              type="text"
              inputMode="numeric"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(e.target.value)}
              placeholder="4"
            />
          </div>
        </div>
      </div>

      <div className="turf-setup-card">
        <h4>6. Pricing</h4>
        <div className="form-grid">
          <div>
            <label>Price per slot</label>
            <input
              type="text"
              inputMode="decimal"
              value={pricePerSlot}
              onChange={(e) => setPricePerSlot(e.target.value)}
              placeholder="e.g. 200"
            />
          </div>
          <div className="form-row-2">
            <div>
              <label>Peak — weekday evening</label>
              <input
                type="text"
                inputMode="decimal"
                value={peakWeekdayEvening}
                onChange={(e) => setPeakWeekdayEvening(e.target.value)}
                placeholder="optional"
              />
            </div>
            <div>
              <label>Peak — weekend</label>
              <input
                type="text"
                inputMode="decimal"
                value={peakWeekend}
                onChange={(e) => setPeakWeekend(e.target.value)}
                placeholder="optional"
              />
            </div>
          </div>
          <div>
            <label>Membership price</label>
            <input
              type="text"
              inputMode="decimal"
              value={membershipPrice}
              onChange={(e) => setMembershipPrice(e.target.value)}
              placeholder="optional"
            />
          </div>
        </div>
      </div>

      <div className="turf-setup-card">
        <h4>7. Slot settings</h4>
        <div className="form-grid">
          <div>
            <label>Slot duration</label>
            <select
              value={slotDuration}
              onChange={(e) =>
                setSlotDuration(e.target.value as '60' | '90' | '')
              }
            >
              <option value="60">60 minutes</option>
              <option value="90">90 minutes</option>
              <option value="">—</option>
            </select>
          </div>
          <div>
            <label>Buffer between slots (minutes)</label>
            <input
              type="text"
              inputMode="numeric"
              value={bufferMinutes}
              onChange={(e) => setBufferMinutes(e.target.value)}
              placeholder="e.g. 10"
            />
          </div>
        </div>
      </div>

      <div className="turf-setup-card">
        <h4>8. Extras</h4>
        <div className="turf-setup-checkrow turf-setup-checkrow--wrap">
          <label className="turf-setup-inline">
            <input
              type="checkbox"
              checked={extraRacket}
              onChange={() => setExtraRacket((v) => !v)}
            />
            Racket rental
          </label>
          <label className="turf-setup-inline">
            <input
              type="checkbox"
              checked={extraBall}
              onChange={() => setExtraBall((v) => !v)}
            />
            Ball rental
          </label>
          <label className="turf-setup-inline">
            <input
              type="checkbox"
              checked={extraCoaching}
              onChange={() => setExtraCoaching((v) => !v)}
            />
            Coaching available
          </label>
        </div>
      </div>

      <div className="turf-setup-card">
        <h4>9. Amenities</h4>
        <div className="turf-setup-checkrow turf-setup-checkrow--wrap">
          <label className="turf-setup-inline">
            <input
              type="checkbox"
              checked={amenSeating}
              onChange={() => setAmenSeating((v) => !v)}
            />
            Seating
          </label>
          <label className="turf-setup-inline">
            <input
              type="checkbox"
              checked={amenChanging}
              onChange={() => setAmenChanging((v) => !v)}
            />
            Changing room
          </label>
          <label className="turf-setup-inline">
            <input
              type="checkbox"
              checked={amenParking}
              onChange={() => setAmenParking((v) => !v)}
            />
            Parking
          </label>
        </div>
      </div>

      <div className="turf-setup-card">
        <h4>10. Rules</h4>
        <p className="muted" style={{ marginBottom: '0.5rem', fontSize: '0.85rem' }}>
          Max players: <strong>{maxPlayers.trim() || '4'}</strong> (editable in
          section 5). When you add text below, the same cap is saved on the
          rules record for policies that reference it.
        </p>
        <div className="form-grid">
          <div>
            <label>Game rules</label>
            <textarea
              rows={3}
              value={gameRules}
              onChange={(e) => setGameRules(e.target.value)}
              placeholder="Dress code, footwear, booking etiquette…"
            />
          </div>
          <div>
            <label>Cancellation policy</label>
            <textarea
              rows={3}
              value={cancellationPolicy}
              onChange={(e) => setCancellationPolicy(e.target.value)}
              placeholder="Refund windows, no-show policy…"
            />
          </div>
        </div>
      </div>

      <div className="turf-setup-form-actions">
        <button
          type="submit"
          className="btn-primary"
          disabled={saving || !name.trim() || loadingDetail}
        >
          {saving
            ? 'Saving…'
            : existingCourtId
              ? 'Save changes'
              : 'Create padel court'}
        </button>
      </div>
      </form>
    </div>
  );
}
