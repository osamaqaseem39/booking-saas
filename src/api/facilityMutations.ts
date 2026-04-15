import {
  deleteCricketCourt,
  deleteFutsalCourt,
  deletePadelCourt,
} from './saasClient';
import {
  isGamingSetupCode,
  type GamingSetupCode,
} from '../constants/gamingFacilityTypes';
import { deleteGamingStation } from '../utils/gamingStationLocalStore';

export type FacilityRowCode =
  | 'turf-court'
  | 'futsal-court'
  | 'cricket-court'
  | 'padel-court'
  | GamingSetupCode;

export async function deleteFacilityByCode(
  code: FacilityRowCode,
  id: string,
  businessLocationId?: string,
  tenantIdOverride?: string,
): Promise<void> {
  if (isGamingSetupCode(code)) {
    const loc = businessLocationId?.trim();
    if (!loc) {
      throw new Error('Missing location for gaming station delete');
    }
    await deleteGamingStation(loc, id);
    return;
  }
  if (code === 'futsal-court') {
    await deleteFutsalCourt(id, tenantIdOverride);
    return;
  }
  if (code === 'turf-court') {
    await deleteFutsalCourt(id, tenantIdOverride);
    return;
  }
  if (code === 'cricket-court') {
    await deleteCricketCourt(id, tenantIdOverride);
    return;
  }
  if (code === 'padel-court') {
    await deletePadelCourt(id, tenantIdOverride);
    return;
  }
  throw new Error('Unknown facility type');
}
