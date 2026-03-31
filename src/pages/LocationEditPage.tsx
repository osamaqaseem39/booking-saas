import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  deleteBusinessLocation,
  listBusinessLocations,
  updateBusinessLocation,
} from '../api/saasClient';
import { LOCATION_FACILITY_TYPE_OPTIONS } from '../constants/locationFacilityTypes';
import WorkingHoursEditor, {
  createDefaultWorkingHoursPayload,
  validateWorkingHoursPayload,
} from '../components/WorkingHoursEditor';
import {
  getAreasByCountryStateCity,
  getCitiesByCountryState,
  getStatesByCountry,
  inferStateFromCity,
  LOCATION_HIERARCHY,
} from '../constants/locationHierarchy';
import ImageGallery from '../components/ImageGallery';
import ImageUpload from '../components/ImageUpload';
import { LOCATION_TYPE_OPTIONS } from '../constants/locationTypes';
import type { BusinessLocationRow } from '../types/domain';

export default function LocationEditPage() {
  const { locationId = '' } = useParams<{ locationId: string }>();
  const navigate = useNavigate();
  const [rows, setRows] = useState<BusinessLocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
  const [workingHours, setWorkingHours] = useState<Record<string, unknown>>(
    createDefaultWorkingHoursPayload(),
  );
  const [isActive, setIsActive] = useState(true);
  const [logoUrl, setLogoUrl] = useState('');
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [facilityTypes, setFacilityTypes] = useState<string[]>([]);
  const facilityOptions = LOCATION_FACILITY_TYPE_OPTIONS;
  const countryOptions = Object.keys(LOCATION_HIERARCHY);
  const stateOptions = getStatesByCountry(country);
  const cityOptions = getCitiesByCountryState(country, stateProvince);
  const areaOptions = getAreasByCountryStateCity(country, stateProvince, city);
  const isArenaType = locationType === 'arena';

  const location = useMemo(
    () => rows.find((r) => r.id === locationId) ?? null,
    [rows, locationId],
  );

  useEffect(() => {
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const locs = await listBusinessLocations();
        setRows(locs);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load location');
      } finally {
        setLoading(false);
      }
    })();
  }, [locationId]);

  useEffect(() => {
    if (!location) return;
    setBranchName(location.name ?? '');
    setName(location.name);
    setAddressLine(location.addressLine ?? '');
    setCity(location.city ?? '');
    setArea(location.area ?? '');
    setCountry(location.country ?? 'Pakistan');
    setStateProvince(inferStateFromCity(location.country ?? 'Pakistan', location.city ?? '', location.area ?? ''));
    setLatitude(location.latitude !== null && location.latitude !== undefined ? String(location.latitude) : '');
    setLongitude(location.longitude !== null && location.longitude !== undefined ? String(location.longitude) : '');
    setPhone(location.phone ?? '');
    setManager(location.manager ?? '');
    setTimezone(location.timezone ?? 'Asia/Karachi');
    setCurrency(location.currency ?? 'PKR');
    setWorkingHours((location.workingHours as Record<string, unknown> | null) ?? {});
    setIsActive((location.status ?? '').toLowerCase() === 'active');
    setLogoUrl(location.logo ?? '');
    setGalleryUrls(location.gallery ?? []);
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

  function validateForm(): string | null {
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
    const workingHoursError = validateWorkingHoursPayload(workingHours);
    if (workingHoursError) {
      return workingHoursError;
    }
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
      const lat = Number(latitude);
      const lng = Number(longitude);
      await updateBusinessLocation(locationId, {
        branchName: branchName.trim(),
        locationType: lt,
        facilityTypes,
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
        logo: logoUrl.trim(),
        gallery: galleryUrls.map((u) => u.trim()).filter(Boolean),
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

  function onLocationTypeChange(nextType: string) {
    setLocationType(nextType);
    if (nextType !== 'arena') {
      setFacilityTypes([]);
    }
  }

  function toggleFacilityType(code: string, enabled: boolean) {
    setFacilityTypes((prev) =>
      enabled ? (prev.includes(code) ? prev : [...prev, code]) : prev.filter((x) => x !== code),
    );
  }

  if (!locationId.trim()) return <p className="muted">Missing location id.</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
        <h1 className="page-title">Edit location</h1>
        <Link to="/app/locations" className="btn-ghost btn-compact">
          Back to list
        </Link>
      </div>
      {err && <div className="err-banner">{err}</div>}
      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : !location ? (
        <div className="empty-state">Location not found.</div>
      ) : (
        <>
          <p className="muted" style={{ maxWidth: '920px', margin: '0 auto' }}>
            Update location profile, address, media, hours, and facility types — same layout as{' '}
            <strong>Add location</strong>.
          </p>
          <form
            className="form-grid form-page-locations"
            style={{ maxWidth: '920px', margin: '1rem auto 0' }}
            onSubmit={(e) => {
              e.preventDefault();
              void onSave();
            }}
          >
            <div className="connection-panel" style={{ margin: 0 }}>
              <h2>Location Info</h2>
              <div className="form-row-2">
                <div>
                  <label>Branch name *</label>
                  <input
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label>Location type *</label>
                  <select
                    value={locationType}
                    onChange={(e) => onLocationTypeChange(e.target.value)}
                  >
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
                    <label>Custom type (max 80 chars) *</label>
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
              <div>
                <label>Location name *</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            </div>

            <div className="connection-panel" style={{ margin: 0 }}>
              <h2>Address &amp; Contact</h2>
              <div className="form-row-2">
                <div>
                  <label>Address line *</label>
                  <input
                    value={addressLine}
                    onChange={(e) => setAddressLine(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label>Manager *</label>
                  <input value={manager} onChange={(e) => setManager(e.target.value)} required />
                </div>
              </div>
              <div className="form-row-2">
                <div>
                  <label>State / province *</label>
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
                  <select
                    value={country}
                    onChange={(e) => onCountryChange(e.target.value)}
                    required
                  >
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
                  <select
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    required
                    disabled={!city}
                  >
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
              <h2>Media</h2>
              <div className="form-row-2">
                <div>
                  <ImageUpload label="Logo" value={logoUrl} onChange={setLogoUrl} />
                  <p className="muted" style={{ margin: '0.35rem 0 0', fontSize: '0.82rem' }}>
                    Main image for this location. Leave empty to clear.
                  </p>
                </div>
                <div />
              </div>
              <ImageGallery label="Location image gallery" value={galleryUrls} onChange={setGalleryUrls} />
            </div>

            <div className="connection-panel" style={{ margin: 0 }}>
              <h2>Operations &amp; Facilities</h2>
              <div className="form-row-2">
                <label className="ui-switch">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <span className="ui-switch-track" />
                  <span className="ui-switch-text">Active location</span>
                </label>
                <div>
                  <label>Timezone *</label>
                  <input value={timezone} onChange={(e) => setTimezone(e.target.value)} required />
                </div>
              </div>
              <div className="form-row-2">
                <div>
                  <label>Currency *</label>
                  <input
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                    required
                  />
                </div>
                <div>
                  <WorkingHoursEditor value={workingHours} onChange={setWorkingHours} />
                </div>
              </div>
              <div>
                <label>Facility types at this location</label>
                {!isArenaType && (
                  <p className="muted" style={{ margin: '0.4rem 0 0.65rem' }}>
                    Facility court switches apply to <strong>Arena</strong> type only.
                  </p>
                )}
                <div className="checkbox-grid">
                  {facilityOptions.map((o) => (
                    <label key={o.value} className="ui-switch">
                      <input
                        type="checkbox"
                        checked={facilityTypes.includes(o.value)}
                        onChange={(e) => toggleFacilityType(o.value, e.target.checked)}
                        disabled={!isArenaType}
                      />
                      <span className="ui-switch-track" />
                      <span className="ui-switch-text">{o.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={
                  busy ||
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
                {busy ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                className="btn-danger"
                disabled={deleting}
                onClick={() => void onDelete()}
              >
                {deleting ? 'Deleting…' : 'Delete location'}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
