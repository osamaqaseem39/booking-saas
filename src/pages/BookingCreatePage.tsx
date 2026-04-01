import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createBooking, listCourtOptions, listIamUsers } from '../api/saasClient';
import { useSession } from '../context/SessionContext';
import type {
  BookingItemStatus,
  BookingSportType,
  CourtKind,
} from '../types/booking';
import type { IamUserRow } from '../types/domain';

type LineDraft = {
  courtKey: string;
  courtKind: CourtKind;
  courtId: string;
  slotId: string;
  startTime: string;
  endTime: string;
  price: string;
  currency: string;
  status: BookingItemStatus;
};

const defaultLine = (): LineDraft => ({
  courtKey: '',
  courtKind: 'turf_court',
  courtId: '',
  slotId: '',
  startTime: '18:00',
  endTime: '19:00',
  price: '5000',
  currency: 'PKR',
  status: 'reserved',
});

export default function BookingCreatePage() {
  const navigate = useNavigate();
  const { tenantId } = useSession();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [users, setUsers] = useState<{ id: string; label: string }[]>([]);
  const [sport, setSport] = useState<BookingSportType>('futsal');
  const [bookingDate, setBookingDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [customerId, setCustomerId] = useState('');
  const [lines, setLines] = useState<LineDraft[]>([defaultLine()]);
  const [courtOpts, setCourtOpts] = useState<
    Awaited<ReturnType<typeof listCourtOptions>>
  >([]);
  const [notes, setNotes] = useState('');
  const [subTotal, setSubTotal] = useState('5000');
  const [discount, setDiscount] = useState('0');
  const [tax, setTax] = useState('0');

  useEffect(() => {
    void (async () => {
      try {
        const rows: IamUserRow[] = await listIamUsers();
        setUsers(
          rows.map((u) => ({
            id: u.id,
            label: `${u.fullName} (${u.email})`,
          })),
        );
      } catch {
        setUsers([]);
      }
    })();
  }, []);

  useEffect(() => {
    void (async () => {
      setCourtOpts(await listCourtOptions(sport));
    })();
  }, [sport]);

  const totalPreview = useMemo(
    () => Number(subTotal || 0) - Number(discount || 0) + Number(tax || 0),
    [subTotal, discount, tax],
  );

  function applyCourtKey(lineIndex: number, key: string) {
    const line = lines[lineIndex];
    if (!line) return;
    if (!key) {
      const next = [...lines];
      next[lineIndex] = { ...line, courtKey: '', courtId: '' };
      setLines(next);
      return;
    }
    const opt = courtOpts.find((o) => `${o.kind}:${o.id}` === key);
    if (!opt) return;
    const next = [...lines];
    next[lineIndex] = {
      ...line,
      courtKey: key,
      courtKind: opt.kind,
      courtId: opt.id,
    };
    setLines(next);
  }

  async function submitCreate() {
    if (!tenantId.trim()) {
      setError('Pick an active tenant in the top bar.');
      return;
    }
    setError(null);
    const st = Number(subTotal);
    const disc = Number(discount);
    const tx = Number(tax);
    const total = st - disc + tx;
    if (!customerId.trim()) {
      setError('Select or enter a customer user ID.');
      return;
    }
    for (const ln of lines) {
      if (!ln.courtId.trim() || !ln.startTime || !ln.endTime) {
        setError('Each line needs court, start, and end time.');
        return;
      }
    }
    setSubmitting(true);
    try {
      const created = await createBooking({
        userId: customerId.trim(),
        sportType: sport,
        bookingDate,
        items: lines.map((ln) => ({
          courtKind: ln.courtKind,
          courtId: ln.courtId.trim(),
          slotId: ln.slotId.trim() || undefined,
          startTime: ln.startTime,
          endTime: ln.endTime,
          price: Number(ln.price),
          currency: ln.currency || 'PKR',
          status: ln.status,
        })),
        pricing: {
          subTotal: st,
          discount: disc,
          tax: tx,
          totalAmount: Math.max(0, total),
        },
        payment: {
          paymentStatus: 'pending',
          paymentMethod: 'cash',
        },
        bookingStatus: 'pending',
        notes: notes.trim() || undefined,
      });
      navigate('/app/bookings', {
        replace: true,
        state: { createdBookingId: created.bookingId },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <p className="page-toolbar">
        <Link to="/app/bookings" className="btn-ghost btn-compact">
          ← Back to bookings
        </Link>
      </p>
      <h1 className="page-title">Add booking</h1>
      {!tenantId.trim() && (
        <div className="err-banner">Pick an active tenant in the top bar.</div>
      )}
      {error && <div className="err-banner">{error}</div>}

      <section className="detail-card" style={{ maxWidth: '980px' }}>
        <div className="form-grid">
          <div className="form-row-2">
            <div>
              <label>Sport</label>
              <select
                value={sport}
                onChange={(e) => setSport(e.target.value as BookingSportType)}
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
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label>Customer</label>
            {users.length > 0 ? (
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
              >
                <option value="">Select…</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                placeholder="User UUID"
              />
            )}
          </div>
          <div>
            <label>Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="form-row-2">
            <div>
              <label>Subtotal</label>
              <input value={subTotal} onChange={(e) => setSubTotal(e.target.value)} />
            </div>
            <div>
              <label>Total preview</label>
              <input readOnly value={String(Math.max(0, totalPreview))} />
            </div>
          </div>
          <div className="form-row-2">
            <div>
              <label>Discount</label>
              <input value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
            <div>
              <label>Tax</label>
              <input value={tax} onChange={(e) => setTax(e.target.value)} />
            </div>
          </div>
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <label style={{ margin: 0 }}>Lines</label>
              <button
                type="button"
                className="btn-ghost"
                style={{ padding: '0.25rem 0.6rem', fontSize: '0.8rem' }}
                onClick={() => setLines((cur) => [...cur, defaultLine()])}
              >
                + Line
              </button>
            </div>
            {lines.map((ln, idx) => (
              <div key={idx} className="item-editor">
                <div className="item-editor-head">
                  <span>Line {idx + 1}</span>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                      onClick={() => setLines((cur) => cur.filter((_, i) => i !== idx))}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <div className="form-grid">
                  {courtOpts.length > 0 && (
                    <div>
                      <label>Court</label>
                      <select
                        value={ln.courtKey}
                        onChange={(e) => applyCourtKey(idx, e.target.value)}
                      >
                        <option value="">Select…</option>
                        {courtOpts.map((o) => (
                          <option key={`${o.kind}:${o.id}`} value={`${o.kind}:${o.id}`}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="form-row-2">
                    <div>
                      <label>Kind</label>
                      <select
                        value={ln.courtKind}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = { ...ln, courtKind: e.target.value as CourtKind };
                          setLines(next);
                        }}
                      >
                        <option value="turf_court">turf_court</option>
                        <option value="futsal_field">futsal_field</option>
                        <option value="padel_court">padel_court</option>
                        <option value="cricket_indoor_court">cricket_indoor_court</option>
                      </select>
                    </div>
                    <div>
                      <label>Court ID</label>
                      <input
                        value={ln.courtId}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = { ...ln, courtId: e.target.value, courtKey: '' };
                          setLines(next);
                        }}
                      />
                    </div>
                  </div>
                  <div className="form-row-2">
                    <div>
                      <label>Start</label>
                      <input
                        value={ln.startTime}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = { ...ln, startTime: e.target.value };
                          setLines(next);
                        }}
                      />
                    </div>
                    <div>
                      <label>End</label>
                      <input
                        value={ln.endTime}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = { ...ln, endTime: e.target.value };
                          setLines(next);
                        }}
                      />
                    </div>
                  </div>
                  <div className="form-row-2">
                    <div>
                      <label>Price</label>
                      <input
                        value={ln.price}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = { ...ln, price: e.target.value };
                          setLines(next);
                        }}
                      />
                    </div>
                    <div>
                      <label>Item status</label>
                      <select
                        value={ln.status}
                        onChange={(e) => {
                          const next = [...lines];
                          next[idx] = {
                            ...ln,
                            status: e.target.value as BookingItemStatus,
                          };
                          setLines(next);
                        }}
                      >
                        <option value="reserved">reserved</option>
                        <option value="confirmed">confirmed</option>
                        <option value="cancelled">cancelled</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="page-actions-row">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => navigate('/app/bookings')}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => void submitCreate()}
            disabled={submitting || !tenantId.trim()}
          >
            {submitting ? 'Creating…' : 'Create booking'}
          </button>
        </div>
      </section>
    </div>
  );
}
