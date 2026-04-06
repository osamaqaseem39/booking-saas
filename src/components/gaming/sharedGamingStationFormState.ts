import type { GamingStationRecord } from '../../utils/gamingStationLocalStore';

export type GamingStationSharedFormState = {
  name: string;
  imageLines: string;
  description: string;
  unitStatus: 'active' | 'maintenance' | 'draft';
  isActive: boolean;
  pricePerSlot: string;
  peakWeekdayEvening: string;
  peakWeekend: string;
  bundleNote: string;
  slotDuration: '30' | '60' | '90' | '';
  bufferMinutes: string;
  amenSnacksNearby: boolean;
  amenExtraControllers: boolean;
  amenStreamingCapture: boolean;
};

export function emptySharedGamingStationFormState(): GamingStationSharedFormState {
  return {
    name: '',
    imageLines: '',
    description: '',
    unitStatus: 'active',
    isActive: true,
    pricePerSlot: '',
    peakWeekdayEvening: '',
    peakWeekend: '',
    bundleNote: '',
    slotDuration: '60',
    bufferMinutes: '',
    amenSnacksNearby: false,
    amenExtraControllers: false,
    amenStreamingCapture: false,
  };
}

export function recordToSharedFormState(
  r: GamingStationRecord,
): GamingStationSharedFormState {
  return {
    name: r.name,
    imageLines: r.imageLines,
    description: r.description,
    unitStatus: r.unitStatus,
    isActive: r.isActive,
    pricePerSlot: r.pricePerSlot,
    peakWeekdayEvening: r.peakWeekdayEvening,
    peakWeekend: r.peakWeekend,
    bundleNote: r.bundleNote,
    slotDuration: r.slotDuration,
    bufferMinutes: r.bufferMinutes,
    amenSnacksNearby: r.amenSnacksNearby,
    amenExtraControllers: r.amenExtraControllers,
    amenStreamingCapture: r.amenStreamingCapture,
  };
}

export function mergeSharedIntoRecord(
  base: GamingStationRecord,
  shared: GamingStationSharedFormState,
): GamingStationRecord {
  return {
    ...base,
    ...shared,
    updatedAt: new Date().toISOString(),
  };
}
