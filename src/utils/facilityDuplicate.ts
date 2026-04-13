import type {
  CreateCricketCourtBody,
  CreateFutsalCourtBody,
  CreatePadelCourtBody,
  CricketCourtDetail,
  FutsalCourtDetail,
  PadelCourtDetail,
} from '../api/saasClient';
import {
  emptySharedArenaTurfState,
  sharedDetailToFormState,
  sharedTurfFormStateToCricketPayload,
  sharedTurfFormStateToPayload,
} from '../components/facilities/arena/sharedArenaTurfFormState';

function num(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Full copy of a futsal pitch for re-create; always starts as draft (not bookable until activated). */
export function futsalDetailToCreateBody(
  d: FutsalCourtDetail,
  businessLocationId: string,
): CreateFutsalCourtBody {
  return {
    businessLocationId,
    name: d.name,
    arenaLabel: d.arenaLabel,
    courtStatus: 'draft',
    imageUrls: d.imageUrls,
    ceilingHeightValue: num(d.ceilingHeightValue),
    ceilingHeightUnit: d.ceilingHeightUnit,
    coveredType: d.coveredType,
    sideNetting: d.sideNetting,
    netHeight: d.netHeight,
    boundaryType: d.boundaryType,
    ventilation: d.ventilation,
    lighting: d.lighting,
    lengthM: num(d.lengthM),
    widthM: num(d.widthM),
    surfaceType: d.surfaceType,
    turfQuality: d.turfQuality,
    shockAbsorptionLayer: d.shockAbsorptionLayer,
    futsalFormat: d.futsalFormat,
    futsalGoalPostsAvailable: d.futsalGoalPostsAvailable,
    futsalGoalPostSize: d.futsalGoalPostSize,
    futsalLineMarkings: d.futsalLineMarkings,
    pricePerSlot: num(d.pricePerSlot),
    peakPricing: d.peakPricing,
    discountMembership: d.discountMembership,
    slotDurationMinutes: d.slotDurationMinutes,
    bufferBetweenSlotsMinutes: d.bufferBetweenSlotsMinutes,
    allowParallelBooking: d.allowParallelBooking,
    amenities: d.amenities,
    rules: d.rules,
  };
}

/** Full copy of a cricket pitch for re-create; always starts as draft. */
export function cricketDetailToCreateBody(
  d: CricketCourtDetail,
  businessLocationId: string,
): CreateCricketCourtBody {
  return {
    businessLocationId,
    name: d.name,
    arenaLabel: d.arenaLabel,
    courtStatus: 'draft',
    imageUrls: d.imageUrls,
    ceilingHeightValue: num(d.ceilingHeightValue),
    ceilingHeightUnit: d.ceilingHeightUnit,
    coveredType: d.coveredType,
    sideNetting: d.sideNetting,
    netHeight: d.netHeight,
    boundaryType: d.boundaryType,
    ventilation: d.ventilation,
    lighting: d.lighting,
    lengthM: num(d.lengthM),
    widthM: num(d.widthM),
    surfaceType: d.surfaceType,
    turfQuality: d.turfQuality,
    shockAbsorptionLayer: d.shockAbsorptionLayer,
    cricketFormat: d.cricketFormat,
    cricketStumpsAvailable: d.cricketStumpsAvailable,
    cricketBowlingMachine: d.cricketBowlingMachine,
    cricketPracticeMode: d.cricketPracticeMode,
    pricePerSlot: num(d.pricePerSlot),
    peakPricing: d.peakPricing,
    discountMembership: d.discountMembership,
    slotDurationMinutes: d.slotDurationMinutes,
    bufferBetweenSlotsMinutes: d.bufferBetweenSlotsMinutes,
    allowParallelBooking: d.allowParallelBooking,
    amenities: d.amenities,
    rules: d.rules,
  };
}

/** Shared turf + pricing fields from a cricket pitch onto a new futsal row (sport-specific fields left unset). */
export function futsalSharedBodyFromCricketDetail(
  d: CricketCourtDetail,
  businessLocationId: string,
): CreateFutsalCourtBody {
  const shared = sharedDetailToFormState(d, emptySharedArenaTurfState());
  shared.name = d.name;
  const turf = sharedTurfFormStateToPayload(shared);
  return {
    businessLocationId,
    name: d.name,
    arenaLabel: d.arenaLabel,
    courtStatus: 'draft',
    ...turf,
  };
}

/** Shared turf + pricing fields from a futsal pitch onto a new cricket row. */
export function cricketSharedBodyFromFutsalDetail(
  d: FutsalCourtDetail,
  businessLocationId: string,
): CreateCricketCourtBody {
  const shared = sharedDetailToFormState(d, emptySharedArenaTurfState());
  shared.name = d.name;
  const turf = sharedTurfFormStateToCricketPayload(shared);
  return {
    businessLocationId,
    name: d.name,
    arenaLabel: d.arenaLabel,
    courtStatus: 'draft',
    ...turf,
  };
}

export function padelDetailToCreateBody(
  d: PadelCourtDetail,
  businessLocationId: string,
): CreatePadelCourtBody {
  return {
    businessLocationId,
    name: d.name,
    arenaLabel: d.arenaLabel,
    courtStatus: 'draft',
    isActive: false,
    description: d.description,
    imageUrls: d.imageUrls,
    ceilingHeightValue: num(d.ceilingHeightValue),
    ceilingHeightUnit: d.ceilingHeightUnit,
    coveredType: d.coveredType,
    glassWalls: d.glassWalls,
    wallType: d.wallType,
    lighting: d.lighting,
    ventilation: d.ventilation,
    lengthM: num(d.lengthM),
    widthM: num(d.widthM),
    surfaceType: d.surfaceType,
    matchType: d.matchType,
    maxPlayers: d.maxPlayers,
    pricePerSlot: num(d.pricePerSlot),
    peakPricing: d.peakPricing,
    membershipPrice: num(d.membershipPrice),
    slotDurationMinutes: d.slotDurationMinutes,
    bufferBetweenSlotsMinutes: d.bufferBetweenSlotsMinutes,
    extras: d.extras,
    amenities: d.amenities,
    rules: d.rules,
  };
}

