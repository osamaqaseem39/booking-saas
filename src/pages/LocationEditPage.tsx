import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  deleteBusinessLocation,
  listBusinessLocations,
  updateBusinessLocation,
} from '../api/saasClient';
import { LOCATION_FACILITY_TYPE_OPTIONS } from '../constants/locationFacilityTypes';
import { LOCATION_TYPE_OPTIONS } from '../constants/locationTypes';
import type { BusinessLocationRow } from '../types/domain';

const FACILITIES_BY_LOCATION_TYPE: Record<string, { value: string; label: string }[]> = {
  arena: LOCATION_FACILITY_TYPE_OPTIONS,
  'gaming-zone': [
    { value: 'gaming-pc', label: 'Gaming PC' },
    { value: 'xbox', label: 'Xbox' },
    { value: 'ps5', label: 'PS5' },
    { value: 'ps4', label: 'PS4' },
    { value: 'vr', label: 'VR' },
  ],
  snooker: [
    { value: 'snooker-table', label: 'Snooker Table' },
    { value: 'billiard', label: 'Billiard' },
  ],
  'table-tennis': [{ value: 'table-tennis-table', label: 'Table Tennis Table' }],
};

export default function LocationEditPage() {
  const { locationId = '' } = useParams<{ locationId: string }>();
  const navigate = useNavigate();
  const [rows, setRows] = useState<BusinessLocationRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [locationType, setLocationType] = useState('arena');
  const [customType, setCustomType] = useState('');
  const [name, setName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [facilityTypes, setFacilityTypes] = useState<string[]>([]);
  const facilityOptions = FACILITIES_BY_LOCATION_TYPE[locationType] ?? [];

  const location = useMemo(
    () => rows.find((r) => r.id === locationId) ?? null,
    [rows, locationId],
  );

  useEffect(() => {
    void (async () => {
      try {
        const locs = await listBusinessLocations();
        setRows(locs);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load location');
      }
    })();
  }, [locationId]);

  useEffect(() => {
    if (!location) return;
    setName(location.name);
    setAddressLine(location.addressLine ?? '');
    setCity(location.city ?? '');
    setPhone(location.phone ?? '');
    setIsActive(location.isActive);
    setFacilityTypes(location.facilityTypes ?? []);
    const isPreset = LOCATION_TYPE_OPTIONS.some((o) => o.value === location.locationType);
    if (location.locationType && !isPreset) {
      setLocationType('custom');
      setCustomType(location.locationType);
    } else {
      setLocationType(location.locationType || 'arena');
      setCustomType('');
    }
  }, [location]);

  useEffect(() => {
    setFacilityTypes((prev) => prev.filter((x) => facilityOptions.some((o) => o.value === x)));
  }, [locationType]);

  function validateForm(): string | null {
    if (!name.trim()) return 'Location name is required.';
    if (!city.trim()) return 'City is required.';
    if (locationType === 'custom' && !customType.trim()) {
      return 'Custom location type is required.';
    }
    return null;
  }

  async function onSave() {
    if (!locationId.trim()) return;
    const validationError = validateForm();
    if (validationError) {
      setErr(validationError);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const lt = locationType === 'custom' ? customType.trim().slice(0, 80) : locationType;
      await updateBusinessLocation(locationId, {
        locationType: lt,
        facilityTypes,
        name: name.trim(),
        addressLine: addressLine.trim() || undefined,
        city: city.trim() || undefined,
        phone: phone.trim() || undefined,
        isActive,
      });
      navigate('/app/locations', { replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!locationId.trim()) return;
    const yes = window.confirm('Delete this location? This cannot be undone.');
    if (!yes) return;
    setDeleting(true);
    setErr(null);
    try {
      await deleteBusinessLocation(locationId);
      navigate('/app/locations', { replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setDeleting(false);
    }
  }

  if (!locationId.trim()) return <p className="muted">Missing location id.</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
        <h1 className="page-title">Edit location</h1>
        <button type="button" className="btn-ghost" onClick={() => navigate('/app/locations')}>
          Back to list
        </button>
      </div>
      {err && <div className="err-banner">{err}</div>}
      {!location ? (
        <div className="empty-state">Location not found.</div>
      ) : (
        <form
          className="form-grid"
          style={{ maxWidth: '560px' }}
          onSubmit={(e) => {
            e.preventDefault();
            void onSave();
          }}
        >
          <div>
            <label>Location type *</label>
            <select value={locationType} onChange={(e) => setLocationType(e.target.value)}>
              {LOCATION_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
              <option value="custom">Custom…</option>
            </select>
          </div>
          {locationType === 'custom' && (
            <div>
              <label>Custom type (max 80 chars) *</label>
              <input value={customType} onChange={(e) => setCustomType(e.target.value)} maxLength={80} required />
            </div>
          )}
          <div>
            <label>Location name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label>Address (optional)</label>
            <input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} />
          </div>
          <div className="form-row-2">
            <div>
              <label>City *</label>
              <input value={city} onChange={(e) => setCity(e.target.value)} required />
            </div>
            <div>
              <label>Phone (optional)</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
              Active location
            </label>
          </div>
          <div>
            <label>Facility types at this location</label>
            {!facilityOptions.length && (
              <p className="muted">Select a supported location type to see facility options.</p>
            )}
            <div className="checkbox-grid">
              {facilityOptions.map((o) => (
                <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <input
                    type="checkbox"
                    checked={facilityTypes.includes(o.value)}
                    onChange={() =>
                      setFacilityTypes((prev) =>
                        prev.includes(o.value)
                          ? prev.filter((x) => x !== o.value)
                          : [...prev, o.value],
                      )
                    }
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="submit"
              className="btn-primary"
              disabled={
                busy ||
                !name.trim() ||
                !city.trim() ||
                (locationType === 'custom' && !customType.trim())
              }
            >
              {busy ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" className="btn-danger" disabled={deleting} onClick={() => void onDelete()}>
              {deleting ? 'Deleting…' : 'Delete location'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
