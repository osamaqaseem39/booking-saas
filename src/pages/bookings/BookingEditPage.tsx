import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { editBookingFacilitySlots, getBooking, updateBooking } from '../../api/saasClient';
import type { BookingRecord, BookingStatus, PaymentMethod, PaymentStatus } from '../../types/booking';
import { formatTimeRange12h } from '../../utils/timeDisplay';

function titleCaseWords(v: string): string {
  return v
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

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

function courtKindLabel(courtKind: string): string {
  return titleCaseWords(courtKind.replace(/_court$/i, ''));
}

export default function BookingEditPage() {
  const { bookingId = '' } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<BookingRecord | null>(null);
  const [bookingStatus, setBookingStatus] = useState<BookingStatus>('pending');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('pending');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cancellationReason, setCancellationReason] = useState('');

  const normalized = useMemo(() => {
    if (!booking) return null;

    const currency = booking.items[0]?.currency || 'PKR';
    const items = booking.items.map((it) => ({
      id: it.id,
      courtId: it.courtId,
      courtKindLabel: courtKindLabel(it.courtKind),
      slotLabel: formatTimeRange12h(it.startTime, it.endTime),
      price: Number(it.price || 0),
      status: it.status,
    }));

    const itemStatusCounts = items.reduce(
      (acc, it) => {
        acc[it.status] = (acc[it.status] ?? 0) + 1;
        return acc;
      },
      { reserved: 0, confirmed: 0, cancelled: 0 } as Record<string, number>,
    );

    const statusChartRows = [
      { key: 'reserved', label: 'Reserved', count: itemStatusCounts.reserved },
      { key: 'confirmed', label: 'Confirmed', count: itemStatusCounts.confirmed },
      { key: 'cancelled', label: 'Cancelled', count: itemStatusCounts.cancelled },
    ];
    const maxStatusCount = Math.max(1, ...statusChartRows.map((r) => r.count));

    const amountChartRows = items.map((it) => ({
      id: it.id,
      label: `${it.courtKindLabel} (${it.slotLabel})`,
      value: it.price,
    }));
    const maxAmount = Math.max(1, ...amountChartRows.map((r) => r.value));

    return {
      id: booking.bookingId,
      arenaId: booking.arenaId,
      userId: booking.userId,
      sportLabel: titleCaseWords(booking.sportType),
      bookingDate: booking.bookingDate,
      bookingStatus: booking.bookingStatus,
      paymentStatus: booking.payment.paymentStatus,
      paymentMethod: booking.payment.paymentMethod,
      itemCount: items.length,
      currency,
      subTotal: Number(booking.pricing.subTotal || 0),
      discount: Number(booking.pricing.discount || 0),
      tax: Number(booking.pricing.tax || 0),
      totalAmount: Number(booking.pricing.totalAmount || 0),
      items,
      statusChartRows: statusChartRows.map((row) => ({
        ...row,
        widthPct: row.count > 0 ? Math.max(8, Math.round((row.count / maxStatusCount) * 100)) : 0,
      })),
      amountChartRows: amountChartRows.map((row) => ({
        ...row,
        widthPct: row.value > 0 ? Math.max(8, Math.round((row.value / maxAmount) * 100)) : 0,
      })),
    };
  }, [booking]);

  useEffect(() => {
    if (!bookingId.trim()) return;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const row = await getBooking(bookingId);
        setBooking(row);
        setBookingStatus(row.bookingStatus);
        setPaymentStatus(row.payment.paymentStatus);
        setPaymentMethod(row.payment.paymentMethod);
        setCancellationReason(row.cancellationReason ?? '');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load booking');
      } finally {
        setLoading(false);
      }
    })();
  }, [bookingId]);

  async function onSave() {
    if (!bookingId.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const previousStatus = booking?.bookingStatus;
      const updated = await updateBooking(bookingId, {
        bookingStatus,
        payment: { paymentStatus, paymentMethod },
        cancellationReason: cancellationReason.trim() || undefined,
      });
      if (
        previousStatus !== undefined &&
        updated.bookingStatus !== previousStatus
      ) {
        await editBookingFacilitySlots(updated.bookingId, {
          blocked: updated.bookingStatus === 'confirmed',
        });
      }
      setBooking(updated);
      navigate('/app/bookings', { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  if (!bookingId.trim()) return <p className="muted">Missing booking id.</p>;

  return (
    <div>
      <p className="page-toolbar">
        <Link to="/app/bookings" className="btn-ghost btn-compact">
          ← Back to bookings
        </Link>
      </p>
      <h1 className="page-title">Edit booking</h1>
      {error && <div className="err-banner">{error}</div>}
      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : !booking ? (
        <div className="empty-state">Booking not found.</div>
      ) : (
        <div className="form-grid">
          <div className="detail-card">
            <h3>Booking details</h3>
            {!normalized ? null : (
              <>
                <div
                  className="overview-totals-grid"
                  style={{
                    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                    marginBottom: '0.8rem',
                  }}
                >
                  <article className="overview-metric-card">
                    <span className="overview-metric-label">Booking ID</span>
                    <strong className="overview-metric-value">#{normalized.id.slice(0, 8)}</strong>
                  </article>
                  <article className="overview-metric-card">
                    <span className="overview-metric-label">Date</span>
                    <strong className="overview-metric-value">{normalized.bookingDate}</strong>
                  </article>
                  <article className="overview-metric-card">
                    <span className="overview-metric-label">Sport</span>
                    <strong className="overview-metric-value">{normalized.sportLabel}</strong>
                  </article>
                  <article className="overview-metric-card">
                    <span className="overview-metric-label">Items</span>
                    <strong className="overview-metric-value">{normalized.itemCount}</strong>
                  </article>
                  <article className="overview-metric-card">
                    <span className="overview-metric-label">Total</span>
                    <strong className="overview-metric-value">
                      {normalized.totalAmount.toLocaleString()} {normalized.currency}
                    </strong>
                  </article>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gap: '0.75rem',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  }}
                >
                  <article className="overview-chart-card">
                    <h4 style={{ marginTop: 0 }}>Items by status</h4>
                    <div className="overview-source-bars">
                      {normalized.statusChartRows.map((row) => (
                        <div key={row.key} className="overview-source-row">
                          <span className="overview-source-label">{row.label}</span>
                          <div className="overview-source-track">
                            <div
                              className={`overview-source-fill overview-source-fill--${row.key === 'cancelled' ? 'call' : row.key === 'confirmed' ? 'app' : 'walkin'}`}
                              style={{ width: `${row.widthPct}%` }}
                            />
                          </div>
                          <span className="overview-source-value">{row.count}</span>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="overview-chart-card">
                    <h4 style={{ marginTop: 0 }}>Amount by item</h4>
                    <div className="overview-source-bars">
                      {normalized.amountChartRows.map((row) => (
                        <div key={row.id} className="overview-source-row">
                          <span className="overview-source-label" title={row.label}>
                            {row.label}
                          </span>
                          <div className="overview-source-track">
                            <div
                              className="overview-mini-col-bar overview-mini-col-bar--revenue"
                              style={{ width: `${row.widthPct}%`, height: '0.55rem' }}
                            />
                          </div>
                          <span className="overview-source-value">
                            {row.value.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </article>
                </div>

                <div className="detail-section" style={{ marginTop: '0.8rem', marginBottom: 0 }}>
                  <h4>Pricing breakdown</h4>
                  <div className="detail-row">
                    <span>Subtotal</span>
                    <span>
                      {normalized.subTotal.toLocaleString()} {normalized.currency}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span>Discount</span>
                    <span>
                      {normalized.discount.toLocaleString()} {normalized.currency}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span>Tax</span>
                    <span>
                      {normalized.tax.toLocaleString()} {normalized.currency}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span>Total</span>
                    <span>
                      {normalized.totalAmount.toLocaleString()} {normalized.currency}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {!normalized ? null : (
            <div className="detail-card">
              <h3>Booked items</h3>
              <div
                style={{
                  display: 'grid',
                  gap: '0.6rem',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                }}
              >
                {normalized.items.map((item) => (
                  <article
                    key={item.id}
                    className="overview-metric-card"
                    style={{ padding: '0.8rem 0.9rem' }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.55rem',
                      }}
                    >
                      <strong style={{ fontSize: '0.9rem' }}>{item.courtKindLabel}</strong>
                      <span className={badgeClass(item.status)}>{titleCaseWords(item.status)}</span>
                    </div>
                    <p className="muted" style={{ margin: '0.45rem 0 0' }}>
                      {item.slotLabel}
                    </p>
                    <p className="muted" style={{ margin: '0.25rem 0 0' }}>
                      Court: {item.courtId.slice(0, 8)}
                    </p>
                    <p style={{ margin: '0.45rem 0 0', fontWeight: 600 }}>
                      {item.price.toLocaleString()} {normalized.currency}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          )}

          <div className="detail-card">
            <h3>Actions</h3>
            <div className="form-grid">
              <div>
                <label>Booking status</label>
                <select
                  value={bookingStatus}
                  onChange={(e) => setBookingStatus(e.target.value as BookingStatus)}
                >
                  {(['pending', 'confirmed', 'cancelled', 'completed', 'no_show'] as const).map((s) => (
                    <option key={s} value={s}>
                      {titleCaseWords(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Payment status</label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                >
                  {(['pending', 'paid', 'failed', 'refunded'] as const).map((s) => (
                    <option key={s} value={s}>
                      {titleCaseWords(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Payment method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                >
                  {(['cash', 'card', 'jazzcash', 'easypaisa'] as const).map((s) => (
                    <option key={s} value={s}>
                      {titleCaseWords(s)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label>Cancellation reason</label>
                <input
                  value={cancellationReason}
                  onChange={(e) => setCancellationReason(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="page-actions-row">
                <button type="button" className="btn-primary" disabled={saving} onClick={() => void onSave()}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

