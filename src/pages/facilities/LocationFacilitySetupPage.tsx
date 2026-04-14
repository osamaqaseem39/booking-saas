import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { listBusinessLocations } from '../../api/saasClient';
import { ArenaTurfCourtSetupForm } from '../../components/facilities/arena/ArenaTurfCourtSetupForm';
import { PadelCourtSetupForm } from '../../components/facilities/arena/PadelCourtSetupForm';
import { GamingFacilitySetupForm } from '../../components/facilities/gaming/GamingFacilitySetupForm';
import {
  formatGamingSetupLabel,
  GAMING_SETUP_CODES,
  isGamingSetupAllowedForLocation,
  isGamingSetupCode,
} from '../../constants/gamingFacilityTypes';
import {
  CRICKET_COURT_SETUP_CODE,
  FUTSAL_COURT_SETUP_CODE,
  isCourtSetupAllowedForLocation,
} from '../../constants/locationFacilityTypes';
import type { BusinessLocationRow } from '../../types/domain';
import { useSession } from '../../context/SessionContext';

const ARENA_SETUP_CODES = new Set<string>([
  FUTSAL_COURT_SETUP_CODE,
  CRICKET_COURT_SETUP_CODE,
  'padel-court',
]);

const GAMING_CODES_SET = new Set<string>(GAMING_SETUP_CODES);
type ArenaTurfKind = 'futsal' | 'cricket' | 'both';

function arenaKindLabel(kind: ArenaTurfKind): string {
  if (kind === 'both') return 'Field (futsal + cricket)';
  return kind === 'futsal' ? 'Futsal field' : 'Cricket field';
}

export default function LocationFacilitySetupPage() {
  const { session } = useSession();
  const isOwner = session?.roles?.includes('platform-owner') ?? false;
  const { locationId = '', facilityCode = '' } = useParams<{
    locationId: string;
    facilityCode: string;
  }>();
  const navigate = useNavigate();
  const [locations, setLocations] = useState<BusinessLocationRow[]>([]);
  const [selectedArenaKind, setSelectedArenaKind] = useState<ArenaTurfKind>(
    facilityCode === CRICKET_COURT_SETUP_CODE ? 'cricket' : 'futsal',
  );

  const location = useMemo(
    () => locations.find((l) => l.id === locationId),
    [locations, locationId],
  );
  const isArenaTurfRoute =
    facilityCode === FUTSAL_COURT_SETUP_CODE ||
    facilityCode === CRICKET_COURT_SETUP_CODE;
  const hasFutsalForLocation = isCourtSetupAllowedForLocation(
    location,
    FUTSAL_COURT_SETUP_CODE,
  );
  const hasCricketForLocation = isCourtSetupAllowedForLocation(
    location,
    CRICKET_COURT_SETUP_CODE,
  );
  const hasBothArenaSports = hasFutsalForLocation && hasCricketForLocation;

  const label = useMemo(() => {
    if (facilityCode === FUTSAL_COURT_SETUP_CODE) {
      return { label: 'Futsal pitch' };
    }
    if (facilityCode === CRICKET_COURT_SETUP_CODE) {
      return { label: 'Cricket pitch' };
    }
    if (facilityCode === 'padel-court') {
      return { label: 'Padel court' };
    }
    if (isGamingSetupCode(facilityCode)) {
      return { label: formatGamingSetupLabel(facilityCode) };
    }
    return { label: facilityCode };
  }, [facilityCode]);

  useEffect(() => {
    void (async () => {
      try {
        const locs = await listBusinessLocations({
          ignoreActiveTenant: isOwner,
        });
        setLocations(locs);
      } catch {
        setLocations([]);
      }
    })();
  }, [isOwner]);

  useEffect(() => {
    if (!isArenaTurfRoute) return;
    if (!location) {
      setSelectedArenaKind(
        facilityCode === CRICKET_COURT_SETUP_CODE ? 'cricket' : 'futsal',
      );
      return;
    }
    if (hasBothArenaSports) {
      setSelectedArenaKind('futsal');
      return;
    }
    if (hasCricketForLocation) {
      setSelectedArenaKind('cricket');
      return;
    }
    if (hasFutsalForLocation) {
      setSelectedArenaKind('futsal');
      return;
    }
    setSelectedArenaKind(
      facilityCode === CRICKET_COURT_SETUP_CODE ? 'cricket' : 'futsal',
    );
  }, [
    facilityCode,
    hasBothArenaSports,
    hasCricketForLocation,
    hasFutsalForLocation,
    isArenaTurfRoute,
    location,
  ]);

  const validCode =
    ARENA_SETUP_CODES.has(facilityCode) || GAMING_CODES_SET.has(facilityCode);

  if (!validCode) {
    return (
      <div>
        <div className="page-toolbar-row">
          <Link to="/app/Facilites" className="btn-ghost btn-compact">
            ← Main facility page
          </Link>
        </div>
        <div className="err-banner">Unknown facility type.</div>
      </div>
    );
  }

  const arenaAllowed =
    location &&
    ARENA_SETUP_CODES.has(facilityCode) &&
    (facilityCode === 'padel-court'
      ? isCourtSetupAllowedForLocation(location, facilityCode)
      : hasFutsalForLocation || hasCricketForLocation);
  const gamingAllowed =
    location &&
    GAMING_CODES_SET.has(facilityCode) &&
    isGamingSetupAllowedForLocation(location, facilityCode);
  const typeAllowed = Boolean(arenaAllowed || gamingAllowed);

  return (
    <div>
      <div className="page-toolbar-row">
        <Link to="/app/locations" className="btn-ghost btn-compact">
          ← Locations
        </Link>
        <Link to="/app/Facilites" className="btn-ghost btn-compact">
          ← Main facility page
        </Link>
      </div>
      <h1 className="page-title">
        New {isArenaTurfRoute ? arenaKindLabel(selectedArenaKind) : label.label}
      </h1>
      {!location ? (
        <p className="muted">Loading location…</p>
      ) : !typeAllowed ? (
        <div className="err-banner">
          This location does not include “{facilityCode}”. Edit the location’s
          facility types on the Locations page, then try again.
        </div>
      ) : GAMING_CODES_SET.has(facilityCode) && isGamingSetupCode(facilityCode) ? (
        <div className="turf-setup-page">
          <p className="muted turf-setup-page-intro">
            Location: <strong>{location.name}</strong>. {label.label} station —
            pricing and slots follow the same structure as arena facilities.
          </p>
          <GamingFacilitySetupForm
            facilityCode={facilityCode}
            locationId={locationId}
            locations={locations}
            onSuccess={() => navigate('/app/Facilites')}
          />
        </div>
      ) : isArenaTurfRoute ? (
        <div className="turf-setup-page">
          <p className="muted turf-setup-page-intro">
            Location: <strong>{location.name}</strong>.{' '}
            {arenaKindLabel(selectedArenaKind)}{' '}
            setup.
          </p>
          {hasBothArenaSports ? (
            <div className="turf-setup-card" style={{ marginBottom: '0.75rem' }}>
              <h4 style={{ marginBottom: '0.5rem' }}>Select sports for this field</h4>
              <div className="turf-setup-checkrow">
                <label className="turf-setup-inline">
                  <input
                    type="checkbox"
                    checked={
                      selectedArenaKind === 'futsal' ||
                      selectedArenaKind === 'both'
                    }
                    onChange={(e) => {
                      const futsalOn = e.target.checked;
                      const cricketOn =
                        selectedArenaKind === 'cricket' ||
                        selectedArenaKind === 'both';
                      if (futsalOn && cricketOn) setSelectedArenaKind('both');
                      else if (futsalOn) setSelectedArenaKind('futsal');
                      else if (cricketOn) setSelectedArenaKind('cricket');
                    }}
                  />
                  Futsal
                </label>
                <label className="turf-setup-inline">
                  <input
                    type="checkbox"
                    checked={
                      selectedArenaKind === 'cricket' ||
                      selectedArenaKind === 'both'
                    }
                    onChange={(e) => {
                      const cricketOn = e.target.checked;
                      const futsalOn =
                        selectedArenaKind === 'futsal' ||
                        selectedArenaKind === 'both';
                      if (futsalOn && cricketOn) setSelectedArenaKind('both');
                      else if (futsalOn) setSelectedArenaKind('futsal');
                      else if (cricketOn) setSelectedArenaKind('cricket');
                    }}
                  />
                  Cricket
                </label>
              </div>
              <p className="muted" style={{ marginTop: '0.5rem' }}>
                If both are enabled, this creates one shared field with linked
                futsal and cricket records.
              </p>
            </div>
          ) : null}
          <ArenaTurfCourtSetupForm
            courtKind={selectedArenaKind}
            locationId={locationId}
            locations={locations}
            onSuccess={() => navigate('/app/Facilites')}
          />
        </div>
      ) : (
        <>
          <p className="muted">
            Location: <strong>{location.name}</strong>. Dedicated padel court
            setup (structure, dimensions, pricing, slots, extras, and rules).
          </p>
          <PadelCourtSetupForm
            locationId={locationId}
            locations={locations}
            onSuccess={() => navigate('/app/Facilites')}
          />
        </>
      )}
    </div>
  );
}


