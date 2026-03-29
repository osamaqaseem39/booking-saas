import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  createCricketIndoorCourt,
  createFutsalField,
  createPadelCourt,
  createTurfCourt,
  listBusinessLocations,
} from '../api/saasClient';
import { LOCATION_FACILITY_TYPE_OPTIONS } from '../constants/locationFacilityTypes';
import type { BusinessLocationRow } from '../types/domain';

const CODES = new Set(LOCATION_FACILITY_TYPE_OPTIONS.map((o) => o.value));

type SportMode = 'futsal_only' | 'cricket_only' | 'both';

export default function LocationFacilitySetupPage() {
  const { locationId = '', facilityCode = '' } = useParams<{
    locationId: string;
    facilityCode: string;
  }>();
  const navigate = useNavigate();
  const [locations, setLocations] = useState<BusinessLocationRow[]>([]);
  const [name, setName] = useState('');
  const [sportMode, setSportMode] = useState<SportMode>('both');
  const [description, setDescription] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [laneCount, setLaneCount] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const location = useMemo(
    () => locations.find((l) => l.id === locationId),
    [locations, locationId],
  );

  const label = useMemo(
    () => LOCATION_FACILITY_TYPE_OPTIONS.find((o) => o.value === facilityCode),
    [facilityCode],
  );

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

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!locationId || !name.trim() || !validCode) return;
    setSaving(true);
    setErr(null);
    try {
      if (facilityCode === 'turf-court') {
        await createTurfCourt({
          businessLocationId: locationId,
          name: name.trim(),
          sportMode,
        });
      } else if (facilityCode === 'padel-court') {
        await createPadelCourt({
          businessLocationId: locationId,
          name: name.trim(),
        });
      } else if (facilityCode === 'futsal-field') {
        await createFutsalField({
          businessLocationId: locationId,
          name: name.trim(),
          description: description.trim() || undefined,
          dimensions: dimensions.trim() || undefined,
        });
      } else if (facilityCode === 'cricket-indoor') {
        const lanes = laneCount.trim()
          ? Number.parseInt(laneCount, 10)
          : undefined;
        await createCricketIndoorCourt({
          businessLocationId: locationId,
          name: name.trim(),
          description: description.trim() || undefined,
          laneCount:
            lanes !== undefined && !Number.isNaN(lanes) ? lanes : undefined,
        });
      }
      navigate(`/app/locations/${locationId}/facilities`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (!validCode) {
    return (
      <div>
        <p className="muted">
          <Link to="/app/locations">← Locations</Link>
        </p>
        <div className="err-banner">Unknown facility type.</div>
      </div>
    );
  }

  const typeAllowed =
    location &&
    (!location.facilityTypes?.length ||
      location.facilityTypes.includes(facilityCode));

  return (
    <div>
      <p className="muted" style={{ marginBottom: '0.75rem' }}>
        <Link to={`/app/locations/${locationId}/facilities`}>
          ← Facilities for this location
        </Link>
      </p>
      <h1 className="page-title">
        New {label?.label ?? facilityCode}
      </h1>
      {!location ? (
        <p className="muted">Loading location…</p>
      ) : !typeAllowed ? (
        <div className="err-banner">
          This location does not include “{facilityCode}”. Edit the location’s
          facility types on the Locations page, then try again.
        </div>
      ) : (
        <>
          <p className="muted">
            Location: <strong>{location.name}</strong>. This form sends the
            minimum required fields; use the API for full turf/padel setup
            (pricing, amenities, rules, …).
          </p>
          {err && <div className="err-banner">{err}</div>}
          <form
            className="form-grid"
            style={{ maxWidth: '480px', marginTop: '1rem' }}
            onSubmit={(e) => void onSubmit(e)}
          >
            <div>
              <label>Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                maxLength={160}
              />
            </div>
            {facilityCode === 'turf-court' && (
              <div>
                <label>Sport mode</label>
                <select
                  value={sportMode}
                  onChange={(e) => setSportMode(e.target.value as SportMode)}
                >
                  <option value="both">Futsal + cricket</option>
                  <option value="futsal_only">Futsal only</option>
                  <option value="cricket_only">Cricket only</option>
                </select>
              </div>
            )}
            {(facilityCode === 'futsal-field' ||
              facilityCode === 'cricket-indoor') && (
              <div>
                <label>Description (optional)</label>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            )}
            {facilityCode === 'futsal-field' && (
              <div>
                <label>Dimensions (optional)</label>
                <input
                  value={dimensions}
                  onChange={(e) => setDimensions(e.target.value)}
                  placeholder="e.g. 40x20m"
                  maxLength={80}
                />
              </div>
            )}
            {facilityCode === 'cricket-indoor' && (
              <div>
                <label>Lane count (optional)</label>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={laneCount}
                  onChange={(e) => setLaneCount(e.target.value)}
                />
              </div>
            )}
            <button
              type="submit"
              className="btn-primary"
              disabled={saving || !name.trim()}
            >
              {saving ? 'Saving…' : 'Create facility'}
            </button>
          </form>
        </>
      )}
    </div>
  );
}
