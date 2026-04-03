import {
  deleteCricketIndoorCourt,
  deleteFutsalField,
  deletePadelCourt,
  deleteTurfCourt,
  updateCricketIndoorCourt,
  updateFutsalField,
  updatePadelCourt,
  updateTurfCourt,
} from './saasClient';

export type FacilityRowCode =
  | 'turf-court'
  | 'padel-court'
  | 'futsal-field'
  | 'cricket-indoor';

export async function updateFacilityName(
  code: FacilityRowCode,
  id: string,
  name: string,
): Promise<void> {
  const trimmed = name.trim();
  if (code === 'turf-court') {
    await updateTurfCourt(id, { name: trimmed });
    return;
  }
  if (code === 'padel-court') {
    await updatePadelCourt(id, { name: trimmed });
    return;
  }
  if (code === 'futsal-field') {
    await updateFutsalField(id, { name: trimmed });
    return;
  }
  if (code === 'cricket-indoor') {
    await updateCricketIndoorCourt(id, { name: trimmed });
    return;
  }
  throw new Error('Unknown facility type');
}

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
