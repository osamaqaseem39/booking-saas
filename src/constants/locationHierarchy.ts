export type LocationHierarchy = Record<
  string,
  Record<string, Record<string, string[]>>
>;

export const LOCATION_HIERARCHY: LocationHierarchy = {
  Pakistan: {
    Punjab: {
      Lahore: ['Gulberg', 'DHA', 'Johar Town', 'Model Town'],
      Rawalpindi: ['Saddar', 'Bahria Town', 'Chaklala'],
      Faisalabad: ['D Ground', 'People Colony', 'Madina Town'],
    },
    Sindh: {
      Karachi: ['Clifton', 'Gulshan-e-Iqbal', 'DHA', 'Saddar'],
      Hyderabad: ['Latifabad', 'Qasimabad', 'Saddar'],
    },
    'Khyber Pakhtunkhwa': {
      Peshawar: ['University Town', 'Hayatabad', 'Saddar'],
      Abbottabad: ['Jinnahabad', 'Nawan Shehr'],
    },
  },
  UAE: {
    Dubai: {
      Dubai: ['Downtown Dubai', 'Deira', 'Jumeirah', 'Business Bay'],
    },
    AbuDhabi: {
      'Abu Dhabi': ['Al Zahiyah', 'Khalifa City', 'Al Reem Island'],
    },
  },
  SaudiArabia: {
    Riyadh: {
      Riyadh: ['Al Olaya', 'Al Malaz', 'Al Nakheel'],
    },
    Makkah: {
      Jeddah: ['Al Balad', 'Al Rawdah', 'Al Hamra'],
    },
  },
};

export function getStatesByCountry(country: string): string[] {
  return Object.keys(LOCATION_HIERARCHY[country] ?? {});
}

export function getCitiesByCountryState(country: string, state: string): string[] {
  return Object.keys(LOCATION_HIERARCHY[country]?.[state] ?? {});
}

export function getAreasByCountryStateCity(
  country: string,
  state: string,
  city: string,
): string[] {
  return LOCATION_HIERARCHY[country]?.[state]?.[city] ?? [];
}

export function inferStateFromCity(
  country: string,
  city: string,
  area?: string,
): string {
  const states = getStatesByCountry(country);
  for (const state of states) {
    const cities = LOCATION_HIERARCHY[country]?.[state] ?? {};
    const cityAreas = cities[city];
    if (!cityAreas) continue;
    if (!area || cityAreas.includes(area)) return state;
  }
  return '';
}
