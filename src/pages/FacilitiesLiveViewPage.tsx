import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createBooking,
  createIamUser,
  getBookingAvailability,
  getBusinessDashboardView,
  listIamUsers,
  listBookingsForTenant,
  listBusinessLocations,
  listCricketCourts,
  listFutsalCourts,
  listPadelCourts,
} from '../api/saasClient';
import type { BookingRecord } from '../types/booking';
import type { BusinessDashboardView, BusinessLocationRow, NamedCourt } from '../types/domain';
import { formatTime12h } from '../utils/timeDisplay';
import {
  computeFacilityLiveSnapshot,
  facilityTypeToCourtKind,
  type FacilityLiveType,
} from '../utils/facilityLiveStats';

type FacilityCardRow = {
  id: string;
  name: string;
  type: FacilityLiveType;
  locationId?: string | null;
  facilityStatus?: string;
  facilityIsActive?: boolean;
};

type QuickBookingState = {
  facility: FacilityCardRow;
  location: BusinessLocationRow | null;
  date: string;
  startTime: string;
  durationMins: number;
  phone: string;
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function localDateYmd(d = new Date()): string {
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  return `${y}-${m}-${day}`;
}

function nextHalfHourTime(now = new Date()): string {
  const d = new Date(now);
  d.setSeconds(0, 0);
  const mins = d.getMinutes();
  if (mins <= 30) d.setMinutes(30, 0, 0);
  else d.setHours(d.getHours() + 1, 0, 0, 0);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map((x) => Number(x || 0));
  return h * 60 + m;
}

function minutesToTime(v: number): string {
  const hh = Math.floor(v / 60) % 24;
  const mm = v % 60;
  return `${pad2(hh)}:${pad2(mm)}`;
}

function endTimeFrom(startTime: string, durationMins: number): string {
  const end = Math.min(timeToMinutes(startTime) + durationMins, 23 * 60 + 30);
  return minutesToTime(end);
}

function digitsOnly(v: string): string {
  return v.replace(/\D/g, '');
}

function normalizePhone(value: string): string {
  const digits = digitsOnly(value);
  if (!digits) return '+92';
  if (digits.startsWith('92')) return `+${digits}`;
  if (digits.startsWith('0')) return `+92${digits.slice(1)}`;
  return `+92${digits}`;
}

function tenantForLocation(
  loc: BusinessLocationRow | undefined,
  dashboard: BusinessDashboardView | null,
): string | null {
  if (!loc) return null;
  const fromLoc = loc.business?.tenantId?.trim();
  if (fromLoc) return fromLoc;
  const row = dashboard?.businesses.find((b) => b.businessId === loc.businessId);
  const tid = row?.tenantId?.trim();
  return tid || null;
}

function sportClassFromFacilityType(type: FacilityCardRow['type']): string {
  if (type === 'futsalCourt') return 'facilities-live-box--sport-futsal';
  if (type === 'cricketCourt') return 'facilities-live-box--sport-cricket';
  return 'facilities-live-box--sport-padel';
}

export default function FacilitiesLiveViewPage() {
  const [dashboard, setDashboard] = useState<BusinessDashboardView | null>(null);
  const [locations, setLocations] = useState<BusinessLocationRow[]>([]);
  const [facilities, setFacilities] = useState<FacilityCardRow[]>([]);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quickBooking, setQuickBooking] = useState<QuickBookingState | null>(null);
  const [quickPrice, setQuickPrice] = useState<number | null>(null);
  const [quickPriceLoading, setQuickPriceLoading] = useState(false);
  const [quickBookingSubmitting, setQuickBookingSubmitting] = useState(false);
  const [quickBookingError, setQuickBookingError] = useState<string | null>(null);
  /** Recompute on-screen “now” without waiting for the next API poll */
  const [clock, setClock] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setClock((c) => c + 1), 15000);
    return () => window.clearInterval(id);
  }, []);

  const buildFacilityCards = useCallback(
    (
      futsalCourtRows: NamedCourt[],
      cricketCourtRows: NamedCourt[],
      padelRows: NamedCourt[],
    ): FacilityCardRow[] => {
      return [
        ...futsalCourtRows.map((r) => ({
          id: r.id,
          name: r.name,
          type: 'futsalCourt' as const,
          locationId: r.businessLocationId,
          facilityStatus: r.courtStatus,
          facilityIsActive: r.isActive,
        })),
        ...cricketCourtRows.map((r) => ({
          id: r.id,
          name: r.name,
          type: 'cricketCourt' as const,
          locationId: r.businessLocationId,
          facilityStatus: r.courtStatus,
          facilityIsActive: r.isActive,
        })),
        ...padelRows.map((r) => ({
          id: r.id,
          name: r.name,
          type: 'padel' as const,
          locationId: r.businessLocationId,
          facilityStatus: r.courtStatus,
          facilityIsActive: r.isActive,
        })),
      ];
    },
    [],
  );

  const load = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);
      try {
        const [dash, locs, fcRows, ccRows, padelRows] = await Promise.all([
          getBusinessDashboardView(),
          listBusinessLocations(),
          listFutsalCourts(),
          listCricketCourts(),
          listPadelCourts(),
        ]);
        setDashboard(dash);
        setLocations(locs);
        const facilityRows = buildFacilityCards(fcRows, ccRows, padelRows);
        setFacilities(facilityRows);

        const tenantSet = new Set<string>();
        const locById = new Map(locs.map((l) => [l.id, l]));
        for (const f of facilityRows) {
          const loc = f.locationId ? locById.get(f.locationId) : undefined;
          const tid = tenantForLocation(loc, dash);
          if (tid) tenantSet.add(tid);
        }
        const tenantList = [...tenantSet];
        const bookingLists = await Promise.all(
          tenantList.map((tid) =>
            listBookingsForTenant(tid).catch(() => [] as BookingRecord[]),
          ),
        );
        setBookings(bookingLists.flat());
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load facilities live view');
      } finally {
        if (isRefresh) setRefreshing(false);
        else setLoading(false);
      }
    },
    [buildFacilityCards],
  );

  useEffect(() => {
    void load(false);
    const id = window.setInterval(() => {
      void load(true);
    }, 30000);
    return () => window.clearInterval(id);
  }, [load]);

  const businessById = useMemo(() => {
    const map = new Map<string, BusinessDashboardView['businesses'][number]>();
    for (const b of dashboard?.businesses ?? []) map.set(b.businessId, b);
    return map;
  }, [dashboard]);

  const filteredFacilities = useMemo(() => {
    const q = query.trim().toLowerCase();
    const locationById = new Map(locations.map((loc) => [loc.id, loc]));
    if (!q) return facilities;
    return facilities.filter((facility) => {
      const loc = facility.locationId ? locationById.get(facility.locationId) : undefined;
      const biz = loc ? businessById.get(loc.businessId) : undefined;
      return (
        facility.name.toLowerCase().includes(q) ||
        facility.type.toLowerCase().includes(q) ||
        (loc?.name ?? '').toLowerCase().includes(q) ||
        (loc?.city ?? '').toLowerCase().includes(q) ||
        (loc?.locationType ?? '').toLowerCase().includes(q) ||
        (biz?.businessName ?? '').toLowerCase().includes(q)
      );
    });
  }, [businessById, facilities, locations, query]);

  const facilitySnapshots = useMemo(() => {
    const map = new Map<string, ReturnType<typeof computeFacilityLiveSnapshot>>();
    const now = new Date();
    for (const facility of filteredFacilities) {
      const kind = facilityTypeToCourtKind(facility.type);
      const cardId = `${facility.type}-${facility.id}`;
      const isActive = facility.facilityIsActive !== false;
      map.set(
        cardId,
        computeFacilityLiveSnapshot(bookings, kind, facility.id, {
          now,
          facilityActive: isActive,
          facilityStatus: facility.facilityStatus,
        }),
      );
    }
    return map;
  }, [bookings, clock, filteredFacilities]);

  const typeLabel = (t: FacilityCardRow['type']) =>
    t === 'futsalCourt' ? 'Futsal' : t === 'cricketCourt' ? 'Cricket' : 'Padel';

  const loadQuickPrice = useCallback(async (state: QuickBookingState) => {
    const sportType =
      state.facility.type === 'futsalCourt'
        ? 'futsal'
        : state.facility.type === 'cricketCourt'
          ? 'cricket'
          : 'padel';
    const startTime = state.startTime;
    const endTime = endTimeFrom(startTime, state.durationMins);
    setQuickPriceLoading(true);
    try {
      const avail = await getBookingAvailability({
        date: state.date,
        startTime,
        endTime,
        sportType,
      });
      const courtKind = facilityTypeToCourtKind(state.facility.type);
      const row = avail.availableCourts.find(
        (c) => c.kind === courtKind && c.id === state.facility.id,
      );
      if (!row || row.pricePerSlot == null) {
        setQuickPrice(null);
        return;
      }
      const slotDuration = row.slotDurationMinutes && row.slotDurationMinutes > 0 ? row.slotDurationMinutes : 60;
      const computed = row.pricePerSlot * (state.durationMins / slotDuration);
      setQuickPrice(Number.isFinite(computed) ? Math.max(0, Math.round(computed)) : null);
    } catch {
      setQuickPrice(null);
    } finally {
      setQuickPriceLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!quickBooking) return;
    void loadQuickPrice(quickBooking);
  }, [quickBooking, loadQuickPrice]);

  useEffect(() => {
    if (!quickBooking) return;
    const maxStart = 23 * 60 + 30 - quickBooking.durationMins;
    if (timeToMinutes(quickBooking.startTime) <= maxStart) return;
    setQuickBooking((cur) =>
      cur ? { ...cur, startTime: minutesToTime(Math.max(0, maxStart)) } : cur,
    );
  }, [quickBooking]);

  async function submitQuickBooking(): Promise<void> {
    if (!quickBooking) return;
    const location = quickBooking.location;
    if (!location) {
      setQuickBookingError('Location is required for booking.');
      return;
    }
    const phone = normalizePhone(quickBooking.phone);
    const digits = digitsOnly(phone);
    if (!digits) {
      setQuickBookingError('Phone number is required.');
      return;
    }
    const startTime = quickBooking.startTime;
    const endTime = endTimeFrom(startTime, quickBooking.durationMins);
    if (quickPrice == null) {
      setQuickBookingError('Price is unavailable for this slot. Try another time.');
      return;
    }
    const sportType =
      quickBooking.facility.type === 'futsalCourt'
        ? 'futsal'
        : quickBooking.facility.type === 'cricketCourt'
          ? 'cricket'
          : 'padel';
    const courtKind = facilityTypeToCourtKind(quickBooking.facility.type);

    setQuickBookingError(null);
    setQuickBookingSubmitting(true);
    try {
      const users = await listIamUsers();
      const existing =
        users.find((u) => {
          const p = digitsOnly(u.phone ?? '');
          return p && (p === digits || p.endsWith(digits) || digits.endsWith(p));
        }) ?? null;
      let userId = existing?.id ?? '';
      if (!userId) {
        const created = await createIamUser({
          fullName: `Guest ${digits.slice(-4) || 'User'}`,
          email: `quick-${digits}-${Date.now()}@bukit.local`,
          phone,
          password: `Quick!${Math.random().toString(36).slice(2, 8)}9`,
        });
        userId = created.id;
      }

      await createBooking({
        userId,
        sportType,
        bookingDate: quickBooking.date,
        items: [
          {
            courtKind,
            courtId: quickBooking.facility.id,
            startTime,
            endTime,
            price: quickPrice,
            currency: location.currency ?? 'PKR',
            status: 'reserved',
          },
        ],
        pricing: {
          subTotal: quickPrice,
          discount: 0,
          tax: 0,
          totalAmount: quickPrice,
        },
        payment: {
          paymentStatus: 'pending',
          paymentMethod: 'cash',
        },
        bookingStatus: 'pending',
      });

      setQuickBooking(null);
      await load(true);
    } catch (e) {
      setQuickBookingError(e instanceof Error ? e.message : 'Failed to create quick booking.');
    } finally {
      setQuickBookingSubmitting(false);
    }
  }

  return (
    <div className="owner-live-view">
      <div className="owner-live-head">
        <div>
          <h1 className="page-title" style={{ marginBottom: '0.35rem' }}>
            Facilities live
          </h1>
          <p className="muted" style={{ margin: 0 }}>
            Box view per facility: current session, next slot, and booked hours. Refreshes every
            30s.
          </p>
        </div>
        <div className="owner-live-actions">
          <button
            type="button"
            className="btn-ghost btn-compact"
            onClick={() => void load(true)}
            disabled={loading || refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh now'}
          </button>
          <Link to="/app/Facilites" className="btn-primary btn-compact">
            Manage facilities
          </Link>
        </div>
      </div>

      {error && <div className="err-banner">{error}</div>}
      <div className="connection-panel owner-live-filter-panel">
        <label>
          <span className="muted">Search facility / location</span>
          <input
            className="input"
            placeholder="Name, city, business, or type"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        {dashboard && (
          <p className="muted owner-live-timestamp" style={{ marginTop: '0.2rem' }}>
            Last updated: {new Date(dashboard.generatedAt).toLocaleString()}
          </p>
        )}
      </div>

      {loading ? (
        <div className="empty-state">Loading facilities…</div>
      ) : (
        <div className="facilities-live-grid">
          {filteredFacilities.map((facility) => {
            const location = facility.locationId
              ? locations.find((loc) => loc.id === facility.locationId)
              : undefined;
            const business = location ? businessById.get(location.businessId) : undefined;
            const cardId = `${facility.type}-${facility.id}`;
            const snap = facilitySnapshots.get(cardId);
            const v = snap?.visualState ?? 'idle';
            const boxClass =
              v === 'live'
                ? 'facilities-live-box facilities-live-box--live'
                : v === 'soon'
                  ? 'facilities-live-box facilities-live-box--soon'
                  : v === 'inactive'
                    ? 'facilities-live-box facilities-live-box--inactive'
                    : 'facilities-live-box facilities-live-box--idle';
            const sportClass = sportClassFromFacilityType(facility.type);

            return (
              <article
                key={cardId}
                className={`${boxClass} ${sportClass}`}
                role="button"
                tabIndex={0}
                style={{ cursor: 'pointer' }}
                onClick={() =>
                  {
                    const defaultDuration = 60;
                    const nowStart = nextHalfHourTime();
                    const maxStart = 23 * 60 + 30 - defaultDuration;
                    const safeStart = timeToMinutes(nowStart) <= maxStart ? nowStart : minutesToTime(maxStart);
                    setQuickBooking({
                      facility,
                      location: location ?? null,
                      date: localDateYmd(),
                      startTime: safeStart,
                      durationMins: defaultDuration,
                      phone: '+92',
                    });
                  }
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const defaultDuration = 60;
                    const nowStart = nextHalfHourTime();
                    const maxStart = 23 * 60 + 30 - defaultDuration;
                    const safeStart = timeToMinutes(nowStart) <= maxStart ? nowStart : minutesToTime(maxStart);
                    setQuickBooking({
                      facility,
                      location: location ?? null,
                      date: localDateYmd(),
                      startTime: safeStart,
                      durationMins: defaultDuration,
                      phone: '+92',
                    });
                  }
                }}
              >
                <div className="facilities-live-box__top">
                  <div>
                    <h2 className="facilities-live-box__title">{facility.name}</h2>
                    <p className="facilities-live-box__subtitle">
                      {typeLabel(facility.type)}
                      {location?.name ? ` · ${location.name}` : ''}
                    </p>
                  </div>
                  {v === 'live' && (
                    <span className="facilities-live-box__pill facilities-live-box__pill--live">
                      Live
                    </span>
                  )}
                  {v === 'soon' && !snap?.ongoing && (
                    <span className="facilities-live-box__pill facilities-live-box__pill--soon">
                      Next soon
                    </span>
                  )}
                </div>

                <p className="facilities-live-box__biz muted">
                  {business?.businessName ?? '—'}
                  {location?.city ? ` · ${location.city}` : ''}
                </p>

                <div className="facilities-live-box__stats">
                  <div className="facilities-live-box__stat">
                    <span className="facilities-live-box__stat-label">Now</span>
                    <span className="facilities-live-box__stat-value">
                      {snap?.ongoing ? (
                        <>
                          <span className="facilities-live-box__emph">{snap.ongoing.label}</span>
                          <span className="muted facilities-live-box__stat-meta">
                            {' '}
                            · {snap.ongoing.booking.bookingStatus}
                          </span>
                        </>
                      ) : v === 'inactive' ? (
                        <span className="muted">Unavailable</span>
                      ) : (
                        <span className="muted">Available</span>
                      )}
                    </span>
                  </div>
                  <div className="facilities-live-box__stat">
                    <span className="facilities-live-box__stat-label">Next</span>
                    <span className="facilities-live-box__stat-value">
                      {snap?.next ? (
                        <span>{snap.next.label}</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </span>
                  </div>
                  <div className="facilities-live-box__stat">
                    <span className="facilities-live-box__stat-label">Booked today</span>
                    <span className="facilities-live-box__stat-value">
                      {snap ? `${snap.hoursBookedToday} h` : '—'}
                    </span>
                  </div>
                  <div className="facilities-live-box__stat">
                    <span className="facilities-live-box__stat-label">Last 7 days</span>
                    <span className="facilities-live-box__stat-value">
                      {snap ? `${snap.hoursBookedWeek} h` : '—'}
                    </span>
                  </div>
                </div>
              </article>
            );
          })}
          {filteredFacilities.length === 0 && (
            <div className="empty-state">No facilities match your search.</div>
          )}
        </div>
      )}
      {quickBooking ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 18, 28, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 80,
            padding: '1rem',
          }}
          role="presentation"
          onClick={() => {
            if (!quickBookingSubmitting) setQuickBooking(null);
          }}
        >
          <div
            className="connection-panel"
            style={{ maxWidth: '560px', width: '100%' }}
            role="dialog"
            aria-labelledby="quick-booking-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="quick-booking-title" style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>
              Quick booking
            </h2>
            <div className="form-grid">
              {quickBookingError && <div className="err-banner">{quickBookingError}</div>}
              <div className="detail-row">
                <span>Location</span>
                <span>{quickBooking.location?.name ?? '—'}</span>
              </div>
              <div className="detail-row">
                <span>Facility</span>
                <span>{quickBooking.facility.name}</span>
              </div>
              <div className="form-row-2">
                <div>
                  <label>Date</label>
                  <input
                    value={quickBooking.date}
                    readOnly
                  />
                </div>
                <div>
                  <label>Start time</label>
                  <select
                    value={quickBooking.startTime}
                    onChange={(e) =>
                      setQuickBooking((cur) => (cur ? { ...cur, startTime: e.target.value } : cur))
                    }
                    disabled={quickBookingSubmitting}
                  >
                    {Array.from({ length: 48 }).map((_, i) => {
                      const mins = i * 30;
                      const maxStart = 23 * 60 + 30 - quickBooking.durationMins;
                      if (mins > maxStart) return null;
                      const value = minutesToTime(mins);
                      return (
                        <option key={value} value={value}>
                          {formatTime12h(value)}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>
              <div className="form-row-2">
                <div>
                  <label>Duration</label>
                  <div
                    style={{
                      display: 'flex',
                      gap: '0.4rem',
                      flexWrap: 'wrap',
                      marginTop: '0.35rem',
                    }}
                  >
                    {[30, 60, 90, 120, 150, 180].map((m) => {
                      const active = quickBooking.durationMins === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          className={active ? 'btn-primary' : 'btn-ghost'}
                          style={{
                            padding: '0.35rem 0.7rem',
                            borderRadius: '999px',
                            fontSize: '0.86rem',
                          }}
                          disabled={quickBookingSubmitting}
                          onClick={() =>
                            setQuickBooking((cur) =>
                              cur ? { ...cur, durationMins: m } : cur,
                            )
                          }
                        >
                          {m} min
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <label>End time</label>
                  <input value={formatTime12h(endTimeFrom(quickBooking.startTime, quickBooking.durationMins))} readOnly />
                </div>
              </div>
              <div className="detail-row">
                <span>Price (backend)</span>
                <span>
                  {quickPriceLoading
                    ? 'Loading...'
                    : quickPrice == null
                      ? 'Unavailable'
                      : `PKR ${quickPrice}`}
                </span>
              </div>
              <div>
                <label>Number</label>
                <input
                  value={quickBooking.phone}
                  onChange={(e) =>
                    setQuickBooking((cur) =>
                      cur ? { ...cur, phone: normalizePhone(e.target.value) } : cur,
                    )
                  }
                  placeholder="+92..."
                  disabled={quickBookingSubmitting}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button
                type="button"
                className="btn-ghost btn-compact"
                onClick={() => setQuickBooking(null)}
                disabled={quickBookingSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary btn-compact"
                onClick={() => void submitQuickBooking()}
                disabled={quickBookingSubmitting || quickPriceLoading || quickPrice == null}
              >
                {quickBookingSubmitting ? 'Booking...' : 'Confirm booking'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
