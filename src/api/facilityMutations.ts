import {
  deleteCricketIndoorCourt,
  deleteFutsalField,
  deletePadelCourt,
  deleteTurfCourt,
} from './saasClient';

export type FacilityRowCode =
  | 'turf-court'
  | 'padel-court'
  | 'futsal-field'
  | 'cricket-indoor';

export async function deleteFacilityByCode(
  code: FacilityRowCode,
  id: string,
): Promise<void> {
  if (code === 'turf-court') {
    await deleteTurfCourt(id);
    return;
  }
  if (code === 'padel-court') {
    await deletePadelCourt(id);
    return;
  }
  if (code === 'futsal-field') {
    await deleteFutsalField(id);
    return;
  }
  if (code === 'cricket-indoor') {
    await deleteCricketIndoorCourt(id);
    return;
  }
  throw new Error('Unknown facility type');
}
