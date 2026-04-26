import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArenaTurfCourtSetupForm } from '../../components/facilities/arena/ArenaTurfCourtSetupForm';
import { PadelCourtSetupForm } from '../../components/facilities/arena/PadelCourtSetupForm';
import { TableTennisCourtSetupForm } from '../../components/facilities/arena/TableTennisCourtSetupForm';
import { GamingFacilitySetupForm } from '../../components/facilities/gaming/GamingFacilitySetupForm';
import { listBusinessLocations } from '../../api/saasClient';
import {
  GAMING_SETUP_CODES,
  isGamingSetupCode,
} from '../../constants/gamingFacilityTypes';
import {
  CRICKET_COURT_SETUP_CODE,
  FUTSAL_COURT_SETUP_CODE,
  TABLE_TENNIS_COURT_SETUP_CODE,
} from '../../constants/locationFacilityTypes';
import type { BusinessLocationRow } from '../../types/domain';
import { useSession } from '../../context/SessionContext';

const EDITABLE_CODES = new Set<string>([
  'turf-court',
  FUTSAL_COURT_SETUP_CODE,
  CRICKET_COURT_SETUP_CODE,
  'padel-court',
  TABLE_TENNIS_COURT_SETUP_CODE,
  'futsal-field',
  'cricket-indoor',
  ...GAMING_SETUP_CODES,
]);

export default function FacilityEditPage() {
  const { session } = useSession();
  const isOwner = session?.roles?.includes('platform-owner') ?? false;
  const {
    locationId = '',
    facilityCode = '',
    courtId = '',
  } = useParams<{
    locationId: string;
    facilityCode: string;
    courtId: string;
  }>();
  const navigate = useNavigate();
  const [locations, setLocations] = useState<BusinessLocationRow[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [locationsLoadDone, setLocationsLoadDone] = useState(false);

  useEffect(() => {
    if (!locationId || !courtId) return;
    if (facilityCode === 'futsal-field') {
      navigate(
        `/app/locations/${locationId}/facilities/edit/${FUTSAL_COURT_SETUP_CODE}/${courtId}`,
        { replace: true },
      );
      return;
    }
    if (facilityCode === 'cricket-indoor') {
      navigate(
        `/app/locations/${locationId}/facilities/edit/${CRICKET_COURT_SETUP_CODE}/${courtId}`,
        { replace: true },
      );
    }
  }, [courtId, facilityCode, locationId, navigate]);

  useEffect(() => {
    void (async () => {
      try {
        const locs = await listBusinessLocations({
          ignoreActiveTenant: isOwner,
        });
        setLocations(locs);
      } catch (e) {
        setLoadErr(e instanceof Error ? e.message : 'Failed to load locations');
        setLocations([]);
      } finally {
        setLocationsLoadDone(true);
      }
    })();
  }, [isOwner]);

  const location = useMemo(
    () => locations.find((l) => l.id === locationId),
    [locations, locationId],
  );

  const normalizedCode =
    facilityCode === 'turf-court'
      ? 'turf-court'
      : facilityCode === FUTSAL_COURT_SETUP_CODE
      ? 'futsal-court'
      : facilityCode === CRICKET_COURT_SETUP_CODE
        ? 'cricket-court'
        : facilityCode;

  const gamingEditCode = isGamingSetupCode(facilityCode) ? facilityCode : null;

  if (!locationId || !courtId || !facilityCode) {
    return <p className="muted">Missing route parameters.</p>;
  }

  if (facilityCode === 'futsal-field' || facilityCode === 'cricket-indoor') {
    return <p className="muted">Redirecting…</p>;
  }

  if (!EDITABLE_CODES.has(facilityCode)) {
    return (
      <div>
        <div className="page-toolbar-row">
          <Link to="/app/Facilities" className="btn-ghost btn-compact">
            ← Facilities
          </Link>
        </div>
        <div className="err-banner">Unknown facility type.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-toolbar-row">
        <Link to="/app/locations" className="btn-ghost btn-compact">
          ← Locations
        </Link>
        <Link to="/app/Facilities" className="btn-ghost btn-compact">
          ← Facilities
        </Link>
      </div>
      <h1 className="page-title">Edit facility</h1>
      {loadErr && <div className="err-banner">{loadErr}</div>}
      {!locationsLoadDone && !loadErr ? (
        <p className="muted">Loading location…</p>
      ) : locationsLoadDone && !location && !loadErr ? (
        <div className="err-banner">
          Location not found or not visible for your user.
        </div>
      ) : location ? (
        <p className="muted">
          Location: <strong>{location.name}</strong>
          {location.city ? ` · ${location.city}` : ''}
        </p>
      ) : null}

      {normalizedCode === 'futsal-court' && location ? (
        <div className="turf-setup-page" style={{ marginTop: '1rem' }}>
          <ArenaTurfCourtSetupForm
            courtKind="futsal"
            locationId={locationId}
            locations={locations}
            existingCourtId={courtId}
            onSuccess={() => navigate('/app/Facilities')}
          />
        </div>
      ) : null}

      {normalizedCode === 'turf-court' && location ? (
        <div className="turf-setup-page" style={{ marginTop: '1rem' }}>
          <ArenaTurfCourtSetupForm
            courtKind="both"
            locationId={locationId}
            locations={locations}
            existingCourtId={courtId}
            onSuccess={() => navigate('/app/Facilities')}
          />
        </div>
      ) : null}

      {normalizedCode === 'cricket-court' && location ? (
        <div className="turf-setup-page" style={{ marginTop: '1rem' }}>
          <ArenaTurfCourtSetupForm
            courtKind="cricket"
            locationId={locationId}
            locations={locations}
            existingCourtId={courtId}
            onSuccess={() => navigate('/app/Facilities')}
          />
        </div>
      ) : null}

      {normalizedCode === 'padel-court' && location ? (
        <div style={{ marginTop: '1rem' }}>
          <PadelCourtSetupForm
            locationId={locationId}
            locations={locations}
            existingCourtId={courtId}
            onSuccess={() => navigate('/app/Facilities')}
          />
        </div>
      ) : null}

      {normalizedCode === TABLE_TENNIS_COURT_SETUP_CODE && location ? (
        <div style={{ marginTop: '1rem' }}>
          <TableTennisCourtSetupForm
            locationId={locationId}
            locations={locations}
            existingCourtId={courtId}
            onSuccess={() => navigate('/app/Facilities')}
          />
        </div>
      ) : null}

      {gamingEditCode && location ? (
        <div className="turf-setup-page" style={{ marginTop: '1rem' }}>
          <GamingFacilitySetupForm
            facilityCode={gamingEditCode}
            locationId={locationId}
            locations={locations}
            existingStationId={courtId}
            onSuccess={() => navigate('/app/Facilities')}
          />
        </div>
      ) : null}
    </div>
  );
}


