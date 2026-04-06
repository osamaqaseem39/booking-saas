import type { GamingSetupCode } from '../../constants/gamingFacilityTypes';
import { isGamingConsoleSetupCode } from '../../constants/gamingFacilityTypes';
import type { BusinessLocationRow } from '../../types/domain';
import { GamingConsoleSetupForm } from './GamingConsoleSetupForm';
import { GamingPcSetupForm } from './GamingPcSetupForm';
import { GamingSteeringSimSetupForm } from './GamingSteeringSimSetupForm';
import { GamingVrSetupForm } from './GamingVrSetupForm';

export function GamingFacilitySetupForm({
  facilityCode,
  locationId,
  locations,
  onSuccess,
  existingStationId,
}: {
  facilityCode: GamingSetupCode;
  locationId: string;
  locations: BusinessLocationRow[];
  onSuccess: () => void;
  existingStationId?: string;
}) {
  if (isGamingConsoleSetupCode(facilityCode)) {
    return (
      <GamingConsoleSetupForm
        locationId={locationId}
        locations={locations}
        setupCode={facilityCode}
        onSuccess={onSuccess}
        existingStationId={existingStationId}
      />
    );
  }
  if (facilityCode === 'gaming-pc') {
    return (
      <GamingPcSetupForm
        locationId={locationId}
        locations={locations}
        onSuccess={onSuccess}
        existingStationId={existingStationId}
      />
    );
  }
  if (facilityCode === 'gaming-vr') {
    return (
      <GamingVrSetupForm
        locationId={locationId}
        locations={locations}
        onSuccess={onSuccess}
        existingStationId={existingStationId}
      />
    );
  }
  return (
    <GamingSteeringSimSetupForm
      locationId={locationId}
      locations={locations}
      onSuccess={onSuccess}
      existingStationId={existingStationId}
    />
  );
}
