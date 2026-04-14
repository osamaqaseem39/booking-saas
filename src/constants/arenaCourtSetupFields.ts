/**
 * Field inventory for “full turf-style” facility setup vs split futsal / cricket courts.
 *
 * - **Reference UI**: `PadelCourtSetupForm.tsx` (sections 1–10) is the rich wizard the
 *   dashboard uses today; futsal/cricket forms should mirror the same *structure* where
 *   the API supports it, and use sport-specific blocks instead of padel-only controls.
 * - **API source of truth**: `CreateFutsalCourtDto` / `CreateCricketCourtDto` (backend).
 */

/** One logical form control / API field. */
export type ArenaCourtFieldDef = {
  /** DTO / entity property name */
  apiKey: string;
  /** Human label for forms */
  label: string;
  /** Optional nested keys for JSON columns */
  nested?: string;
  notes?: string;
};

/* -------------------------------------------------------------------------- */
/* Shared sections (both futsal_courts and cricket_courts)                    */
/* -------------------------------------------------------------------------- */

/** §1 Basic — matches padel “Basic information” where API allows */
export const ARENA_BASIC_FIELDS: ArenaCourtFieldDef[] = [
  { apiKey: 'name', label: 'Court / pitch name' },
  { apiKey: 'businessLocationId', label: 'Arena (location)' },
  { apiKey: 'courtStatus', label: 'Court status', notes: 'active | maintenance' },
  {
    apiKey: 'arenaLabel',
    label: 'Arena label',
    notes: 'Often mirrored from location name in the client',
  },
  {
    apiKey: 'imageUrls',
    label: 'Image URLs',
    notes: 'Padel: one per line textarea → string[]',
  },
];

/**
 * Padel-only in current UI; not on futsal/cricket entities.
 * For parity later: optional description could map to rules.safetyInstructions or a new column.
 */
export const PADEL_BASIC_ONLY_FIELDS: ArenaCourtFieldDef[] = [
  { apiKey: 'description', label: 'Description (optional)' },
  {
    apiKey: 'isActive',
    label: 'Accepting bookings (active listing)',
    notes: 'Padel entity only; futsal/cricket use courtStatus',
  },
];

/** §2 Structure — padel uses glass/walls; futsal/cricket use netting / boundary enums */
export const ARENA_STRUCTURE_FIELDS: ArenaCourtFieldDef[] = [
  { apiKey: 'ceilingHeightValue', label: 'Ceiling height (value)' },
  {
    apiKey: 'ceilingHeightUnit',
    label: 'Ceiling height unit',
    notes: 'ft | m',
  },
  {
    apiKey: 'coveredType',
    label: 'Covered type',
    notes: 'open | semi_covered | fully_indoor (map padel “indoor” → fully_indoor)',
  },
  {
    apiKey: 'sideNetting',
    label: 'Side netting',
    notes: 'boolean — padel “glass walls” has no direct column',
  },
  { apiKey: 'netHeight', label: 'Net height', notes: 'string' },
  {
    apiKey: 'boundaryType',
    label: 'Boundary type',
    notes: 'net | wall',
  },
  {
    apiKey: 'ventilation',
    label: 'Ventilation',
    notes: 'string[] enum: natural | fans | ac (padel UI is free text today)',
  },
  {
    apiKey: 'lighting',
    label: 'Lighting',
    notes: 'led_floodlights | mixed | daylight (padel UI is free text today)',
  },
];

/** §3 Dimensions */
export const ARENA_DIMENSION_FIELDS: ArenaCourtFieldDef[] = [
  { apiKey: 'lengthM', label: 'Length (m)' },
  { apiKey: 'widthM', label: 'Width (m)' },
];

/** §4 Surface */
export const ARENA_SURFACE_FIELDS: ArenaCourtFieldDef[] = [
  {
    apiKey: 'surfaceType',
    label: 'Surface type',
    notes: 'artificial_turf | hard_surface (padel uses synthetic_turf | acrylic)',
  },
  { apiKey: 'turfQuality', label: 'Turf / surface quality' },
  { apiKey: 'shockAbsorptionLayer', label: 'Shock absorption layer' },
];

/** §5 Game — padel: matchType + maxPlayers; arena API uses sport keys + rules.maxPlayers */
export const FUTSAL_GAME_FIELDS: ArenaCourtFieldDef[] = [
  {
    apiKey: 'futsalFormat',
    label: 'Format',
    notes: '5v5 | 6v6 | 7v7',
  },
  { apiKey: 'futsalGoalPostsAvailable', label: 'Goal posts available' },
  { apiKey: 'futsalGoalPostSize', label: 'Goal post size' },
  {
    apiKey: 'futsalLineMarkings',
    label: 'Line markings',
    notes: 'permanent | temporary',
  },
];

export const CRICKET_GAME_FIELDS: ArenaCourtFieldDef[] = [
  {
    apiKey: 'cricketFormat',
    label: 'Ball format',
    notes: 'tape_ball | tennis_ball | hard_ball',
  },
  { apiKey: 'cricketStumpsAvailable', label: 'Stumps available' },
  { apiKey: 'cricketBowlingMachine', label: 'Bowling machine' },
  {
    apiKey: 'cricketPracticeMode',
    label: 'Practice mode',
    notes: 'full_ground | nets_mode',
  },
];

/** Use `rules.maxPlayers` for a single max-players cap (ArenaRulesDto). */
export const ARENA_RULES_MAX_PLAYERS: ArenaCourtFieldDef = {
  apiKey: 'rules',
  nested: 'maxPlayers',
  label: 'Max players',
  notes: 'Stored under rules.maxPlayers',
};

export const PADEL_GAME_ONLY_FIELDS: ArenaCourtFieldDef[] = [
  { apiKey: 'matchType', label: 'Match type', notes: 'singles | doubles — padel only' },
];

/** §6 Pricing */
export const ARENA_PRICING_FIELDS: ArenaCourtFieldDef[] = [
  { apiKey: 'pricePerSlot', label: 'Price per slot' },
  {
    apiKey: 'peakPricing',
    nested: 'weekdayEvening',
    label: 'Peak — weekday evening',
  },
  {
    apiKey: 'peakPricing',
    nested: 'weekend',
    label: 'Peak — weekend',
  },
  {
    apiKey: 'discountMembership',
    label: 'Membership / discount',
    notes: 'label, amount, percentOff — padel “membership price” is a single number in UI',
  },
];

/** §7 Slot settings */
export const ARENA_SLOT_FIELDS: ArenaCourtFieldDef[] = [
  {
    apiKey: 'slotDurationMinutes',
    label: 'Slot duration (minutes)',
    notes: '60 only (hourly slots)',
  },
  {
    apiKey: 'bufferBetweenSlotsMinutes',
    label: 'Buffer between slots (minutes)',
  },
  { apiKey: 'allowParallelBooking', label: 'Allow parallel booking' },
];

/**
 * §8 Extras — padel-only in UI (racket / ball / coaching).
 * Not on CreateFutsalCourtDto / CreateCricketCourtDto; omit or extend API later.
 */
export const PADEL_EXTRAS_FIELDS: ArenaCourtFieldDef[] = [
  { apiKey: 'extras', nested: 'racketRental', label: 'Racket rental' },
  { apiKey: 'extras', nested: 'ballRental', label: 'Ball rental' },
  { apiKey: 'extras', nested: 'coachingAvailable', label: 'Coaching available' },
];

/** §9 Amenities — ArenaAmenitiesDto */
export const ARENA_AMENITY_FIELDS: ArenaCourtFieldDef[] = [
  { apiKey: 'amenities', nested: 'changingRoom', label: 'Changing room' },
  { apiKey: 'amenities', nested: 'washroom', label: 'Washroom' },
  { apiKey: 'amenities', nested: 'parking', label: 'Parking' },
  { apiKey: 'amenities', nested: 'drinkingWater', label: 'Drinking water' },
  { apiKey: 'amenities', nested: 'seatingArea', label: 'Seating area' },
];

/** §10 Rules — ArenaRulesDto */
export const ARENA_RULES_TEXT_FIELDS: ArenaCourtFieldDef[] = [
  { apiKey: 'rules', nested: 'safetyInstructions', label: 'Safety / game rules' },
  {
    apiKey: 'rules',
    nested: 'cancellationPolicy',
    label: 'Cancellation policy',
  },
];

/** Padel form maps “game rules” textarea → often stored with rules; align naming when porting. */
export const PADEL_RULES_UI_ALIAS: Record<string, string> = {
  gameRules: 'rules.safetyInstructions',
};

/* -------------------------------------------------------------------------- */
/* Padel structure controls with no futsal/cricket column                     */
/* -------------------------------------------------------------------------- */

export const PADEL_STRUCTURE_ONLY_FIELDS: ArenaCourtFieldDef[] = [
  { apiKey: 'glassWalls', label: 'Glass walls' },
  { apiKey: 'wallType', label: 'Wall type', notes: 'full_glass | glass_mesh' },
];

/* -------------------------------------------------------------------------- */
/* Grouped view for docs / code generation                                    */
/* -------------------------------------------------------------------------- */

export const ARENA_COURT_SHARED_FIELD_GROUPS = {
  basic: ARENA_BASIC_FIELDS,
  structure: ARENA_STRUCTURE_FIELDS,
  dimensions: ARENA_DIMENSION_FIELDS,
  surface: ARENA_SURFACE_FIELDS,
  pricing: ARENA_PRICING_FIELDS,
  slots: ARENA_SLOT_FIELDS,
  amenities: ARENA_AMENITY_FIELDS,
  rules: [ARENA_RULES_MAX_PLAYERS, ...ARENA_RULES_TEXT_FIELDS],
} as const;

export const FUTSAL_COURT_FIELD_GROUPS = {
  ...ARENA_COURT_SHARED_FIELD_GROUPS,
  game: FUTSAL_GAME_FIELDS,
} as const;

export const CRICKET_COURT_FIELD_GROUPS = {
  ...ARENA_COURT_SHARED_FIELD_GROUPS,
  game: CRICKET_GAME_FIELDS,
} as const;

/**
 * Section titles aligned with `PadelCourtSetupForm` cards (for matching layout).
 */
export const TURF_STYLE_SECTION_TITLES = [
  '1. Basic information',
  '2. Structure details',
  '3. Dimensions (meters)',
  '4. Surface',
  '5. Game settings',
  '6. Pricing',
  '7. Slot settings',
  '8. Extras',
  '9. Amenities',
  '10. Rules',
] as const;
