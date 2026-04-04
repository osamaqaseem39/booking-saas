import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PadelCourtSetupForm } from '../components/PadelCourtSetupForm';
import { TurfCourtSetupForm } from '../components/TurfCourtSetupForm';
import {
  getCricketIndoorCourt,
  getFutsalField,
  listBusinessLocations,
  updateCricketIndoorCourt,
  updateFutsalField,
} from '../api/saasClient';
import { TURF_COURT_SETUP_CODE } from '../constants/locationFacilityTypes';
import type { BusinessLocationRow } from '../types/domain';

const EDITABLE_CODES = new Set([
  TURF_COURT_SETUP_CODE,
  'turf-court',
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
    facilityCode === TURF_COURT_SETUP_CODE ? 'turf-court' : facilityCode;

  if (!locationId || !courtId || !facilityCode) {
    return <p className="muted">Missing route parameters.</p>;
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

      {normalizedCode === 'turf-court' && location ? (
        <div className="turf-setup-page" style={{ marginTop: '1rem' }}>
          <TurfCourtSetupForm
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

      {normalizedCode === 'futsal-field' && location ? (
        <EditFutsalFieldSection
          courtId={courtId}
          onSuccess={() => navigate('/app/Facilites')}
        />
      ) : null}

      {normalizedCode === 'cricket-indoor' && location ? (
        <EditCricketIndoorSection
          courtId={courtId}
          onSuccess={() => navigate('/app/Facilites')}
        />
      ) : null}
    </div>
  );
}

function EditFutsalFieldSection({
  courtId,
  onSuccess,
}: {
  courtId: string;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const d = await getFutsalField(courtId);
        if (cancelled) return;
        setName(d.name ?? '');
        setDescription(d.description ?? '');
        setDimensions(d.dimensions ?? '');
        setIsActive(d.isActive !== false);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : 'Failed to load field');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courtId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      await updateFutsalField(courtId, {
        name: name.trim(),
        description: description.trim() || undefined,
        dimensions: dimensions.trim() || undefined,
        isActive,
      });
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="empty-state">Loading field…</div>;
  if (err && !name) return <div className="err-banner">{err}</div>;

  return (
    <form
      className="form-grid"
      style={{ maxWidth: '520px', marginTop: '1rem' }}
      onSubmit={(e) => void onSubmit(e)}
    >
      {err && <div className="err-banner">{err}</div>}
      <div>
        <label>Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={160}
        />
      </div>
      <div>
        <label>Description (optional)</label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div>
        <label>Dimensions (optional)</label>
        <input
          value={dimensions}
          onChange={(e) => setDimensions(e.target.value)}
          placeholder="e.g. 40x20m"
          maxLength={80}
        />
      </div>
      <div>
        <label className="turf-setup-inline">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Accepting bookings (active listing)
        </label>
      </div>
      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}

function EditCricketIndoorSection({
  courtId,
  onSuccess,
}: {
  courtId: string;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [laneCount, setLaneCount] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const d = await getCricketIndoorCourt(courtId);
        if (cancelled) return;
        setName(d.name ?? '');
        setDescription(d.description ?? '');
        setLaneCount(
          d.laneCount !== undefined && d.laneCount !== null
            ? String(d.laneCount)
            : '',
        );
        setIsActive(d.isActive !== false);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : 'Failed to load court');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courtId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const lanes = laneCount.trim()
        ? Number.parseInt(laneCount, 10)
        : undefined;
      await updateCricketIndoorCourt(courtId, {
        name: name.trim(),
        description: description.trim() || undefined,
        laneCount:
          lanes !== undefined && !Number.isNaN(lanes) ? lanes : undefined,
        isActive,
      });
      onSuccess();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="empty-state">Loading court…</div>;
  if (err && !name) return <div className="err-banner">{err}</div>;

  return (
    <form
      className="form-grid"
      style={{ maxWidth: '520px', marginTop: '1rem' }}
      onSubmit={(e) => void onSubmit(e)}
    >
      {err && <div className="err-banner">{err}</div>}
      <div>
        <label>Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={160}
        />
      </div>
      <div>
        <label>Description (optional)</label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
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
      <div>
        <label className="turf-setup-inline">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Accepting bookings (active listing)
        </label>
      </div>
      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}
