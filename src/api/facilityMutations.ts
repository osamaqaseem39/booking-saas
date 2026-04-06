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
  | 'futsal-court'
  | 'cricket-court'
  | 'padel-court'
  | GamingSetupCode;

export async function deleteFacilityByCode(
  code: FacilityRowCode,
  id: string,
  businessLocationId?: string,
): Promise<void> {
  if (isGamingSetupCode(code)) {
    const loc = businessLocationId?.trim();
    if (!loc) {
      throw new Error('Missing location for gaming station delete');
    }
    deleteGamingStation(loc, id);
    return;
  }
  if (code === 'futsal-court') {
    await deleteFutsalCourt(id);
    return;
  }
  if (code === 'cricket-court') {
    await deleteCricketCourt(id);
    return;
  }
  if (code === 'padel-court') {
    await deletePadelCourt(id);
    return;
  }
  throw new Error('Unknown facility type');
}
