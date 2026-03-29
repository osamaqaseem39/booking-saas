import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createBusinessLocation,
  listBusinessLocations,
  listBusinesses,
} from '../api/saasClient';
import { LOCATION_FACILITY_TYPE_OPTIONS } from '../constants/locationFacilityTypes';
import { LOCATION_TYPE_OPTIONS } from '../constants/locationTypes';
import { useSession } from '../context/SessionContext';
import type { BusinessLocationRow, BusinessRow } from '../types/domain';

export default function LocationsPage() {
  const { session } = useSession();
  const isOwner = session?.roles?.includes('platform-owner');
  const [rows, setRows] = useState<BusinessLocationRow[]>([]);
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [businessId, setBusinessId] = useState('');
  const [locationType, setLocationType] = useState('arena');
  const [customType, setCustomType] = useState('');
  const [name, setName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [facilityTypes, setFacilityTypes] = useState<string[]>([]);

  const load = () => {
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const [locs, biz] = await Promise.all([
          listBusinessLocations(),
          listBusinesses(),
        ]);
        setRows(locs);
        setBusinesses(biz);
        if (!businessId && biz.length > 0) {
          setBusinessId(biz[0]!.id);
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <h1 className="page-title">Locations</h1>
      <p className="muted">
        {isOwner
          ? 'As platform owner you see every venue/branch linked to any business.'
          : 'You see locations only for businesses you belong to.'}{' '}
        Each row has a <strong>location type</strong> (arena, branch, etc.)
        and <strong>facility types</strong> (which court kinds the site offers).
        Facility types are stored on the location, not in a separate catalog.
      </p>
      {err && <div className="err-banner">{err}</div>}

      <h3 style={{ fontSize: '1rem', marginTop: '1.25rem' }}>Add location</h3>
      <div className="form-grid" style={{ maxWidth: '560px' }}>
        <div>
          <label>Business</label>
          <select
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
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
          <label>Location type</label>
          <select
            value={locationType}
            onChange={(e) => setLocationType(e.target.value)}
          >
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
              placeholder="e.g. pop_up_venue"
            />
          </div>
        )}
        <div>
          <label>Location name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label>Address (optional)</label>
          <input
            value={addressLine}
            onChange={(e) => setAddressLine(e.target.value)}
          />
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
        <div style={{ gridColumn: '1 / -1' }}>
          <label>Facility types at this location</label>
          <div
            className="muted"
            style={{ fontSize: '0.85rem', marginBottom: '0.35rem' }}
          >
            Select all that apply (optional).
          </div>
          <div className="checkbox-grid">
            {LOCATION_FACILITY_TYPE_OPTIONS.map((o) => (
              <label
                key={o.value}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={facilityTypes.includes(o.value)}
                  onChange={() => {
                    setFacilityTypes((prev) =>
                      prev.includes(o.value)
                        ? prev.filter((x) => x !== o.value)
                        : [...prev, o.value],
                    );
                  }}
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
            !businessId ||
            !name.trim() ||
            (locationType === 'custom' && !customType.trim())
          }
          onClick={() => {
            void (async () => {
              try {
                const lt =
                  locationType === 'custom'
                    ? customType.trim().slice(0, 80)
                    : locationType;
                await createBusinessLocation({
                  businessId,
                  locationType: lt,
                  facilityTypes: facilityTypes.length ? facilityTypes : undefined,
                  name: name.trim(),
                  addressLine: addressLine.trim() || undefined,
                  city: city.trim() || undefined,
                  phone: phone.trim() || undefined,
                });
                setName('');
                setAddressLine('');
                setCity('');
                setPhone('');
                setFacilityTypes([]);
                load();
              } catch (e) {
                setErr(e instanceof Error ? e.message : 'Create failed');
              }
            })();
          }}
        >
          Add location
        </button>
      </div>

      <h3 style={{ fontSize: '1rem', marginTop: '1.75rem' }}>All locations</h3>
      <div className="table-wrap">
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            No locations yet. Add one above (run DB migration if the table is
            missing).
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>Business</th>
                <th>Tenant</th>
                <th>Type</th>
                <th>Facility types</th>
                <th>Location</th>
                <th>City</th>
                <th>Phone</th>
                <th>Facilities</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.business?.businessName ?? r.businessId}</td>
                  <td>
                    <code style={{ fontSize: '0.7rem' }}>
                      {r.business?.tenantId?.slice(0, 8) ?? '—'}…
                    </code>
                  </td>
                  <td>
                    <code style={{ fontSize: '0.75rem' }}>
                      {r.locationType ?? '—'}
                    </code>
                  </td>
                  <td>
                    {r.facilityTypes?.length ? (
                      <code style={{ fontSize: '0.7rem' }}>
                        {r.facilityTypes.join(', ')}
                      </code>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{r.name}</td>
                  <td>{r.city ?? '—'}</td>
                  <td>{r.phone ?? '—'}</td>
                  <td>
                    <Link to={`/app/locations/${r.id}/facilities`}>
                      Manage
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
