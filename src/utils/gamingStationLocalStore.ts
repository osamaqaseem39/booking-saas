import type { GamingSetupCode } from '../constants/gamingFacilityTypes';
import { request } from '../api/saasClient';

export type GamingStationRecord = {
  id: string;
  businessLocationId: string;
  setupCode: GamingSetupCode;
  name: string;
  unitStatus: 'active' | 'maintenance' | 'draft';
  description: string;
  isActive: boolean;
  imageLines: string;
  pricePerSlot: string;
  peakWeekdayEvening: string;
  peakWeekend: string;
  bundleNote: string;
  slotDuration: '30' | '60' | '90' | '';
  bufferMinutes: string;
  amenSnacksNearby: boolean;
  amenExtraControllers: boolean;
  amenStreamingCapture: boolean;
  specs: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type GamingStationApiRow = {
  id: string;
  businessLocationId: string;
  setupCode: GamingSetupCode;
  name: string;
  unitStatus?: 'active' | 'maintenance' | 'draft';
  description?: string;
  isActive?: boolean;
  imageUrls?: string[];
  pricePerSlot?: string | number | null;
  peakPricing?: { weekdayEvening?: number; weekend?: number } | null;
  bundleNote?: string | null;
  slotDurationMinutes?: number | null;
  bufferBetweenSlotsMinutes?: number | null;
  amenities?: {
    snacksNearby?: boolean;
    extraControllers?: boolean;
    streamingCapture?: boolean;
  } | null;
  specs?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
};

const PATH_BY_SETUP: Record<GamingSetupCode, string> = {
  'gaming-pc': '/gaming/pc-stations',
  'gaming-ps5': '/gaming/ps5-stations',
  'gaming-ps4': '/gaming/ps4-stations',
  'gaming-xbox-one': '/gaming/xbox-one-stations',
  'gaming-xbox-360': '/gaming/xbox-360-stations',
  'gaming-vr': '/gaming/vr-stations',
  'gaming-steering-sim': '/gaming/steering-sim-stations',
};
const ALL_GAMING_SETUP_CODES = Object.keys(PATH_BY_SETUP) as GamingSetupCode[];

function toNumText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v;
  return '';
}

function toMinutes(v: unknown): GamingStationRecord['slotDuration'] {
  const s = toNumText(v);
  return s === '30' || s === '60' || s === '90' ? s : '';
}

function rowToRecord(row: GamingStationApiRow): GamingStationRecord {
  return {
    id: row.id,
    businessLocationId: row.businessLocationId,
    setupCode: row.setupCode,
    name: row.name ?? '',
    unitStatus: row.unitStatus ?? 'active',
    description: row.description ?? '',
    isActive: row.isActive ?? true,
    imageLines: (row.imageUrls ?? []).join('\n'),
    pricePerSlot: toNumText(row.pricePerSlot),
    peakWeekdayEvening: toNumText(row.peakPricing?.weekdayEvening),
    peakWeekend: toNumText(row.peakPricing?.weekend),
    bundleNote: row.bundleNote ?? '',
    slotDuration: toMinutes(row.slotDurationMinutes),
    bufferMinutes: toNumText(row.bufferBetweenSlotsMinutes),
    amenSnacksNearby: !!row.amenities?.snacksNearby,
    amenExtraControllers: !!row.amenities?.extraControllers,
    amenStreamingCapture: !!row.amenities?.streamingCapture,
    specs: row.specs ?? {},
    createdAt: row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? new Date().toISOString(),
  };
}

function toBody(record: GamingStationRecord) {
  const imageUrls = record.imageLines
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    businessLocationId: record.businessLocationId,
    setupCode: record.setupCode,
    name: record.name,
    unitStatus: record.unitStatus,
    isActive: record.isActive,
    description: record.description || undefined,
    imageUrls: imageUrls.length ? imageUrls : undefined,
    pricePerSlot: record.pricePerSlot ? Number(record.pricePerSlot) : undefined,
    peakPricing:
      record.peakWeekdayEvening || record.peakWeekend
        ? {
            ...(record.peakWeekdayEvening
              ? { weekdayEvening: Number(record.peakWeekdayEvening) }
              : {}),
            ...(record.peakWeekend ? { weekend: Number(record.peakWeekend) } : {}),
          }
        : undefined,
    bundleNote: record.bundleNote || undefined,
    slotDurationMinutes: record.slotDuration ? Number(record.slotDuration) : undefined,
    bufferBetweenSlotsMinutes: record.bufferMinutes ? Number(record.bufferMinutes) : undefined,
    amenities: {
      snacksNearby: record.amenSnacksNearby,
      extraControllers: record.amenExtraControllers,
      streamingCapture: record.amenStreamingCapture,
    },
    specs: record.specs ?? {},
  };
}

export async function listGamingStationsForLocation(
  locationId: string,
): Promise<GamingStationRecord[]> {
  const encodedLocationId = encodeURIComponent(locationId);
  const rowGroups = await Promise.all(
    ALL_GAMING_SETUP_CODES.map((setupCode) =>
      request<GamingStationApiRow[]>(
        `${PATH_BY_SETUP[setupCode]}?businessLocationId=${encodedLocationId}`,
        { method: 'GET' },
      ),
    ),
  );
  const rows = rowGroups.flat();
  return rows.map(rowToRecord).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
}

export async function getGamingStation(
  locationId: string,
  id: string,
): Promise<GamingStationRecord | undefined> {
  for (const setupCode of ALL_GAMING_SETUP_CODES) {
    try {
      const row = await request<GamingStationApiRow>(
        `${PATH_BY_SETUP[setupCode]}/${id}`,
        { method: 'GET' },
      );
      const rec = rowToRecord(row);
      if (rec.businessLocationId === locationId) return rec;
      return undefined;
    } catch {
      // Try next typed endpoint until one resolves this id.
    }
  }
  return undefined;
}

export async function saveGamingStation(record: GamingStationRecord): Promise<void> {
  const basePath = PATH_BY_SETUP[record.setupCode];
  const body = toBody(record);
  if (record.id) {
    await request(`${basePath}/${record.id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    return;
  }
  await request(basePath, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function deleteGamingStation(locationId: string, id: string): Promise<void> {
  const row = await getGamingStation(locationId, id);
  if (!row) return;
  await request(`${PATH_BY_SETUP[row.setupCode]}/${id}`, { method: 'DELETE' });
}

export async function duplicateGamingStation(
  locationId: string,
  id: string,
): Promise<GamingStationRecord | null> {
  const src = await getGamingStation(locationId, id);
  if (!src) return null;
  const body = toBody({
    ...src,
    id: '',
    name: `${src.name} (copy)`,
  });
  const basePath = PATH_BY_SETUP[src.setupCode];
  const created = await request<GamingStationApiRow>(basePath, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return rowToRecord(created);
}
