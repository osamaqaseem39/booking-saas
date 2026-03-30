import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createBusinessLocation,
  listBusinesses,
} from '../api/saasClient';
import { LOCATION_FACILITY_TYPE_OPTIONS } from '../constants/locationFacilityTypes';
import { LOCATION_TYPE_OPTIONS } from '../constants/locationTypes';
import type { BusinessRow } from '../types/domain';

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

export default function LocationCreatePage() {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [businessId, setBusinessId] = useState('');
  const [locationType, setLocationType] = useState('arena');
  const [customType, setCustomType] = useState('');
  const [branchId, setBranchId] = useState('');
  const [arenaId, setArenaId] = useState('');
  const [branchName, setBranchName] = useState('');
  const [name, setName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [country, setCountry] = useState('Pakistan');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [phone, setPhone] = useState('');
  const [manager, setManager] = useState('');
  const [timezone, setTimezone] = useState('Asia/Karachi');
  const [currency, setCurrency] = useState('PKR');
  const [status, setStatus] = useState('active');
  const [workingHoursText, setWorkingHoursText] = useState('{}');
  const [facilityTypes, setFacilityTypes] = useState<string[]>([]);
  const facilityOptions = FACILITIES_BY_LOCATION_TYPE[locationType] ?? [];

  useEffect(() => {
    setFacilityTypes((prev) => prev.filter((x) => facilityOptions.some((o) => o.value === x)));
  }, [locationType]);

  useEffect(() => {
    void (async () => {
      try {
        const biz = await listBusinesses();
        setBusinesses(biz);
        if (biz.length > 0) setBusinessId(biz[0]!.id);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load businesses');
      }
    })();
  }, []);

  function validateForm(): string | null {
    if (!businessId.trim()) return 'Business is required.';
    if (!branchId.trim()) return 'Branch ID is required.';
    if (!arenaId.trim()) return 'Arena ID is required.';
    if (!branchName.trim()) return 'Branch name is required.';
    if (!name.trim()) return 'Location name is required.';
    if (!country.trim()) return 'Country is required.';
    if (!city.trim()) return 'City is required.';
    if (!area.trim()) return 'Area is required.';
    if (!addressLine.trim()) return 'Address is required.';
    if (!phone.trim()) return 'Phone is required.';
    if (!manager.trim()) return 'Manager is required.';
    if (!timezone.trim()) return 'Timezone is required.';
    if (!currency.trim()) return 'Currency is required.';
    if (!status.trim()) return 'Status is required.';
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return 'Latitude must be a valid number between -90 and 90.';
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      return 'Longitude must be a valid number between -180 and 180.';
    }
    try {
      const parsed = JSON.parse(workingHoursText || '{}');
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return 'Working hours must be a JSON object.';
      }
    } catch {
      return 'Working hours must be valid JSON.';
    }
    if (locationType === 'custom' && !customType.trim()) {
      return 'Custom location type is required.';
    }
    return null;
  }

  async function onCreate() {
    const validationError = validateForm();
    if (validationError) {
      setErr(validationError);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const lt = locationType === 'custom' ? customType.trim().slice(0, 80) : locationType;
      const workingHours = JSON.parse(workingHoursText || '{}') as Record<string, unknown>;
      const lat = Number(latitude);
      const lng = Number(longitude);
      await createBusinessLocation({
        businessId,
        branchId: branchId.trim(),
        arenaId: arenaId.trim(),
        branchName: branchName.trim(),
        locationType: lt,
        facilityTypes: facilityTypes.length ? facilityTypes : undefined,
        name: name.trim(),
        addressLine: addressLine.trim(),
        city: city.trim(),
        area: area.trim(),
        country: country.trim(),
        latitude: lat,
        longitude: lng,
        phone: phone.trim(),
        manager: manager.trim(),
        workingHours,
        timezone: timezone.trim(),
        currency: currency.trim().toUpperCase(),
        status: status.trim().toLowerCase(),
        location: {
          country: country.trim(),
          city: city.trim(),
          area: area.trim(),
          address: addressLine.trim(),
          coordinates: { lat, lng },
        },
        contact: {
          phone: phone.trim(),
          manager: manager.trim(),
        },
        settings: {
          timezone: timezone.trim(),
          currency: currency.trim().toUpperCase(),
        },
      });
      navigate('/app/locations', { replace: true });
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
        <h1 className="page-title">Add location</h1>
        <button type="button" className="btn-ghost" onClick={() => navigate('/app/locations')}>
          Back to list
        </button>
      </div>
      {err && <div className="err-banner">{err}</div>}
      <form
        className="form-grid"
        style={{ maxWidth: '560px' }}
        onSubmit={(e) => {
          e.preventDefault();
          void onCreate();
        }}
      >
        <div>
          <label>Business *</label>
          <select
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            required
          >
            <option value="">Select…</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.businessName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Branch ID *</label>
          <input value={branchId} onChange={(e) => setBranchId(e.target.value)} required />
        </div>
        <div>
          <label>Arena ID *</label>
          <input value={arenaId} onChange={(e) => setArenaId(e.target.value)} required />
        </div>
        <div>
          <label>Branch name *</label>
          <input value={branchName} onChange={(e) => setBranchName(e.target.value)} required />
        </div>
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
            <input
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              maxLength={80}
              required
            />
          </div>
        )}
        <div>
          <label>Location name *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label>Address *</label>
          <input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} required />
        </div>
        <div className="form-row-2">
          <div>
            <label>City *</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} required />
          </div>
          <div>
            <label>Area *</label>
            <input value={area} onChange={(e) => setArea(e.target.value)} required />
          </div>
        </div>
        <div className="form-row-2">
          <div>
            <label>Country *</label>
            <input value={country} onChange={(e) => setCountry(e.target.value)} required />
          </div>
          <div>
            <label>Phone *</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} required />
          </div>
        </div>
        <div className="form-row-2">
          <div>
            <label>Latitude *</label>
            <input value={latitude} onChange={(e) => setLatitude(e.target.value)} required />
          </div>
          <div>
            <label>Longitude *</label>
            <input value={longitude} onChange={(e) => setLongitude(e.target.value)} required />
          </div>
        </div>
        <div className="form-row-2">
          <div>
            <label>Manager *</label>
            <input value={manager} onChange={(e) => setManager(e.target.value)} required />
          </div>
          <div>
            <label>Status *</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)} required>
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </div>
        </div>
        <div className="form-row-2">
          <div>
            <label>Timezone *</label>
            <input value={timezone} onChange={(e) => setTimezone(e.target.value)} required />
          </div>
          <div>
            <label>Currency *</label>
            <input value={currency} onChange={(e) => setCurrency(e.target.value)} required />
          </div>
        </div>
        <div>
          <label>Working hours JSON *</label>
          <textarea
            value={workingHoursText}
            onChange={(e) => setWorkingHoursText(e.target.value)}
            rows={4}
            required
          />
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
        <button
          type="submit"
          className="btn-primary"
          disabled={
            busy ||
            !businessId ||
            !branchId.trim() ||
            !arenaId.trim() ||
            !branchName.trim() ||
            !name.trim() ||
            !country.trim() ||
            !city.trim() ||
            !area.trim() ||
            !addressLine.trim() ||
            !phone.trim() ||
            !manager.trim() ||
            !timezone.trim() ||
            !currency.trim() ||
            !status.trim() ||
            (locationType === 'custom' && !customType.trim())
          }
        >
          {busy ? 'Creating…' : 'Create location'}
        </button>
      </form>
    </div>
  );
}
