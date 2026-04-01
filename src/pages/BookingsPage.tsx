import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getBookingAvailability,
  getCourtBookedSlots,
  listBookings,
  updateBooking,
} from '../api/saasClient';
import { useSession } from '../context/SessionContext';
import type {
  BookingRecord,
  BookingSportType,
  BookingStatus,
  CourtKind,
  PaymentMethod,
  PaymentStatus,
} from '../types/booking';

function badgeClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'pending') return 'badge badge-pending';
  if (s === 'confirmed') return 'badge badge-confirmed';
  if (s === 'cancelled' || s === 'failed') return 'badge badge-cancelled';
  if (s === 'paid') return 'badge badge-paid';
  if (s === 'completed') return 'badge badge-completed';
  if (s === 'no_show') return 'badge badge-neutral';
  return 'badge badge-neutral';
}

export default function BookingsPage() {
  const navigate = useNavigate();
  const { tenantId } = useSession();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [availabilitySport, setAvailabilitySport] =
    useState<BookingSportType>('futsal');
  const [availabilityDate, setAvailabilityDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [availabilityStartTime, setAvailabilityStartTime] = useState('18:00');
  const [availabilityEndTime, setAvailabilityEndTime] = useState('19:00');
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availability, setAvailability] = useState<
    Awaited<ReturnType<typeof getBookingAvailability>> | null
  >(null);
  const [courtSlotsLoading, setCourtSlotsLoading] = useState(false);
  const [courtSlots, setCourtSlots] = useState<
    Awaited<ReturnType<typeof getCourtBookedSlots>> | null
  >(null);

  const selected = useMemo(
    () => bookings.find((b) => b.bookingId === selectedId) ?? null,
    [bookings, selectedId],
  );

  const refresh = useCallback(async () => {
    if (!tenantId.trim()) {
      setBookings([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await listBookings();
      setBookings(data);
      setSelectedId((cur) =>
        cur && !data.some((b) => b.bookingId === cur) ? null : cur,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load bookings');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);


  async function patchBooking(patch: Parameters<typeof updateBooking>[1]) {
    if (!selectedId) return;
    setError(null);
    try {
      const updated = await updateBooking(selectedId, patch);
      setBookings((prev) =>
        prev.map((b) => (b.bookingId === updated.bookingId ? updated : b)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  }

  async function checkAvailability() {
    setError(null);
    setAvailabilityLoading(true);
    setCourtSlots(null);
    try {
      const result = await getBookingAvailability({
        date: availabilityDate,
        startTime: availabilityStartTime,
        endTime: availabilityEndTime,
        sportType: availabilitySport,
      });
      setAvailability(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to check availability');
      setAvailability(null);
    } finally {
      setAvailabilityLoading(false);
    }
  }

  async function viewCourtSlots(courtKind: CourtKind, courtId: string) {
    setError(null);
    setCourtSlotsLoading(true);
    try {
      const result = await getCourtBookedSlots({
        courtKind,
        courtId,
        date: availabilityDate,
      });
      setCourtSlots(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load court slots');
      setCourtSlots(null);
    } finally {
      setCourtSlotsLoading(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">Bookings</h1>
      {!tenantId.trim() && (
        <div className="err-banner">Pick an active tenant in the top bar.</div>
      )}
      <div className="toolbar">
        <span className="muted">
          {loading ? 'Loading…' : `${bookings.length} booking(s)`}
        </span>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="button" className="btn-ghost" onClick={() => void refresh()} disabled={loading}>
            Refresh
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => navigate('/app/bookings/new')}
            disabled={!tenantId.trim()}
          >
            Add booking
          </button>
        </div>
      </div>
      {error && <div className="err-banner">{error}</div>}
      <div className="main-area" style={{ marginBottom: '0.75rem' }}>
        <section className="detail-card" style={{ gridColumn: '1 / -1' }}>
          <h3 style={{ marginBottom: '0.8rem' }}>Court availability explorer</h3>
          <div className="form-grid">
            <div className="form-row-2">
              <div>
                <label>Sport</label>
                <select
                  value={availabilitySport}
                  onChange={(e) =>
                    setAvailabilitySport(e.target.value as BookingSportType)
                  }
                >
                  <option value="futsal">futsal</option>
                  <option value="cricket">cricket</option>
                  <option value="padel">padel</option>
                </select>
              </div>
              <div>
                <label>Date</label>
                <input
                  type="date"
                  value={availabilityDate}
                  onChange={(e) => setAvailabilityDate(e.target.value)}
                />
              </div>
            </div>
            <div className="form-row-2">
              <div>
                <label>Start time</label>
                <input
                  type="time"
                  value={availabilityStartTime}
                  onChange={(e) => setAvailabilityStartTime(e.target.value)}
                />
              </div>
              <div>
                <label>End time</label>
                <input
                  type="time"
                  value={availabilityEndTime}
                  onChange={(e) => setAvailabilityEndTime(e.target.value)}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void checkAvailability()}
                disabled={availabilityLoading}
              >
                {availabilityLoading ? 'Checking…' : 'Check availability'}
              </button>
              {availability && (
                <span className="muted">
                  {availability.availableCourts.length} available court(s)
                </span>
              )}
            </div>
            {availability && (
              <div className="detail-section">
                <h4>Available fields / turf</h4>
                {availability.availableCourts.length === 0 ? (
                  <div className="empty-state">No courts available for this slot.</div>
                ) : (
                  <ul className="items-list">
                    {availability.availableCourts.map((court) => (
                      <li key={`${court.kind}:${court.id}`}>
                        <div>
                          <strong>{court.name}</strong>
                        </div>
                        <div className="muted">{court.kind}</div>
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ marginTop: '0.35rem' }}
                          onClick={() => void viewCourtSlots(court.kind, court.id)}
                        >
                          View booked slots
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {courtSlots && (
              <div className="detail-section">
                <h4>
                  Booked slots ({courtSlots.kind}) {courtSlotsLoading ? '…' : ''}
                </h4>
                {courtSlots.slots.length === 0 ? (
                  <div className="empty-state">No booked slots on selected date.</div>
                ) : (
                  <ul className="items-list">
                    {courtSlots.slots.map((slot) => (
                      <li key={slot.itemId}>
                        <div>
                          <strong>
                            {slot.startTime} - {slot.endTime}
                          </strong>
                        </div>
                        <div className="muted">
                          {slot.status} · booking {slot.bookingId.slice(0, 8)}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="main-area" style={{ padding: 0, marginTop: '0.5rem' }}>
        <div>
          <div className="table-wrap">
            {bookings.length === 0 && !loading ? (
              <div className="empty-state">No bookings.</div>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Sport</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Total</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((b) => (
                    <tr
                      key={b.bookingId}
                      className={b.bookingId === selectedId ? 'active' : ''}
                      onClick={() => setSelectedId(b.bookingId)}
                    >
                      <td>{b.bookingDate}</td>
                      <td>{b.sportType}</td>
                      <td>
                        <span className={badgeClass(b.bookingStatus)}>
                          {b.bookingStatus}
                        </span>
                      </td>
                      <td>
                        <span className={badgeClass(b.payment.paymentStatus)}>
                          {b.payment.paymentStatus}
                        </span>
                      </td>
                      <td>{b.pricing.totalAmount.toLocaleString()} PKR</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(b.bookingId);
                            }}
                          >
                            View
                          </button>
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedId(b.bookingId);
                            }}
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <aside className="detail-card">
          {!selected ? (
            <div className="empty-state">Select a booking.</div>
          ) : (
            <>
              <h3>Detail</h3>
              <div className="detail-section">
                <h4>Summary</h4>
                <div className="detail-row">
                  <span>ID</span>
                  <span>{selected.bookingId}</span>
                </div>
                <div className="detail-row">
                  <span>User</span>
                  <span>{selected.userId}</span>
                </div>
              </div>
              <div className="detail-section">
                <h4>Items</h4>
                <ul className="items-list">
                  {selected.items.map((it) => (
                    <li key={it.id}>
                      <div>
                        <strong>{it.courtKind}</strong>
                      </div>
                      <div className="muted">
                        {it.startTime}–{it.endTime} · {it.price}{' '}
                        <span className={badgeClass(it.status)}>{it.status}</span>
                      </div>
                      <button
                        type="button"
                        className="btn-ghost"
                        style={{ marginTop: '0.35rem' }}
                        onClick={() => {
                          setAvailabilityDate(selected.bookingDate);
                          void viewCourtSlots(it.courtKind, it.courtId);
                        }}
                      >
                        View court booked slots
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="detail-section">
                <h4>Actions</h4>
                <div className="form-grid">
                  <div>
                    <label>Booking status</label>
                    <select
                      value={selected.bookingStatus}
                      onChange={(e) =>
                        void patchBooking({
                          bookingStatus: e.target.value as BookingStatus,
                        })
                      }
                    >
                      {(
                        [
                          'pending',
                          'confirmed',
                          'cancelled',
                          'completed',
                          'no_show',
                        ] as const
                      ).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Payment status</label>
                    <select
                      value={selected.payment.paymentStatus}
                      onChange={(e) =>
                        void patchBooking({
                          payment: {
                            paymentStatus: e.target.value as PaymentStatus,
                          },
                        })
                      }
                    >
                      {(
                        ['pending', 'paid', 'failed', 'refunded'] as const
                      ).map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Payment method</label>
                    <select
                      value={selected.payment.paymentMethod}
                      onChange={(e) =>
                        void patchBooking({
                          payment: {
                            paymentMethod: e.target.value as PaymentMethod,
                          },
                        })
                      }
                    >
                      {(['cash', 'card', 'jazzcash', 'easypaisa'] as const).map(
                        (s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                  <div>
                    <label>Cancellation reason</label>
                    <input
                      placeholder="Optional"
                      defaultValue={selected.cancellationReason ?? ''}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (selected.cancellationReason ?? '')) {
                          void patchBooking({ cancellationReason: v || undefined });
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>

    </div>
  );
}
