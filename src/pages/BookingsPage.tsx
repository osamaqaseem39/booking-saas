import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createBooking,
  listBookings,
  listCourtOptions,
  listIamUsers,
  updateBooking,
} from '../api/saasClient';
import { useSession } from '../context/SessionContext';
import type {
  BookingItemStatus,
  BookingRecord,
  BookingSportType,
  BookingStatus,
  CourtKind,
  PaymentMethod,
  PaymentStatus,
} from '../types/booking';
import type { IamUserRow } from '../types/domain';

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

export default function BookingsPage() {
  const { tenantId } = useSession();
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [users, setUsers] = useState<{ id: string; label: string }[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
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
    if (!createOpen) return;
    void (async () => {
      setCourtOpts(await listCourtOptions(sport));
    })();
  }, [createOpen, sport]);

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
    if (opt) {
      const next = [...lines];
      next[lineIndex] = {
        ...line,
        courtKey: key,
        courtKind: opt.kind,
        courtId: opt.id,
      };
      setLines(next);
    }
  }

  async function submitCreate() {
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
    try {
      await createBooking({
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
      setCreateOpen(false);
      setLines([defaultLine()]);
      setNotes('');
      void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    }
  }

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

  const totalPreview =
    Number(subTotal || 0) - Number(discount || 0) + Number(tax || 0);

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
            onClick={() => setCreateOpen(true)}
            disabled={!tenantId.trim()}
          >
            Add booking
          </button>
        </div>
      </div>
      {error && <div className="err-banner">{error}</div>}

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

      {createOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCreateOpen(false);
          }}
        >
          <div className="modal" role="dialog">
            <h2>New booking</h2>
            <div className="form-grid">
              <div className="form-row-2">
                <div>
                  <label>Sport</label>
                  <select
                    value={sport}
                    onChange={(e) =>
                      setSport(e.target.value as BookingSportType)
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
                    onClick={() => setLines((L) => [...L, defaultLine()])}
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
                          onClick={() =>
                            setLines((L) => L.filter((_, i) => i !== idx))
                          }
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
                              <option
                                key={`${o.kind}:${o.id}`}
                                value={`${o.kind}:${o.id}`}
                              >
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
                              next[idx] = {
                                ...ln,
                                courtKind: e.target.value as CourtKind,
                              };
                              setLines(next);
                            }}
                          >
                            <option value="turf_court">turf_court</option>
                            <option value="futsal_field">futsal_field</option>
                            <option value="padel_court">padel_court</option>
                            <option value="cricket_indoor_court">
                              cricket_indoor_court
                            </option>
                          </select>
                        </div>
                        <div>
                          <label>Court ID</label>
                          <input
                            value={ln.courtId}
                            onChange={(e) => {
                              const next = [...lines];
                              next[idx] = {
                                ...ln,
                                courtId: e.target.value,
                                courtKey: '',
                              };
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
            <div className="modal-footer">
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => void submitCreate()}
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
