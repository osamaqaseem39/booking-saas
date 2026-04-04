import {
  deleteCricketCourt,
  deleteFutsalCourt,
  deletePadelCourt,
} from './saasClient';

export type FacilityRowCode =
  | 'futsal-court'
  | 'cricket-court'
  | 'padel-court';

export async function deleteFacilityByCode(
  code: FacilityRowCode,
  id: string,
): Promise<void> {
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
