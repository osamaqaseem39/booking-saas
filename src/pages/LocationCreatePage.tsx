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
  const [name, setName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
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

  async function onCreate() {
    setBusy(true);
    setErr(null);
    try {
      const lt = locationType === 'custom' ? customType.trim().slice(0, 80) : locationType;
      await createBusinessLocation({
        businessId,
        locationType: lt,
        facilityTypes: facilityTypes.length ? facilityTypes : undefined,
        name: name.trim(),
        addressLine: addressLine.trim() || undefined,
        city: city.trim() || undefined,
        phone: phone.trim() || undefined,
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
      <div className="form-grid" style={{ maxWidth: '560px' }}>
        <div>
          <label>Business</label>
          <select value={businessId} onChange={(e) => setBusinessId(e.target.value)}>
            <option value="">Select…</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.businessName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Location type</label>
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
            <label>Custom type (max 80 chars)</label>
            <input
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              maxLength={80}
            />
          </div>
        )}
        <div>
          <label>Location name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label>Address (optional)</label>
          <input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} />
        </div>
        <div className="form-row-2">
          <div>
            <label>City</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} />
          </div>
          <div>
            <label>Phone</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
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
          type="button"
          className="btn-primary"
          disabled={
            busy ||
            !businessId ||
            !name.trim() ||
            (locationType === 'custom' && !customType.trim())
          }
          onClick={() => void onCreate()}
        >
          {busy ? 'Creating…' : 'Create location'}
        </button>
      </div>
    </div>
  );
}
