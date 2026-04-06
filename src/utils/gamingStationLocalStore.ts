/**
 * Client-side store until gaming stations API exists.
 * Keyed by location; safe to replace with API calls later.
 */
import type { GamingSetupCode } from '../constants/gamingFacilityTypes';

const STORAGE_KEY = 'bookings-dashboard:v1:gaming-stations';

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

type StoreShape = Record<string, GamingStationRecord[]>;

function readAll(): StoreShape {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoreShape;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAll(data: StoreShape) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function listGamingStationsForLocation(
  locationId: string,
): GamingStationRecord[] {
  const all = readAll();
  return [...(all[locationId] ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
}

export function getGamingStation(
  locationId: string,
  id: string,
): GamingStationRecord | undefined {
  return listGamingStationsForLocation(locationId).find((r) => r.id === id);
}

export function saveGamingStation(record: GamingStationRecord): void {
  const all = readAll();
  const list = [...(all[record.businessLocationId] ?? [])];
  const idx = list.findIndex((r) => r.id === record.id);
  if (idx >= 0) list[idx] = record;
  else list.push(record);
  all[record.businessLocationId] = list;
  writeAll(all);
}

export function deleteGamingStation(locationId: string, id: string): void {
  const all = readAll();
  const list = (all[locationId] ?? []).filter((r) => r.id !== id);
  if (list.length) all[locationId] = list;
  else delete all[locationId];
  writeAll(all);
}

export function duplicateGamingStation(
  locationId: string,
  id: string,
): GamingStationRecord | null {
  const src = getGamingStation(locationId, id);
  if (!src) return null;
  const now = new Date().toISOString();
  const copy: GamingStationRecord = {
    ...src,
    id: crypto.randomUUID(),
    name: `${src.name} (copy)`,
    createdAt: now,
    updatedAt: now,
  };
  saveGamingStation(copy);
  return copy;
}
