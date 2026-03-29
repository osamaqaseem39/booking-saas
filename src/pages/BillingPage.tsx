import { useEffect, useState } from 'react';
import { issueInvoice, listInvoices } from '../api/saasClient';
import type { InvoiceRow } from '../types/domain';

export default function BillingPage() {
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState('');
  const [amount, setAmount] = useState('1000');

  const load = () => {
    void (async () => {
      setErr(null);
      try {
        setRows(await listInvoices());
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load invoices');
      }
    })();
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <h1 className="page-title">Billing</h1>
      <p className="muted">
        In-memory invoices per API process. Scoped by active tenant.
      </p>
      {err && <div className="err-banner">{err}</div>}
      <div className="form-row-2" style={{ maxWidth: '480px', marginBottom: '1rem' }}>
        <div>
          <label>Booking ID</label>
          <input value={bookingId} onChange={(e) => setBookingId(e.target.value)} />
        </div>
        <div>
          <label>Amount (PKR)</label>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
      </div>
      <button
        type="button"
        className="btn-primary"
        style={{ marginBottom: '1rem' }}
        onClick={() => {
          void (async () => {
            try {
              await issueInvoice({
                bookingId: bookingId.trim(),
                amount: Number(amount),
              });
              setBookingId('');
              load();
            } catch (e) {
              setErr(e instanceof Error ? e.message : 'Issue failed');
            }
          })();
        }}
      >
        Issue invoice
      </button>
      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="empty-state">No invoices for this tenant.</div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>Booking</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <code style={{ fontSize: '0.7rem' }}>{r.id.slice(0, 8)}…</code>
                  </td>
                  <td>
                    <code style={{ fontSize: '0.7rem' }}>
                      {r.bookingId.slice(0, 8)}…
                    </code>
                  </td>
                  <td>
                    {r.amount} {r.currency}
                  </td>
                  <td>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
