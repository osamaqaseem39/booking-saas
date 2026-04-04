import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { listBusinessLocations } from '../api/saasClient';
import { CricketCourtSetupForm } from '../components/CricketCourtSetupForm';
import { FutsalCourtSetupForm } from '../components/FutsalCourtSetupForm';
import { PadelCourtSetupForm } from '../components/PadelCourtSetupForm';
import {
  CRICKET_COURT_SETUP_CODE,
  FUTSAL_COURT_SETUP_CODE,
  isCourtSetupAllowedForLocation,
} from '../constants/locationFacilityTypes';
import type { BusinessLocationRow } from '../types/domain';

const CODES = new Set([
  FUTSAL_COURT_SETUP_CODE,
  CRICKET_COURT_SETUP_CODE,
  'padel-court',
]);

export default function LocationFacilitySetupPage() {
  const { locationId = '', facilityCode = '' } = useParams<{
    locationId: string;
    facilityCode: string;
  }>();
  const navigate = useNavigate();
  const [locations, setLocations] = useState<BusinessLocationRow[]>([]);

  const location = useMemo(
    () => locations.find((l) => l.id === locationId),
    [locations, locationId],
  );

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
    return { label: facilityCode };
  }, [facilityCode]);

  useEffect(() => {
    void (async () => {
      try {
        const locs = await listBusinessLocations();
        setLocations(locs);
      } catch {
        setLocations([]);
      }
    })();
  }, []);

  const validCode = CODES.has(facilityCode);

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

  const typeAllowed =
    location && isCourtSetupAllowedForLocation(location, facilityCode);

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
      <h1 className="page-title">New {label.label}</h1>
      {!location ? (
        <p className="muted">Loading location…</p>
      ) : !typeAllowed ? (
        <div className="err-banner">
          This location does not include “{facilityCode}”. Edit the location’s
          facility types on the Locations page, then try again.
        </div>
      ) : facilityCode === FUTSAL_COURT_SETUP_CODE ? (
        <div className="turf-setup-page">
          <p className="muted turf-setup-page-intro">
            Location: <strong>{location.name}</strong>. Futsal pitch (structure
            and booking fields can be extended in the dashboard later).
          </p>
          <FutsalCourtSetupForm
            locationId={locationId}
            locations={locations}
            onSuccess={() => navigate('/app/Facilites')}
          />
        </div>
      ) : facilityCode === CRICKET_COURT_SETUP_CODE ? (
        <div className="turf-setup-page">
          <p className="muted turf-setup-page-intro">
            Location: <strong>{location.name}</strong>. Cricket pitch setup.
          </p>
          <CricketCourtSetupForm
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
