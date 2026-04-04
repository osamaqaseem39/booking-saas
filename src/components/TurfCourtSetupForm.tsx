import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  createTurfCourt,
  getTurfCourt,
  updateTurfCourt,
  type CreateTurfCourtBody,
  type TurfCourtDetail,
} from '../api/saasClient';
import type { BusinessLocationRow } from '../types/domain';

type Vent = 'natural' | 'fans' | 'ac';

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

function triBool(s: '' | 'yes' | 'no'): boolean | undefined {
  if (s === '') return undefined;
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
    coveredType: CreateTurfCourtBody['coveredType'];
    sideNetting: '' | 'yes' | 'no';
    netHeight: string;
    boundaryType: CreateTurfCourtBody['boundaryType'];
    ventilation: Vent[];
    lighting: CreateTurfCourtBody['lighting'];
    lengthM: string;
    widthM: string;
    surfaceType: CreateTurfCourtBody['surfaceType'];
    turfQuality: string;
    shockAbsorption: '' | 'yes' | 'no';
    supportFutsal: boolean;
    supportCricket: boolean;
    futsalFormat: CreateTurfCourtBody['futsalFormat'];
    futsalGoalPosts: '' | 'yes' | 'no';
    futsalGoalPostSize: string;
    futsalLineMarkings: CreateTurfCourtBody['futsalLineMarkings'];
    cricketFormat: CreateTurfCourtBody['cricketFormat'];
    cricketStumps: '' | 'yes' | 'no';
    cricketBowlingMachine: '' | 'yes' | 'no';
    cricketPracticeMode: CreateTurfCourtBody['cricketPracticeMode'];
    futsalPricePerSlot: string;
    cricketPricePerSlot: string;
    peakWeekdayEvening: string;
    peakWeekend: string;
    discountLabel: string;
    discountAmount: string;
    discountPercent: string;
    slotDuration: string;
    bufferMinutes: string;
    allowParallel: '' | 'yes' | 'no';
    amenChanging: boolean;
    amenWashroom: boolean;
    amenParking: boolean;
    amenWater: boolean;
    amenSeating: boolean;
    maxPlayers: string;
    safetyInstructions: string;
    cancellationPolicy: string;
  },
): CreateTurfCourtBody {
  if (!p.supportFutsal && !p.supportCricket) {
    throw new Error('Select at least one sport (Futsal and/or Cricket).');
  }
  const sportMode: CreateTurfCourtBody['sportMode'] = p.supportFutsal &&
    p.supportCricket
    ? 'both'
    : p.supportFutsal
      ? 'futsal_only'
      : 'cricket_only';

  const arena = p.locations.find((l) => l.id === p.arenaLocationId);
  const imageUrls = p.imageLines
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);

  const ceilingH = parseNum(p.ceilingHeightValue);
  const slotDurationValue = parseIntOpt(p.slotDuration);
  if (
    slotDurationValue !== undefined &&
    (slotDurationValue < 60 || slotDurationValue % 30 !== 0)
  ) {
    throw new Error('Slot duration must be at least 60 and in 30-minute intervals.');
  }
  const body: CreateTurfCourtBody = {
    businessLocationId: locationId,
    name: p.name.trim(),
    sportMode,
    courtStatus: p.courtStatus,
    arenaLabel: arena?.name?.trim() || undefined,
    imageUrls: imageUrls.length ? imageUrls : undefined,
    ceilingHeightValue: ceilingH,
    ceilingHeightUnit:
      ceilingH !== undefined ? p.ceilingHeightUnit : undefined,
    coveredType: p.coveredType,
    sideNetting: triBool(p.sideNetting),
    netHeight: p.netHeight.trim() || undefined,
    boundaryType: p.boundaryType,
    ventilation: p.ventilation.length ? p.ventilation : undefined,
    lighting: p.lighting,
    lengthM: parseNum(p.lengthM),
    widthM: parseNum(p.widthM),
    surfaceType: p.surfaceType,
    turfQuality: p.turfQuality.trim() || undefined,
    shockAbsorptionLayer: triBool(p.shockAbsorption),
    slotDurationMinutes: slotDurationValue,
    bufferBetweenSlotsMinutes: parseIntOpt(p.bufferMinutes),
    allowParallelBooking: triBool(p.allowParallel),
  };

  if (sportMode === 'futsal_only' || sportMode === 'both') {
    body.futsalFormat = p.futsalFormat;
    body.futsalGoalPostsAvailable = triBool(p.futsalGoalPosts);
    body.futsalGoalPostSize = p.futsalGoalPostSize.trim() || undefined;
    body.futsalLineMarkings = p.futsalLineMarkings;
    body.futsalPricePerSlot = parseNum(p.futsalPricePerSlot);
  }
  if (sportMode === 'cricket_only' || sportMode === 'both') {
    body.cricketFormat = p.cricketFormat;
    body.cricketStumpsAvailable = triBool(p.cricketStumps);
    body.cricketBowlingMachine = triBool(p.cricketBowlingMachine);
    body.cricketPracticeMode = p.cricketPracticeMode;
    body.cricketPricePerSlot = parseNum(p.cricketPricePerSlot);
  }

  const wd = parseNum(p.peakWeekdayEvening);
  const we = parseNum(p.peakWeekend);
  if (wd !== undefined || we !== undefined) {
    body.peakPricing = {
      ...(wd !== undefined ? { weekdayEvening: wd } : {}),
      ...(we !== undefined ? { weekend: we } : {}),
    };
  }

  const dLabel = p.discountLabel.trim();
  const dAmt = parseNum(p.discountAmount);
  const dPct = parseNum(p.discountPercent);
  if (dLabel || dAmt !== undefined || dPct !== undefined) {
    body.discountMembership = {
      ...(dLabel ? { label: dLabel } : {}),
      ...(dAmt !== undefined ? { amount: dAmt } : {}),
      ...(dPct !== undefined ? { percentOff: dPct } : {}),
    };
  }

  const amenities: NonNullable<CreateTurfCourtBody['amenities']> = {};
  if (p.amenChanging) amenities.changingRoom = true;
  if (p.amenWashroom) amenities.washroom = true;
  if (p.amenParking) amenities.parking = true;
  if (p.amenWater) amenities.drinkingWater = true;
  if (p.amenSeating) amenities.seatingArea = true;
  if (Object.keys(amenities).length) body.amenities = amenities;

  const maxP = parseIntOpt(p.maxPlayers);
  const safety = p.safetyInstructions.trim();
  const cancel = p.cancellationPolicy.trim();
  if (maxP !== undefined || safety || cancel) {
    body.rules = {
      ...(maxP !== undefined ? { maxPlayers: maxP } : {}),
      ...(safety ? { safetyInstructions: safety } : {}),
      ...(cancel ? { cancellationPolicy: cancel } : {}),
    };
  }

  return body;
}

export function TurfCourtSetupForm({
  locationId,
  locations,
  onSuccess,
  existingCourtId,
}: {
  locationId: string;
  locations: BusinessLocationRow[];
  onSuccess: () => void;
  /** When set, load this court and PATCH on save instead of creating. */
  existingCourtId?: string;
}) {
  const [name, setName] = useState('');
  const [arenaLocationId, setArenaLocationId] = useState(locationId);
  const [courtStatus, setCourtStatus] = useState<'active' | 'maintenance'>(
    'active',
  );
  const [imageLines, setImageLines] = useState('');

  const [ceilingHeightValue, setCeilingHeightValue] = useState('');
  const [ceilingHeightUnit, setCeilingHeightUnit] = useState<'ft' | 'm'>('ft');
  const [coveredType, setCoveredType] = useState<
    'open' | 'semi_covered' | 'fully_indoor' | ''
  >('');
  const [sideNetting, setSideNetting] = useState<'' | 'yes' | 'no'>('');
  const [netHeight, setNetHeight] = useState('');
  const [boundaryType, setBoundaryType] = useState<'net' | 'wall' | ''>('');
  const [ventilation, setVentilation] = useState<Vent[]>([]);
  const [lighting, setLighting] = useState<
    'led_floodlights' | 'mixed' | 'daylight' | ''
  >('');

  const [lengthM, setLengthM] = useState('');
  const [widthM, setWidthM] = useState('');

  const [surfaceType, setSurfaceType] = useState<
    'artificial_turf' | 'hard_surface' | ''
  >('');
  const [turfQuality, setTurfQuality] = useState('');
  const [shockAbsorption, setShockAbsorption] = useState<'' | 'yes' | 'no'>(
    '',
  );

  const [supportFutsal, setSupportFutsal] = useState(true);
  const [supportCricket, setSupportCricket] = useState(true);

  const [futsalFormat, setFutsalFormat] = useState<
    '5v5' | '6v6' | '7v7' | ''
  >('');
  const [futsalGoalPosts, setFutsalGoalPosts] = useState<'' | 'yes' | 'no'>('');
  const [futsalGoalPostSize, setFutsalGoalPostSize] = useState('');
  const [futsalLineMarkings, setFutsalLineMarkings] = useState<
    'permanent' | 'temporary' | ''
  >('');

  const [cricketFormat, setCricketFormat] = useState<
    'tape_ball' | 'tennis_ball' | 'hard_ball' | ''
  >('');
  const [cricketStumps, setCricketStumps] = useState<'' | 'yes' | 'no'>('');
  const [cricketBowlingMachine, setCricketBowlingMachine] = useState<
    '' | 'yes' | 'no'
  >('');
  const [cricketPracticeMode, setCricketPracticeMode] = useState<
    'full_ground' | 'nets_mode' | ''
  >('');

  const [futsalPricePerSlot, setFutsalPricePerSlot] = useState('');
  const [cricketPricePerSlot, setCricketPricePerSlot] = useState('');
  const [peakWeekdayEvening, setPeakWeekdayEvening] = useState('');
  const [peakWeekend, setPeakWeekend] = useState('');
  const [discountLabel, setDiscountLabel] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');

  const [slotDuration, setSlotDuration] = useState('');
  const [bufferMinutes, setBufferMinutes] = useState('');
  const [allowParallel, setAllowParallel] = useState<'' | 'yes' | 'no'>('');

  const [amenChanging, setAmenChanging] = useState(false);
  const [amenWashroom, setAmenWashroom] = useState(false);
  const [amenParking, setAmenParking] = useState(false);
  const [amenWater, setAmenWater] = useState(false);
  const [amenSeating, setAmenSeating] = useState(false);

  const [maxPlayers, setMaxPlayers] = useState('');
  const [safetyInstructions, setSafetyInstructions] = useState('');
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
        const d: TurfCourtDetail = await getTurfCourt(existingCourtId);
        if (cancelled) return;

        setName(d.name ?? '');
        setArenaLocationId(d.businessLocationId ?? locationId);
        setCourtStatus(d.courtStatus === 'maintenance' ? 'maintenance' : 'active');
        setImageLines(Array.isArray(d.imageUrls) ? d.imageUrls.join('\n') : '');
        setCeilingHeightValue(strFromApi(d.ceilingHeightValue));
        setCeilingHeightUnit(
          d.ceilingHeightUnit === 'ft' || d.ceilingHeightUnit === 'm'
            ? d.ceilingHeightUnit
            : 'ft',
        );
        const cov = d.coveredType;
        setCoveredType(
          cov === 'open' || cov === 'semi_covered' || cov === 'fully_indoor'
            ? cov
            : '',
        );
        setSideNetting(
          d.sideNetting === true ? 'yes' : d.sideNetting === false ? 'no' : '',
        );
        setNetHeight(d.netHeight ?? '');
        const bt = d.boundaryType;
        setBoundaryType(bt === 'net' || bt === 'wall' ? bt : '');
        const vents = d.ventilation;
        setVentilation(
          Array.isArray(vents)
            ? (vents.filter(
                (x): x is Vent =>
                  x === 'natural' || x === 'fans' || x === 'ac',
              ) as Vent[])
            : [],
        );
        const li = d.lighting;
        setLighting(
          li === 'led_floodlights' || li === 'mixed' || li === 'daylight'
            ? li
            : '',
        );
        setLengthM(strFromApi(d.lengthM));
        setWidthM(strFromApi(d.widthM));
        const st = d.surfaceType;
        setSurfaceType(
          st === 'artificial_turf' || st === 'hard_surface' ? st : '',
        );
        setTurfQuality(d.turfQuality ?? '');
        setShockAbsorption(
          d.shockAbsorptionLayer === true
            ? 'yes'
            : d.shockAbsorptionLayer === false
              ? 'no'
              : '',
        );

        if (d.sportMode === 'futsal_only') {
          setSupportFutsal(true);
          setSupportCricket(false);
        } else if (d.sportMode === 'cricket_only') {
          setSupportFutsal(false);
          setSupportCricket(true);
        } else if (d.sportMode === 'both') {
          setSupportFutsal(true);
          setSupportCricket(true);
        } else {
          setSupportFutsal(d.supportsFutsal !== false);
          setSupportCricket(d.supportsCricket !== false);
        }

        const ff = d.futsalFormat;
        setFutsalFormat(ff === '5v5' || ff === '6v6' || ff === '7v7' ? ff : '');
        setFutsalGoalPosts(
          d.futsalGoalPostsAvailable === true
            ? 'yes'
            : d.futsalGoalPostsAvailable === false
              ? 'no'
              : '',
        );
        setFutsalGoalPostSize(d.futsalGoalPostSize ?? '');
        const flm = d.futsalLineMarkings;
        setFutsalLineMarkings(
          flm === 'permanent' || flm === 'temporary' ? flm : '',
        );

        const cf = d.cricketFormat;
        setCricketFormat(
          cf === 'tape_ball' || cf === 'tennis_ball' || cf === 'hard_ball'
            ? cf
            : '',
        );
        setCricketStumps(
          d.cricketStumpsAvailable === true
            ? 'yes'
            : d.cricketStumpsAvailable === false
              ? 'no'
              : '',
        );
        setCricketBowlingMachine(
          d.cricketBowlingMachine === true
            ? 'yes'
            : d.cricketBowlingMachine === false
              ? 'no'
              : '',
        );
        const cpm = d.cricketPracticeMode;
        setCricketPracticeMode(
          cpm === 'full_ground' || cpm === 'nets_mode' ? cpm : '',
        );

        setFutsalPricePerSlot(strFromApi(d.futsalPricePerSlot));
        setCricketPricePerSlot(strFromApi(d.cricketPricePerSlot));

        const peak = d.peakPricing;
        if (peak && typeof peak === 'object') {
          setPeakWeekdayEvening(strFromApi(peak.weekdayEvening));
          setPeakWeekend(strFromApi(peak.weekend));
        } else {
          setPeakWeekdayEvening('');
          setPeakWeekend('');
        }

        const disc = d.discountMembership;
        if (disc && typeof disc === 'object') {
          setDiscountLabel(disc.label ? String(disc.label) : '');
          setDiscountAmount(strFromApi(disc.amount));
          setDiscountPercent(strFromApi(disc.percentOff));
        } else {
          setDiscountLabel('');
          setDiscountAmount('');
          setDiscountPercent('');
        }

        setSlotDuration(strFromApi(d.slotDurationMinutes));
        setBufferMinutes(strFromApi(d.bufferBetweenSlotsMinutes));
        setAllowParallel(
          d.allowParallelBooking === true
            ? 'yes'
            : d.allowParallelBooking === false
              ? 'no'
              : '',
        );

        const am = d.amenities;
        setAmenChanging(!!am?.changingRoom);
        setAmenWashroom(!!am?.washroom);
        setAmenParking(!!am?.parking);
        setAmenWater(!!am?.drinkingWater);
        setAmenSeating(!!am?.seatingArea);

        const rules = d.rules;
        setMaxPlayers(
          rules?.maxPlayers !== undefined && rules.maxPlayers !== null
            ? String(rules.maxPlayers)
            : '',
        );
        setSafetyInstructions(rules?.safetyInstructions ?? '');
        setCancellationPolicy(rules?.cancellationPolicy ?? '');
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

  const showFutsal = supportFutsal;
  const showCricket = supportCricket;

  function toggleVent(v: Vent) {
    setVentilation((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    );
  }

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
        sideNetting,
        netHeight,
        boundaryType: boundaryType || undefined,
        ventilation,
        lighting: lighting || undefined,
        lengthM,
        widthM,
        surfaceType: surfaceType || undefined,
        turfQuality,
        shockAbsorption,
        supportFutsal,
        supportCricket,
        futsalFormat: futsalFormat || undefined,
        futsalGoalPosts,
        futsalGoalPostSize,
        futsalLineMarkings: futsalLineMarkings || undefined,
        cricketFormat: cricketFormat || undefined,
        cricketStumps,
        cricketBowlingMachine,
        cricketPracticeMode: cricketPracticeMode || undefined,
        futsalPricePerSlot,
        cricketPricePerSlot,
        peakWeekdayEvening,
        peakWeekend,
        discountLabel,
        discountAmount,
        discountPercent,
        slotDuration,
        bufferMinutes,
        allowParallel,
        amenChanging,
        amenWashroom,
        amenParking,
        amenWater,
        amenSeating,
        maxPlayers,
        safetyInstructions,
        cancellationPolicy,
      });
      if (existingCourtId) {
        const { businessLocationId: _loc, ...patch } = payload;
        await updateTurfCourt(existingCourtId, patch);
      } else {
        await createTurfCourt(payload);
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
      <form
        className="form-grid turf-setup-form"
        onSubmit={(e) => void onSubmit(e)}
      >
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
              placeholder="e.g. Pitch A"
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
            <label>Image URLs (one per line)</label>
            <textarea
              rows={3}
              value={imageLines}
              onChange={(e) => setImageLines(e.target.value)}
              placeholder="https://…"
            />
          </div>
        </div>
        </div>

        <div className="turf-setup-card">
        <h4>2. Structure details</h4>
        <div className="form-grid">
          <div className="form-row-2">
            <div>
              <label>Ceiling height</label>
              <input
                type="text"
                inputMode="decimal"
                value={ceilingHeightValue}
                onChange={(e) => setCeilingHeightValue(e.target.value)}
                placeholder="e.g. 18"
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
                <option value="ft">ft</option>
                <option value="m">m</option>
              </select>
            </div>
          </div>
          <div>
            <label>Covered type</label>
            <select
              value={coveredType}
              onChange={(e) =>
                setCoveredType(
                  e.target.value as
                    | ''
                    | 'open'
                    | 'semi_covered'
                    | 'fully_indoor',
                )
              }
            >
              <option value="">—</option>
              <option value="open">Open</option>
              <option value="semi_covered">Semi-covered</option>
              <option value="fully_indoor">Fully indoor</option>
            </select>
          </div>
          <div>
            <label>Side netting</label>
            <select
              value={sideNetting}
              onChange={(e) =>
                setSideNetting(e.target.value as '' | 'yes' | 'no')
              }
            >
              <option value="">—</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div>
            <label>Net height</label>
            <input
              value={netHeight}
              onChange={(e) => setNetHeight(e.target.value)}
              maxLength={50}
              placeholder="e.g. 2m"
            />
          </div>
          <div>
            <label>Boundary type</label>
            <select
              value={boundaryType}
              onChange={(e) =>
                setBoundaryType(e.target.value as '' | 'net' | 'wall')
              }
            >
              <option value="">—</option>
              <option value="net">Net</option>
              <option value="wall">Wall</option>
            </select>
          </div>
          <div>
            <label>Ventilation (multi-select)</label>
            <div className="turf-setup-checkrow">
              <label className="turf-setup-inline">
                <input
                  type="checkbox"
                  checked={ventilation.includes('natural')}
                  onChange={() => toggleVent('natural')}
                />
                Natural
              </label>
              <label className="turf-setup-inline">
                <input
                  type="checkbox"
                  checked={ventilation.includes('fans')}
                  onChange={() => toggleVent('fans')}
                />
                Fans
              </label>
              <label className="turf-setup-inline">
                <input
                  type="checkbox"
                  checked={ventilation.includes('ac')}
                  onChange={() => toggleVent('ac')}
                />
                AC
              </label>
            </div>
          </div>
          <div>
            <label>Lighting</label>
            <select
              value={lighting}
              onChange={(e) =>
                setLighting(
                  e.target.value as
                    | ''
                    | 'led_floodlights'
                    | 'mixed'
                    | 'daylight',
                )
              }
            >
              <option value="">—</option>
              <option value="led_floodlights">LED floodlights</option>
              <option value="mixed">Mixed</option>
              <option value="daylight">Daylight</option>
            </select>
          </div>
        </div>
        </div>

        <div className="turf-setup-card">
        <h4>3. Dimensions (common — meters)</h4>
        <div className="form-row-2">
          <div>
            <label>Length (m)</label>
            <input
              type="text"
              inputMode="decimal"
              value={lengthM}
              onChange={(e) => setLengthM(e.target.value)}
              placeholder="e.g. 40"
            />
          </div>
          <div>
            <label>Width (m)</label>
            <input
              type="text"
              inputMode="decimal"
              value={widthM}
              onChange={(e) => setWidthM(e.target.value)}
              placeholder="e.g. 20"
            />
          </div>
        </div>
        </div>

        <div className="turf-setup-card">
        <h4>4. Surface details</h4>
        <div className="form-grid">
          <div>
            <label>Surface type</label>
            <select
              value={surfaceType}
              onChange={(e) =>
                setSurfaceType(
                  e.target.value as '' | 'artificial_turf' | 'hard_surface',
                )
              }
            >
              <option value="">—</option>
              <option value="artificial_turf">Artificial turf</option>
              <option value="hard_surface">Hard surface</option>
            </select>
          </div>
          <div>
            <label>Turf quality (optional)</label>
            <input
              value={turfQuality}
              onChange={(e) => setTurfQuality(e.target.value)}
              maxLength={120}
            />
          </div>
          <div>
            <label>Shock absorption layer</label>
            <select
              value={shockAbsorption}
              onChange={(e) =>
                setShockAbsorption(e.target.value as '' | 'yes' | 'no')
              }
            >
              <option value="">—</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>
        </div>

        <div className="turf-setup-card">
        <h4>5. Supported sports</h4>
        <div className="turf-sport-switches">
          <label className="ui-switch">
            <input
              type="checkbox"
              checked={supportFutsal}
              onChange={(e) => setSupportFutsal(e.target.checked)}
            />
            <span className="ui-switch-track" aria-hidden />
            <span className="ui-switch-text">Futsal</span>
          </label>
          <label className="ui-switch">
            <input
              type="checkbox"
              checked={supportCricket}
              onChange={(e) => setSupportCricket(e.target.checked)}
            />
            <span className="ui-switch-track" aria-hidden />
            <span className="ui-switch-text">Cricket</span>
          </label>
        </div>
        </div>

      {showFutsal && (
        <div className="turf-setup-card">
          <h4>6A. Futsal settings</h4>
          <div className="form-grid">
            <div>
              <label>Format</label>
              <select
                value={futsalFormat}
                onChange={(e) =>
                  setFutsalFormat(e.target.value as '' | '5v5' | '6v6' | '7v7')
                }
              >
                <option value="">—</option>
                <option value="5v5">5v5</option>
                <option value="6v6">6v6</option>
                <option value="7v7">7v7</option>
              </select>
            </div>
            <div>
              <label>Goal posts available</label>
              <select
                value={futsalGoalPosts}
                onChange={(e) =>
                  setFutsalGoalPosts(e.target.value as '' | 'yes' | 'no')
                }
              >
                <option value="">—</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
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
                  setFutsalLineMarkings(
                    e.target.value as '' | 'permanent' | 'temporary',
                  )
                }
              >
                <option value="">—</option>
                <option value="permanent">Permanent</option>
                <option value="temporary">Temporary</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {showCricket && (
        <div className="turf-setup-card">
          <h4>6B. Cricket settings</h4>
          <div className="form-grid">
            <div>
              <label>Format</label>
              <select
                value={cricketFormat}
                onChange={(e) =>
                  setCricketFormat(
                    e.target.value as
                      | ''
                      | 'tape_ball'
                      | 'tennis_ball'
                      | 'hard_ball',
                  )
                }
              >
                <option value="">—</option>
                <option value="tape_ball">Tape ball</option>
                <option value="tennis_ball">Tennis ball</option>
                <option value="hard_ball">Hard ball</option>
              </select>
            </div>
            <div>
              <label>Stumps available</label>
              <select
                value={cricketStumps}
                onChange={(e) =>
                  setCricketStumps(e.target.value as '' | 'yes' | 'no')
                }
              >
                <option value="">—</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <label>Bowling machine</label>
              <select
                value={cricketBowlingMachine}
                onChange={(e) =>
                  setCricketBowlingMachine(e.target.value as '' | 'yes' | 'no')
                }
              >
                <option value="">—</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </div>
            <div>
              <label>Practice mode</label>
              <select
                value={cricketPracticeMode}
                onChange={(e) =>
                  setCricketPracticeMode(
                    e.target.value as '' | 'full_ground' | 'nets_mode',
                  )
                }
              >
                <option value="">—</option>
                <option value="full_ground">Full ground</option>
                <option value="nets_mode">Nets mode</option>
              </select>
            </div>
          </div>
        </div>
      )}

        <div className="turf-setup-card">
        <h4>7. Pricing (per sport)</h4>
        <div className="form-grid">
          {showFutsal && (
            <div>
              <label>Futsal price per slot</label>
              <input
                type="text"
                inputMode="decimal"
                value={futsalPricePerSlot}
                onChange={(e) => setFutsalPricePerSlot(e.target.value)}
              />
            </div>
          )}
          {showCricket && (
            <div>
              <label>Cricket price per slot</label>
              <input
                type="text"
                inputMode="decimal"
                value={cricketPricePerSlot}
                onChange={(e) => setCricketPricePerSlot(e.target.value)}
              />
            </div>
          )}
          <div className="form-row-2">
            <div>
              <label>Peak: weekday evening</label>
              <input
                type="text"
                inputMode="decimal"
                value={peakWeekdayEvening}
                onChange={(e) => setPeakWeekdayEvening(e.target.value)}
              />
            </div>
            <div>
              <label>Peak: weekend</label>
              <input
                type="text"
                inputMode="decimal"
                value={peakWeekend}
                onChange={(e) => setPeakWeekend(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label>Discount / membership — label</label>
            <input
              value={discountLabel}
              onChange={(e) => setDiscountLabel(e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="form-row-2">
            <div>
              <label>Discount amount</label>
              <input
                type="text"
                inputMode="decimal"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(e.target.value)}
              />
            </div>
            <div>
              <label>Percent off</label>
              <input
                type="text"
                inputMode="decimal"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(e.target.value)}
              />
            </div>
          </div>
        </div>
        </div>

        <div className="turf-setup-card">
        <h4>8. Slot settings</h4>
        <div className="form-grid">
          <div>
            <label>Slot duration (minutes)</label>
            <input
              type="text"
              inputMode="numeric"
              value={slotDuration}
              onChange={(e) => setSlotDuration(e.target.value)}
              placeholder="e.g. 60, 90, 120"
            />
          </div>
          <div>
            <label>Buffer time between slots (minutes)</label>
            <input
              type="text"
              inputMode="numeric"
              value={bufferMinutes}
              onChange={(e) => setBufferMinutes(e.target.value)}
            />
          </div>
          <div>
            <label>Allow parallel booking</label>
            <select
              value={allowParallel}
              onChange={(e) =>
                setAllowParallel(e.target.value as '' | 'yes' | 'no')
              }
            >
              <option value="">—</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>
        </div>

        <div className="turf-setup-card">
        <h4>9. Amenities</h4>
        <div className="turf-setup-checkrow turf-setup-checkrow--wrap">
          <label className="turf-setup-inline">
            <input
              type="checkbox"
              checked={amenChanging}
              onChange={(e) => setAmenChanging(e.target.checked)}
            />
            Changing room
          </label>
          <label className="turf-setup-inline">
            <input
              type="checkbox"
              checked={amenWashroom}
              onChange={(e) => setAmenWashroom(e.target.checked)}
            />
            Washroom
          </label>
          <label className="turf-setup-inline">
            <input
              type="checkbox"
              checked={amenParking}
              onChange={(e) => setAmenParking(e.target.checked)}
            />
            Parking
          </label>
          <label className="turf-setup-inline">
            <input
              type="checkbox"
              checked={amenWater}
              onChange={(e) => setAmenWater(e.target.checked)}
            />
            Drinking water
          </label>
          <label className="turf-setup-inline">
            <input
              type="checkbox"
              checked={amenSeating}
              onChange={(e) => setAmenSeating(e.target.checked)}
            />
            Seating area
          </label>
        </div>
        </div>

        <div className="turf-setup-card">
        <h4>10. Rules &amp; restrictions</h4>
        <div className="form-grid">
          <div>
            <label>Max players allowed</label>
            <input
              type="text"
              inputMode="numeric"
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(e.target.value)}
            />
          </div>
          <div>
            <label>Safety instructions</label>
            <textarea
              rows={3}
              value={safetyInstructions}
              onChange={(e) => setSafetyInstructions(e.target.value)}
            />
          </div>
          <div>
            <label>Cancellation policy</label>
            <textarea
              rows={3}
              value={cancellationPolicy}
              onChange={(e) => setCancellationPolicy(e.target.value)}
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
                : 'Create turf court'}
          </button>
        </div>
      </form>
    </div>
  );
}
