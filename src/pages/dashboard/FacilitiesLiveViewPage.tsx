import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import {
  assignRole,
  createBooking,
  createIamUser,
  getBookingAvailability,
  getCourtSlotGrid,
  getBusinessDashboardView,
  listIamUsers,
  listBookingsForTenant,
  listBusinessLocations,
  listCricketCourts,
  listFutsalCourts,
  listPadelCourts,
} from '../../api/saasClient';
import type { BookingRecord, PaymentStatus } from '../../types/booking';
import type { BusinessDashboardView, BusinessLocationRow, NamedCourt } from '../../types/domain';
import { formatTime12h } from '../../utils/timeDisplay';
import {
  computeFacilityLiveSnapshot,
  facilityTypeToCourtKind,
  type FacilityLiveType,
} from '../../utils/facilityLiveStats';
import type { DashboardOutletContext } from '../../layout/ConsoleLayout';

type FacilityCardRow = {
  id: string;
  name: string;
  type: FacilityLiveType;
  locationId?: string | null;
  timeSlotTemplateId?: string | null;
  facilityStatus?: string;
  facilityIsActive?: boolean;
  pricePerSlot?: string | number | null;
  pricing?: any | null;
  linkedTwinCourtId?: string | null;
};

type QuickBookingState = {
  facility: FacilityCardRow;
  location: BusinessLocationRow | null;
  date: string;
  startTime: string;
  endTime: string;
  phone: string;
  name: string;
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

function nextHourTime(now = new Date()): string {
  const d = new Date(now);
  d.setSeconds(0, 0);
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function timeToMinutes(t: string, isEnd = false): number {
  const [h, m] = t.split(':').map((x) => Number(x || 0));
  const total = h * 60 + m;
  if (total === 0 && isEnd) return 24 * 60;
  return total;
}

function minutesToTime(v: number): string {
  const hh = Math.floor(v / 60) % 24;
  const mm = v % 60;
  return `${pad2(hh)}:${pad2(mm)}`;
}

function endTimeFrom(startTime: string): string {
  const end = Math.min(timeToMinutes(startTime) + 60, 24 * 60);
  return minutesToTime(end);
}

function getSlotStepMinutes(
  slots: Array<{ startTime: string; endTime: string }>,
): number {
  if (!slots.length) return 60;
  const mins = slots
    .map((s) => timeToMinutes(s.startTime))
    .sort((a, b) => a - b);
  const diffs: number[] = [];
  for (let i = 1; i < mins.length; i += 1) {
    const diff = mins[i] - mins[i - 1];
    if (diff > 0) diffs.push(diff);
  }
  return diffs.length ? Math.min(...diffs) : 60;
}

function getSelectedRangeMinutes(startTime: string, endTime: string): {
  start: number;
  end: number;
} {
  const start = timeToMinutes(startTime, false);
  let end = timeToMinutes(endTime, false);
  if (end <= start) end += 24 * 60;
  return { start, end };
}

const BOOKING_TIMING_LOG = '[BookingTiming][Quick]';

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
  if (type === 'sharedTurfCourt') return 'facilities-live-box--sport-shared-turf';
  return 'facilities-live-box--sport-padel';
}

export default function FacilitiesLiveViewPage() {
  const { selectedLocationId } = useOutletContext<DashboardOutletContext>();
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
  const [quickPaidAmount, setQuickPaidAmount] = useState<number>(0);
  const [quickBookingSubmitting, setQuickBookingSubmitting] = useState(false);
  const [quickBookingError, setQuickBookingError] = useState<string | null>(null);
  const [quickSlots, setQuickSlots] = useState<Array<{ startTime: string; endTime: string }>>(
    [],
  );
  const [quickSlotsLoading, setQuickSlotsLoading] = useState(false);
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
      const dualTurfIds = new Set(
        futsalCourtRows
          .filter((r) => r.supportedSports?.includes('futsal') && r.supportedSports?.includes('cricket'))
          .map((r) => r.id),
      );
      const futsalCards = futsalCourtRows.map((r) => {
        const isShared = r.supportedSports?.includes('futsal') && r.supportedSports?.includes('cricket');
        const sportsLabel = r.supportedSports?.length 
          ? ` (${r.supportedSports.join(' + ')})`
          : '';

        return {
          id: r.id,
          name: isShared ? `${r.name}${sportsLabel}` : r.name,
          type: (isShared ? 'sharedTurfCourt' : 'futsalCourt') as FacilityLiveType,
          locationId: r.businessLocationId,
          timeSlotTemplateId: r.timeSlotTemplateId ?? null,
          facilityStatus: r.courtStatus,
          facilityIsActive: r.isActive,
          pricePerSlot: r.pricePerSlot,
          pricing: r.pricing,
          linkedTwinCourtId: r.linkedTwinCourtId,
        };
      });
      const cricketCards = cricketCourtRows
        .filter((r) => !dualTurfIds.has(r.id))
        .map((r) => ({
          id: r.id,
          name: r.name,
          type: 'cricketCourt' as const,
          locationId: r.businessLocationId,
          timeSlotTemplateId: r.timeSlotTemplateId ?? null,
          facilityStatus: r.courtStatus,
          facilityIsActive: r.isActive,
          pricePerSlot: r.pricePerSlot,
          pricing: r.pricing,
          linkedTwinCourtId: r.linkedTwinCourtId,
        }));
      const padelCards = padelRows.map((r) => ({
        id: r.id,
        name: r.name,
        type: 'padel' as const,
        locationId: r.businessLocationId,
        timeSlotTemplateId: r.timeSlotTemplateId ?? null,
        facilityStatus: r.courtStatus,
        facilityIsActive: r.isActive,
        pricePerSlot: r.pricePerSlot,
        pricing: r.pricing,
      }));
      return [...futsalCards, ...cricketCards, ...padelCards];
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
    return facilities.filter((facility) => {
      if (selectedLocationId !== 'all' && facility.locationId !== selectedLocationId) return false;
      if (!q) return true;
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
  }, [businessById, facilities, locations, query, selectedLocationId]);

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
          linkedCourtIds: facility.linkedTwinCourtId ? [facility.linkedTwinCourtId] : undefined,
        }),
      );
    }
    return map;
  }, [bookings, clock, filteredFacilities]);

  const typeLabel = (t: FacilityCardRow['type']) =>
    t === 'futsalCourt'
      ? 'Futsal'
      : t === 'cricketCourt'
        ? 'Cricket'
        : t === 'sharedTurfCourt'
          ? 'Turf'
          : 'Padel';

  const loadQuickPrice = useCallback(async (state: QuickBookingState) => {
    const sportType =
      state.facility.type === 'futsalCourt' || state.facility.type === 'sharedTurfCourt'
        ? 'futsal'
        : state.facility.type === 'cricketCourt'
          ? 'cricket'
          : 'padel';
    const startTime = state.startTime;
    const endTime = state.endTime || endTimeFrom(startTime);
    const range = getSelectedRangeMinutes(startTime, endTime);
    const selectedMinutes = Math.max(0, range.end - range.start);
    const selectedHours = selectedMinutes > 0 ? selectedMinutes / 60 : 1;
    setQuickPriceLoading(true);
    try {
      // 1. Try fetching from availability API (most accurate for seasonal/peak pricing if implemented)
      const avail = await getBookingAvailability({
        date: state.date,
        startTime,
        endTime,
        sportType,
      });
      const courtKind = facilityTypeToCourtKind(state.facility.type);
      let row = avail.availableCourts.find(
        (c) => c.kind === courtKind && c.id === state.facility.id,
      );
      if (!row && state.facility.type === 'sharedTurfCourt') {
        row = avail.availableCourts.find(
          (c) => c.kind === 'cricket_court' && c.id === state.facility.id,
        );
      }

      if (row && row.pricePerSlot != null) {
        const slotDuration = row.slotDurationMinutes && row.slotDurationMinutes > 0 ? row.slotDurationMinutes : 60;
        const perHour = row.pricePerSlot * (60 / slotDuration);
        const computed = perHour * selectedHours;
        setQuickPrice(Number.isFinite(computed) ? Math.max(0, Math.round(computed)) : null);
        return;
      }

      // 2. Fallback to static pricing on the facility card (if court is busy/blocked)
      let basePrice: number | null = null;
      if (state.facility.pricePerSlot != null) {
        basePrice = Number(state.facility.pricePerSlot);
      } else if (state.facility.pricing) {
        const s = sportType.toLowerCase();
        const p = state.facility.pricing[s]?.basePrice ?? state.facility.pricing[s === 'cricket' ? 'cricket' : 'futsal']?.basePrice;
        if (p != null) basePrice = Number(p);
      }

      const computed = (basePrice ?? 0) * selectedHours;
      setQuickPrice(Number.isFinite(computed) ? Math.max(0, Math.round(computed)) : null);
    } catch {
      setQuickPrice(null);
    } finally {
      setQuickPriceLoading(false);
    }
  }, []);

  useEffect(() => {
    setQuickPaidAmount(quickPrice ?? 0);
  }, [quickPrice]);

  useEffect(() => {
    if (!quickBooking) return;
    void loadQuickPrice(quickBooking);
  }, [quickBooking, loadQuickPrice]);

  useEffect(() => {
    if (!quickBooking) return;
    const maxStart = 23 * 60;
    if (timeToMinutes(quickBooking.startTime) <= maxStart) return;
    setQuickBooking((cur) =>
      cur ? { ...cur, startTime: minutesToTime(Math.max(0, maxStart)) } : cur,
    );
  }, [quickBooking]);

  const loadQuickSlots = useCallback(async (state: QuickBookingState) => {
    setQuickSlotsLoading(true);
    try {
      const courtKind = facilityTypeToCourtKind(state.facility.type);
      const gridRes = await getCourtSlotGrid({
        courtKind,
        courtId: state.facility.id,
        date: state.date,
        useWorkingHours: false,
        availableOnly: true,
      });
      const availableSlots = gridRes.segments
        .filter((segment) => segment.state === 'free')
        .map((segment) => ({ startTime: segment.startTime, endTime: segment.endTime }));
      const deduped = availableSlots.filter((slot) => {
        const m = timeToMinutes(slot.startTime);
        return m <= 23 * 60;
      }).filter((slot, index, arr) => {
        return (
          arr.findIndex(
            (x) => x.startTime === slot.startTime && x.endTime === slot.endTime,
          ) === index
        );
      });
      deduped.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
      /**
       * `getCourtSlots` is already filtered by the facility's assigned
       * time-slot template on the backend.
       */
      setQuickSlots(deduped);
    } catch {
      setQuickSlots([]);
    } finally {
      setQuickSlotsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!quickBooking) {
      setQuickSlots([]);
      return;
    }
    void loadQuickSlots(quickBooking);
  }, [quickBooking?.facility.id, quickBooking?.date, loadQuickSlots]);

  useEffect(() => {
    if (!quickBooking) return;
    if (quickSlots.length === 0) return;
    const hasStart = quickSlots.some((slot) => slot.startTime === quickBooking.startTime);
    if (hasStart) return;
    const first = quickSlots[0];
    setQuickBooking((cur) =>
      cur ? { ...cur, startTime: first.startTime, endTime: first.endTime } : cur,
    );
  }, [quickSlots, quickBooking]);

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
    const fullName = quickBooking.name.trim();
    if (!fullName) {
      setQuickBookingError('Customer name is required.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(quickBooking.date)) {
      setQuickBookingError('Please select a valid booking date.');
      return;
    }
    if (quickBooking.date < localDateYmd()) {
      setQuickBookingError('Booking date cannot be in the past.');
      return;
    }
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(quickBooking.startTime)) {
      setQuickBookingError('Please select a valid start time.');
      return;
    }
    const startTime = quickBooking.startTime;
    const endTime = quickBooking.endTime || endTimeFrom(startTime);
    const range = getSelectedRangeMinutes(startTime, endTime);
    const startM = range.start;
    const endM = range.end;
    const duration = endM - startM;
    console.info(BOOKING_TIMING_LOG, 'time-check', {
      date: quickBooking.date,
      startTime,
      endTime,
      durationMins: 60,
      computedDuration: duration,
    });
    if (duration <= 0) {
      setQuickBookingError(
        'Selected slot is invalid. Please choose another slot.',
      );
      return;
    }
    const quickSlotStep = getSlotStepMinutes(quickSlots);
    if (duration % quickSlotStep !== 0) {
      setQuickBookingError(
        'Selected duration does not match slot interval. Please reselect consecutive slots.',
      );
      return;
    }
    const freeStartSet = new Set(quickSlots.map((s) => s.startTime));
    for (let cursor = startM; cursor < endM; cursor += quickSlotStep) {
      const t = minutesToTime(cursor);
      if (!freeStartSet.has(t)) {
        setQuickBookingError(
          'Selected slots must be consecutive with no gap. Please choose continuous times.',
        );
        return;
      }
    }
    const startAt = new Date(`${quickBooking.date}T${startTime}:00`);
    if (startAt.getTime() < Date.now()) {
      setQuickBookingError('Booking start time cannot be in the past.');
      return;
    }
    if (quickPrice == null) {
      setQuickBookingError('Price is unavailable for this slot. Try another time.');
      return;
    }
    const safePaidAmount = Number.isFinite(quickPaidAmount)
      ? Math.max(0, quickPaidAmount)
      : 0;
    const resolvedPaymentStatus: PaymentStatus =
      safePaidAmount <= 0
        ? 'pending'
        : safePaidAmount >= quickPrice
          ? 'paid'
          : 'partially_paid';
    const sportType =
      quickBooking.facility.type === 'futsalCourt' ||
      quickBooking.facility.type === 'sharedTurfCourt'
        ? 'futsal'
        : quickBooking.facility.type === 'cricketCourt'
          ? 'cricket'
          : 'padel';
    const courtKind = facilityTypeToCourtKind(quickBooking.facility.type);

    setQuickBookingError(null);
    setQuickBookingSubmitting(true);
    try {
      const slotGrid = await getCourtSlotGrid({
        courtKind,
        courtId: quickBooking.facility.id,
        date: quickBooking.date,
        startTime,
        endTime,
        useWorkingHours: false,
        availableOnly: false,
      });
      console.info(BOOKING_TIMING_LOG, 'slot-grid-loaded', {
        date: quickBooking.date,
        courtKind,
        courtId: quickBooking.facility.id,
        locationClosed: slotGrid.locationClosed,
        segmentCount: slotGrid.segments.length,
      });
      const segmentStep =
        typeof slotGrid.segmentMinutes === 'number' && slotGrid.segmentMinutes > 0
          ? slotGrid.segmentMinutes
          : 60;
      for (let m = startM; m < endM; m += segmentStep) {
        const seg = slotGrid.segments.find(
          (s) => timeToMinutes(s.startTime) === m,
        );
        if (!seg || seg.state !== 'free') {
          console.warn(BOOKING_TIMING_LOG, 'slot-unavailable', {
            date: quickBooking.date,
            slot: minutesToTime(m),
            found: Boolean(seg),
            state: seg?.state ?? null,
          });
          setQuickBookingError(
            'Selected slot is not available. Please choose another time.',
          );
          return;
        }
      }

      const users = await listIamUsers();
      const existing =
        users.find((u) => {
          const p = digitsOnly(u.phone ?? '');
          return p && (p === digits || p.endsWith(digits) || digits.endsWith(p));
        }) ?? null;
      let userId = existing?.id ?? '';
      if (!userId) {
        const created = await createIamUser({
          fullName,
          email: `quick-${digits}-${Date.now()}@velay.local`,
          phone,
          password: `Quick!${Math.random().toString(36).slice(2, 8)}9`,
        });
        userId = created.id;
        // Ensure they have the end-customer role
        await assignRole(userId, 'customer-end-user').catch((e) => {
          console.warn('Failed to assign end-customer role to quick booking user:', e);
        });
      }

      await createBooking({
        userId,
        sportType,
        bookingDate: quickBooking.date,
        allowImmediate: true,
        items: [
          {
            courtKind,
            courtId: quickBooking.facility.id,
            startTime,
            endTime,
            price: quickPrice,
            currency: location.currency ?? 'PKR',
            status: 'confirmed',
          },
        ],
        pricing: {
          subTotal: quickPrice,
          discount: 0,
          tax: 0,
          totalAmount: quickPrice,
        },
        payment: {
          paymentStatus: resolvedPaymentStatus,
          paymentMethod: 'cash',
          paidAmount: safePaidAmount,
        },
        bookingStatus: 'confirmed',
        notes: 'source:walkin',
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
          <Link to="/app/Facilities" className="btn-primary btn-compact">
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
                    const nowStart = nextHourTime();
                    const maxStart = 23 * 60;
                    const safeStart = timeToMinutes(nowStart) <= maxStart ? nowStart : minutesToTime(maxStart);
                    setQuickBooking({
                      facility,
                      location: location ?? null,
                      date: localDateYmd(),
                      startTime: safeStart,
                      endTime: endTimeFrom(safeStart),
                      phone: '+92',
                      name: '',
                    });
                  }
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const nowStart = nextHourTime();
                    const maxStart = 23 * 60;
                    const safeStart = timeToMinutes(nowStart) <= maxStart ? nowStart : minutesToTime(maxStart);
                    setQuickBooking({
                      facility,
                      location: location ?? null,
                      date: localDateYmd(),
                      startTime: safeStart,
                      endTime: endTimeFrom(safeStart),
                      phone: '+92',
                      name: '',
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
              <div>
                <label>Customer name</label>
                <input
                  value={quickBooking.name}
                  onChange={(e) =>
                    setQuickBooking((cur) =>
                      cur ? { ...cur, name: e.target.value } : cur,
                    )
                  }
                  placeholder="Full name"
                  disabled={quickBookingSubmitting}
                />
              </div>
              <div>
                <label>Date</label>
                <input
                  type="date"
                  value={quickBooking.date}
                  min={localDateYmd()}
                  onChange={(e) =>
                    setQuickBooking((cur) =>
                      cur ? { ...cur, date: e.target.value } : cur,
                    )
                  }
                  disabled={quickBookingSubmitting}
                />
              </div>
              <div>
                <label>Slots</label>
                <div
                  style={{
                    marginTop: '0.35rem',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                    gap: '0.4rem',
                    width: '100%',
                  }}
                >
                  {quickSlotsLoading ? (
                    <span className="muted" style={{ gridColumn: '1 / -1' }}>
                      Loading slots...
                    </span>
                  ) : quickSlots.length === 0 ? (
                    <span className="muted" style={{ gridColumn: '1 / -1' }}>
                      {quickBooking.facility.timeSlotTemplateId
                        ? 'No template slots available for this date.'
                        : 'No time slot template assigned to this facility.'}
                    </span>
                  ) : (
                    quickSlots.map((slot) => {
                      const range = getSelectedRangeMinutes(
                        quickBooking.startTime,
                        quickBooking.endTime,
                      );
                      const slotBaseMin = timeToMinutes(slot.startTime, false);
                      const slotMin =
                        slotBaseMin < range.start ? slotBaseMin + 24 * 60 : slotBaseMin;
                      const active = slotMin >= range.start && slotMin < range.end;
                      return (
                        <button
                          key={`${slot.startTime}-${slot.endTime}`}
                          type="button"
                          className={active ? 'btn-primary' : 'btn-ghost'}
                          style={{
                            padding: '0.55rem 0.8rem',
                            borderRadius: '0.6rem',
                            fontSize: '0.9rem',
                            width: '100%',
                            textAlign: 'center',
                          }}
                          onClick={() =>
                            setQuickBooking((cur) =>
                              (() => {
                                if (!cur) return cur;
                                const clicked = timeToMinutes(slot.startTime);
                                const currentRange = getSelectedRangeMinutes(
                                  cur.startTime,
                                  cur.endTime,
                                );
                                const currentStart = currentRange.start;
                                const currentEnd = currentRange.end;
                                const step = getSlotStepMinutes(quickSlots);
                                const nextEnd = currentEnd + step;
                                if (clicked === currentEnd) {
                                  if (nextEnd > 24 * 60) return cur;
                                  return {
                                    ...cur,
                                    startTime: cur.startTime,
                                    endTime: minutesToTime(nextEnd),
                                  };
                                }
                                if (clicked === currentStart - step) {
                                  return {
                                    ...cur,
                                    startTime: slot.startTime,
                                    endTime: cur.endTime,
                                  };
                                }
                                return {
                                  ...cur,
                                  startTime: slot.startTime,
                                  endTime: slot.endTime,
                                };
                              })(),
                            )
                          }
                          disabled={quickBookingSubmitting}
                        >
                          {formatTime12h(slot.startTime)} - {formatTime12h(slot.endTime)}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
              <div className="detail-row">
                <span>Price (backend)</span>
                <span>
                  {quickPriceLoading
                    ? 'Loading...'
                    : quickPrice == null
                      ? 'Unavailable'
                      : `${quickBooking.location?.currency ?? 'PKR'} ${new Intl.NumberFormat('en-PK').format(
                          quickPrice,
                        )}`}
                </span>
              </div>
              <div>
                <label>Paid amount</label>
                <input
                  type="number"
                  min={0}
                  value={quickPaidAmount}
                  onChange={(e) =>
                    setQuickPaidAmount(Math.max(0, Number(e.target.value || 0)))
                  }
                  disabled={quickBookingSubmitting || quickPriceLoading || quickPrice == null}
                />
                {quickPrice != null && (
                  <p className="muted" style={{ marginTop: '0.35rem', fontSize: '0.82rem' }}>
                    Remaining:{' '}
                    {Math.max(0, quickPrice - (Number.isFinite(quickPaidAmount) ? quickPaidAmount : 0)).toLocaleString()}{' '}
                    {quickBooking.location?.currency ?? 'PKR'}
                  </p>
                )}
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
                disabled={
                  quickBookingSubmitting ||
                  quickSlotsLoading ||
                  quickSlots.length === 0 ||
                  quickPriceLoading ||
                  quickPrice == null
                }
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

