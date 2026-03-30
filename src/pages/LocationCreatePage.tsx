import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createBusinessLocation,
  listBusinesses,
} from '../api/saasClient';
import { LOCATION_FACILITY_TYPE_OPTIONS } from '../constants/locationFacilityTypes';
import {
  getAreasByCountryStateCity,
  getCitiesByCountryState,
  getStatesByCountry,
  LOCATION_HIERARCHY,
} from '../constants/locationHierarchy';
import { LOCATION_TYPE_OPTIONS } from '../constants/locationTypes';
import type { BusinessRow } from '../types/domain';

export default function LocationCreatePage() {
  const navigate = useNavigate();
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [businessId, setBusinessId] = useState('');
  const [locationType, setLocationType] = useState('arena');
  const [customType, setCustomType] = useState('');
  const [branchName, setBranchName] = useState('');
  const [name, setName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [area, setArea] = useState('');
  const [country, setCountry] = useState('Pakistan');
  const [stateProvince, setStateProvince] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [phone, setPhone] = useState('');
  const [manager, setManager] = useState('');
  const [timezone, setTimezone] = useState('Asia/Karachi');
  const [currency, setCurrency] = useState('PKR');
  const [isActive, setIsActive] = useState(true);
  const [workingHoursText, setWorkingHoursText] = useState('{}');
  const [facilityTypes, setFacilityTypes] = useState<string[]>([]);
  const [customFacilityType, setCustomFacilityType] = useState('');
  const facilityOptions = LOCATION_FACILITY_TYPE_OPTIONS;
  const countryOptions = Object.keys(LOCATION_HIERARCHY);
  const stateOptions = getStatesByCountry(country);
  const cityOptions = getCitiesByCountryState(country, stateProvince);
  const areaOptions = getAreasByCountryStateCity(country, stateProvince, city);

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
    if (!branchName.trim()) return 'Branch name is required.';
    if (!name.trim()) return 'Location name is required.';
    if (!country.trim()) return 'Country is required.';
    if (!stateProvince.trim()) return 'State / Province is required.';
    if (!city.trim()) return 'City is required.';
    if (!area.trim()) return 'Area is required.';
    if (!addressLine.trim()) return 'Address is required.';
    if (!phone.trim()) return 'Phone is required.';
    if (!manager.trim()) return 'Manager is required.';
    if (!timezone.trim()) return 'Timezone is required.';
    if (!currency.trim()) return 'Currency is required.';
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
        status: isActive ? 'active' : 'inactive',
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

  function addCustomFacilityType() {
    const next = customFacilityType.trim().toLowerCase();
    if (!next) return;
    setFacilityTypes((prev) => (prev.includes(next) ? prev : [...prev, next]));
    setCustomFacilityType('');
  }

  function onCountryChange(nextCountry: string) {
    setCountry(nextCountry);
    setStateProvince('');
    setCity('');
    setArea('');
  }

  function onStateChange(nextState: string) {
    setStateProvince(nextState);
    setCity('');
    setArea('');
  }

  function onCityChange(nextCity: string) {
    setCity(nextCity);
    setArea('');
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
        <h1 className="page-title">Add location</h1>
        <button type="button" className="btn-ghost" onClick={() => navigate('/app/locations')}>
          Back to list
        </button>
      </div>
      <p className="muted">
        Create location profile, contact details, geolocation, and facility types.
      </p>
      {err && <div className="err-banner">{err}</div>}
      <form
        className="form-grid"
        style={{ maxWidth: '920px', margin: '1rem auto 0' }}
        onSubmit={(e) => {
          e.preventDefault();
          void onCreate();
        }}
      >
        <div className="connection-panel" style={{ margin: 0 }}>
          <h2>Location Basics</h2>
          <div className="form-row-2">
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
              <label>Location Type *</label>
              <select value={locationType} onChange={(e) => setLocationType(e.target.value)}>
                {LOCATION_TYPE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
                <option value="custom">Custom…</option>
              </select>
            </div>
          </div>
          {locationType === 'custom' && (
            <div className="form-row-2">
              <div>
                <label>Custom Type (Max 80 Chars) *</label>
                <input
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  maxLength={80}
                  required
                />
              </div>
              <div />
            </div>
          )}
          <div className="form-row-2">
            <div>
              <label>Branch Name *</label>
              <input value={branchName} onChange={(e) => setBranchName(e.target.value)} required />
            </div>
            <div>
              <label>Location Name *</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
          </div>
        </div>

        <div className="connection-panel" style={{ margin: 0 }}>
          <h2>Address & Contact</h2>
          <div className="form-row-2">
            <div>
              <label>Address Line *</label>
              <input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} required />
            </div>
            <div>
              <label>Manager *</label>
              <input value={manager} onChange={(e) => setManager(e.target.value)} required />
            </div>
          </div>
          <div className="form-row-2">
            <div>
              <label>State / Province *</label>
              <select
                value={stateProvince}
                onChange={(e) => onStateChange(e.target.value)}
                required
                disabled={!country}
              >
                <option value="">Select…</option>
                {stateOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>City *</label>
              <select
                value={city}
                onChange={(e) => onCityChange(e.target.value)}
                required
                disabled={!stateProvince}
              >
                <option value="">Select…</option>
                {cityOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row-2">
            <div>
              <label>Country *</label>
              <select value={country} onChange={(e) => onCountryChange(e.target.value)} required>
                <option value="">Select…</option>
                {countryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Area *</label>
              <select value={area} onChange={(e) => setArea(e.target.value)} required disabled={!city}>
                <option value="">Select…</option>
                {areaOptions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="form-row-2">
            <div>
              <label>Phone *</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </div>
            <div>
              <span />
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
        </div>

        <div className="connection-panel" style={{ margin: 0 }}>
          <h2>Operations & Facilities</h2>
          <div className="form-row-2">
            <label className="ui-switch">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <span className="ui-switch-track" />
              <span className="ui-switch-text">Active Location</span>
            </label>
            <div>
              <label>Timezone *</label>
              <input value={timezone} onChange={(e) => setTimezone(e.target.value)} required />
            </div>
          </div>
          <div className="form-row-2">
            <div>
              <label>Currency *</label>
              <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} required />
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
          </div>
          <div>
            <label>Facility types at this location</label>
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
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              <input
                value={customFacilityType}
                onChange={(e) => setCustomFacilityType(e.target.value)}
                placeholder="Custom facility code (e.g. xbox, snooker-table)"
              />
              <button type="button" className="btn-ghost" onClick={addCustomFacilityType}>
                Add custom
              </button>
            </div>
            {facilityTypes.length > 0 && (
              <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {facilityTypes.map((code) => (
                  <button
                    key={code}
                    type="button"
                    className="btn-ghost"
                    style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                    onClick={() => setFacilityTypes((prev) => prev.filter((x) => x !== code))}
                  >
                    {code} ×
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <button
          type="submit"
          className="btn-primary"
          disabled={
            busy ||
            !businessId ||
            !branchName.trim() ||
            !name.trim() ||
            !country.trim() ||
            !stateProvince.trim() ||
            !city.trim() ||
            !area.trim() ||
            !addressLine.trim() ||
            !phone.trim() ||
            !manager.trim() ||
            !timezone.trim() ||
            !currency.trim() ||
            (locationType === 'custom' && !customType.trim())
          }
        >
          {busy ? 'Creating…' : 'Create location'}
        </button>
      </form>
    </div>
  );
}
