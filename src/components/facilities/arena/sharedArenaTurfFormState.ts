import type { CreateCricketCourtBody, CreateFutsalCourtBody } from '../../../api/saasClient';

/** Local state for sections shared by futsal / cricket turf-style setup (matches API DTOs). */
export type SharedArenaTurfFormState = {
  name: string;
  imageLines: string;
  ceilingHeightValue: string;
  ceilingHeightUnit: 'ft' | 'm';
  coveredType: '' | 'open' | 'semi_covered' | 'fully_indoor';
  sideNetting: boolean;
  netHeight: string;
  boundaryType: '' | 'net' | 'wall';
  ventNatural: boolean;
  ventFans: boolean;
  ventAc: boolean;
  lighting: '' | 'led_floodlights' | 'mixed' | 'daylight';
  lengthM: string;
  widthM: string;
  surfaceType: '' | 'artificial_turf' | 'hard_surface';
  turfQuality: string;
  shockAbsorptionLayer: boolean;
  pricePerSlot: string;
  peakWeekdayEvening: string;
  peakWeekend: string;
  discountLabel: string;
  discountAmount: string;
  discountPercentOff: string;
  amenChanging: boolean;
  amenWashroom: boolean;
  amenParking: boolean;
  amenWater: boolean;
  amenSeating: boolean;
  maxPlayers: string;
  safetyInstructions: string;
  cancellationPolicy: string;
  /** Booking slot length sent with the facility (API: min 60, step 30). */
  slotDuration: '' | '60' | '90' | '120';
  bufferMinutes: string;
  allowParallelBooking: boolean;
};

export function emptySharedArenaTurfState(): SharedArenaTurfFormState {
  return {
    name: '',
    imageLines: '',
    ceilingHeightValue: '',
    ceilingHeightUnit: 'm',
    coveredType: '',
    sideNetting: false,
    netHeight: '',
    boundaryType: '',
    ventNatural: false,
    ventFans: false,
    ventAc: false,
    lighting: '',
    lengthM: '',
    widthM: '',
    surfaceType: '',
    turfQuality: '',
    shockAbsorptionLayer: false,
    pricePerSlot: '',
    peakWeekdayEvening: '',
    peakWeekend: '',
    discountLabel: '',
    discountAmount: '',
    discountPercentOff: '',
    amenChanging: false,
    amenWashroom: false,
    amenParking: false,
    amenWater: false,
    amenSeating: false,
    maxPlayers: '',
    safetyInstructions: '',
    cancellationPolicy: '',
    slotDuration: '',
    bufferMinutes: '',
    allowParallelBooking: false,
  };
}

function strFromApi(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v);
}

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

type SharedDetail = Partial<
  Pick<
    CreateFutsalCourtBody,
    | 'imageUrls'
    | 'ceilingHeightValue'
    | 'ceilingHeightUnit'
    | 'coveredType'
    | 'sideNetting'
    | 'netHeight'
    | 'boundaryType'
    | 'ventilation'
    | 'lighting'
    | 'lengthM'
    | 'widthM'
    | 'surfaceType'
    | 'turfQuality'
    | 'shockAbsorptionLayer'
    | 'pricePerSlot'
    | 'peakPricing'
    | 'discountMembership'
    | 'amenities'
    | 'rules'
    | 'slotDurationMinutes'
    | 'bufferBetweenSlotsMinutes'
    | 'allowParallelBooking'
  >
>;

export function sharedDetailToFormState(
  d: SharedDetail,
  base: SharedArenaTurfFormState,
): SharedArenaTurfFormState {
  const vent = d.ventilation;
  const arr = Array.isArray(vent) ? vent : [];
  return {
    ...base,
    imageLines: Array.isArray(d.imageUrls) ? d.imageUrls.join('\n') : base.imageLines,
    ceilingHeightValue: strFromApi(d.ceilingHeightValue),
    ceilingHeightUnit:
      d.ceilingHeightUnit === 'ft' || d.ceilingHeightUnit === 'm'
        ? d.ceilingHeightUnit
        : base.ceilingHeightUnit,
    coveredType:
      d.coveredType === 'open' ||
      d.coveredType === 'semi_covered' ||
      d.coveredType === 'fully_indoor'
        ? d.coveredType
        : '',
    sideNetting: d.sideNetting === true,
    netHeight: d.netHeight ?? '',
    boundaryType:
      d.boundaryType === 'net' || d.boundaryType === 'wall' ? d.boundaryType : '',
    ventNatural: arr.includes('natural'),
    ventFans: arr.includes('fans'),
    ventAc: arr.includes('ac'),
    lighting:
      d.lighting === 'led_floodlights' ||
      d.lighting === 'mixed' ||
      d.lighting === 'daylight'
        ? d.lighting
        : '',
    lengthM: strFromApi(d.lengthM),
    widthM: strFromApi(d.widthM),
    surfaceType:
      d.surfaceType === 'artificial_turf' || d.surfaceType === 'hard_surface'
        ? d.surfaceType
        : '',
    turfQuality: d.turfQuality ?? '',
    shockAbsorptionLayer: d.shockAbsorptionLayer === true,
    pricePerSlot: strFromApi(d.pricePerSlot),
    peakWeekdayEvening: strFromApi(d.peakPricing?.weekdayEvening),
    peakWeekend: strFromApi(d.peakPricing?.weekend),
    discountLabel: d.discountMembership?.label ?? '',
    discountAmount: strFromApi(d.discountMembership?.amount),
    discountPercentOff: strFromApi(d.discountMembership?.percentOff),
    amenChanging: d.amenities?.changingRoom === true,
    amenWashroom: d.amenities?.washroom === true,
    amenParking: d.amenities?.parking === true,
    amenWater: d.amenities?.drinkingWater === true,
    amenSeating: d.amenities?.seatingArea === true,
    maxPlayers:
      d.rules?.maxPlayers != null && Number.isFinite(d.rules.maxPlayers)
        ? String(d.rules.maxPlayers)
        : '',
    safetyInstructions: d.rules?.safetyInstructions ?? '',
    cancellationPolicy: d.rules?.cancellationPolicy ?? '',
    slotDuration:
      d.slotDurationMinutes === 60
        ? '60'
        : d.slotDurationMinutes === 90
          ? '90'
          : d.slotDurationMinutes === 120
            ? '120'
            : '',
    bufferMinutes: strFromApi(d.bufferBetweenSlotsMinutes),
    allowParallelBooking: d.allowParallelBooking === true,
  };
}

type SharedPayload = Pick<
  CreateFutsalCourtBody,
  | 'imageUrls'
  | 'ceilingHeightValue'
  | 'ceilingHeightUnit'
  | 'coveredType'
  | 'sideNetting'
  | 'netHeight'
  | 'boundaryType'
  | 'ventilation'
  | 'lighting'
  | 'lengthM'
  | 'widthM'
  | 'surfaceType'
  | 'turfQuality'
  | 'shockAbsorptionLayer'
  | 'pricePerSlot'
  | 'peakPricing'
  | 'discountMembership'
  | 'amenities'
  | 'rules'
  | 'slotDurationMinutes'
  | 'bufferBetweenSlotsMinutes'
  | 'allowParallelBooking'
>;

export function sharedTurfFormStateToPayload(
  s: SharedArenaTurfFormState,
): SharedPayload {
  const imageUrls = s.imageLines
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
  const ventilation: ('natural' | 'fans' | 'ac')[] = [];
  if (s.ventNatural) ventilation.push('natural');
  if (s.ventFans) ventilation.push('fans');
  if (s.ventAc) ventilation.push('ac');

  const ceilingHeightValue = parseNum(s.ceilingHeightValue);
  const peakWd = parseNum(s.peakWeekdayEvening);
  const peakWe = parseNum(s.peakWeekend);
  const peakPricing =
    peakWd !== undefined || peakWe !== undefined
      ? {
          ...(peakWd !== undefined ? { weekdayEvening: peakWd } : {}),
          ...(peakWe !== undefined ? { weekend: peakWe } : {}),
        }
      : undefined;

  const dAmt = parseNum(s.discountAmount);
  const dPct = parseNum(s.discountPercentOff);
  const discountMembership =
    s.discountLabel.trim() || dAmt !== undefined || dPct !== undefined
      ? {
          ...(s.discountLabel.trim()
            ? { label: s.discountLabel.trim() }
            : {}),
          ...(dAmt !== undefined ? { amount: dAmt } : {}),
          ...(dPct !== undefined ? { percentOff: dPct } : {}),
        }
      : undefined;

  const amenities: NonNullable<CreateFutsalCourtBody['amenities']> = {};
  if (s.amenChanging) amenities.changingRoom = true;
  if (s.amenWashroom) amenities.washroom = true;
  if (s.amenParking) amenities.parking = true;
  if (s.amenWater) amenities.drinkingWater = true;
  if (s.amenSeating) amenities.seatingArea = true;

  const maxP = parseIntOpt(s.maxPlayers);
  const rules: NonNullable<CreateFutsalCourtBody['rules']> = {};
  if (maxP !== undefined) rules.maxPlayers = maxP;
  if (s.safetyInstructions.trim())
    rules.safetyInstructions = s.safetyInstructions.trim();
  if (s.cancellationPolicy.trim())
    rules.cancellationPolicy = s.cancellationPolicy.trim();

  const slotDurationMinutes =
    s.slotDuration === '60'
      ? 60
      : s.slotDuration === '90'
        ? 90
        : s.slotDuration === '120'
          ? 120
          : undefined;
  const bufferBetweenSlotsMinutes = parseIntOpt(s.bufferMinutes);

  return {
    imageUrls: imageUrls.length ? imageUrls : undefined,
    ceilingHeightValue:
      ceilingHeightValue !== undefined ? ceilingHeightValue : undefined,
    ceilingHeightUnit: s.ceilingHeightUnit,
    coveredType: s.coveredType || undefined,
    sideNetting: s.sideNetting || undefined,
    netHeight: s.netHeight.trim() || undefined,
    boundaryType: s.boundaryType || undefined,
    ventilation: ventilation.length ? ventilation : undefined,
    lighting: s.lighting || undefined,
    lengthM: parseNum(s.lengthM),
    widthM: parseNum(s.widthM),
    surfaceType: s.surfaceType || undefined,
    turfQuality: s.turfQuality.trim() || undefined,
    shockAbsorptionLayer: s.shockAbsorptionLayer || undefined,
    pricePerSlot: parseNum(s.pricePerSlot),
    peakPricing,
    discountMembership,
    amenities: Object.keys(amenities).length ? amenities : undefined,
    rules: Object.keys(rules).length ? rules : undefined,
    slotDurationMinutes,
    bufferBetweenSlotsMinutes,
    allowParallelBooking: s.allowParallelBooking ? true : undefined,
  };
}

/** Same shared keys on cricket body â€” payload shape is identical. */
export function sharedTurfFormStateToCricketPayload(
  s: SharedArenaTurfFormState,
): Pick<CreateCricketCourtBody, keyof SharedPayload> {
  return sharedTurfFormStateToPayload(s) as Pick<
    CreateCricketCourtBody,
    keyof SharedPayload
  >;
}

