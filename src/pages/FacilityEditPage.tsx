import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CricketCourtSetupForm } from '../components/CricketCourtSetupForm';
import { FutsalCourtSetupForm } from '../components/FutsalCourtSetupForm';
import { PadelCourtSetupForm } from '../components/PadelCourtSetupForm';
import { listBusinessLocations } from '../api/saasClient';
import {
  CRICKET_COURT_SETUP_CODE,
  FUTSAL_COURT_SETUP_CODE,
} from '../constants/locationFacilityTypes';
import type { BusinessLocationRow } from '../types/domain';

const EDITABLE_CODES = new Set([
  FUTSAL_COURT_SETUP_CODE,
  CRICKET_COURT_SETUP_CODE,
  'padel-court',
  'futsal-field',
  'cricket-indoor',
]);

export default function FacilityEditPage() {
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
        const locs = await listBusinessLocations();
        setLocations(locs);
      } catch (e) {
        setLoadErr(e instanceof Error ? e.message : 'Failed to load locations');
        setLocations([]);
      } finally {
        setLocationsLoadDone(true);
      }
    })();
  }, []);

  const location = useMemo(
    () => locations.find((l) => l.id === locationId),
    [locations, locationId],
  );

  const normalizedCode =
    facilityCode === FUTSAL_COURT_SETUP_CODE
      ? 'futsal-court'
      : facilityCode === CRICKET_COURT_SETUP_CODE
        ? 'cricket-court'
        : facilityCode;

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
          <Link to="/app/Facilites" className="btn-ghost btn-compact">
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
        <Link to="/app/Facilites" className="btn-ghost btn-compact">
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
          <FutsalCourtSetupForm
            locationId={locationId}
            locations={locations}
            existingCourtId={courtId}
            onSuccess={() => navigate('/app/Facilites')}
          />
        </div>
      ) : null}

      {normalizedCode === 'cricket-court' && location ? (
        <div className="turf-setup-page" style={{ marginTop: '1rem' }}>
          <CricketCourtSetupForm
            locationId={locationId}
            locations={locations}
            existingCourtId={courtId}
            onSuccess={() => navigate('/app/Facilites')}
          />
        </div>
      ) : null}

      {normalizedCode === 'padel-court' && location ? (
        <div style={{ marginTop: '1rem' }}>
          <PadelCourtSetupForm
            locationId={locationId}
            locations={locations}
            existingCourtId={courtId}
            onSuccess={() => navigate('/app/Facilites')}
          />
        </div>
      ) : null}
    </div>
  );
}
