import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getBooking, updateBooking } from '../api/saasClient';
import type { BookingRecord, BookingStatus, PaymentMethod, PaymentStatus } from '../types/booking';

function titleCaseWords(v: string): string {
  return v
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
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
      const updated = await updateBooking(bookingId, {
        bookingStatus,
        payment: { paymentStatus, paymentMethod },
        cancellationReason: cancellationReason.trim() || undefined,
      });
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
        <div className="form-grid" style={{ maxWidth: '700px' }}>
          <div className="detail-card">
            <h3>Booking</h3>
            <div className="detail-row">
              <span>ID</span>
              <span>{booking.bookingId}</span>
            </div>
            <div className="detail-row">
              <span>Date</span>
              <span>{booking.bookingDate}</span>
            </div>
            <div className="detail-row">
              <span>Sport</span>
              <span>{titleCaseWords(booking.sportType)}</span>
            </div>
            <div className="detail-row">
              <span>Total</span>
              <span>{booking.pricing.totalAmount.toLocaleString()} PKR</span>
            </div>
          </div>

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
