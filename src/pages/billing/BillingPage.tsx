import { useCallback, useEffect, useState } from 'react';
import {
  issueInvoice,
  listBusinesses,
  listInvoices,
  listInvoicesForTenant,
} from '../../api/saasClient';
import { useSession } from '../../context/SessionContext';
import type { InvoiceRow } from '../../types/domain';

export default function BillingPage() {
  const { tenantId, session } = useSession();
  const isPlatformOwner = session?.roles?.includes('platform-owner') ?? false;
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState('');
  const [amount, setAmount] = useState('1000');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(() => {
    void (async () => {
      setErr(null);
      try {
        if (isPlatformOwner) {
          const biz = await listBusinesses();
          const chunks = await Promise.all(
            biz.map((b) =>
              listInvoicesForTenant(b.tenantId).catch(() => [] as InvoiceRow[]),
            ),
          );
          const merged = chunks.flat();
          merged.sort((a, b) => a.id.localeCompare(b.id));
          setRows(merged);
        } else {
          if (!tenantId.trim()) {
            setRows([]);
            return;
          }
          setRows(await listInvoices());
        }
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load invoices');
      }
    })();
  }, [isPlatformOwner, tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <h1 className="page-title">Billing</h1>
      <p className="muted">
        In-memory invoices per API process.{' '}
        {isPlatformOwner
          ? 'As platform owner, the table merges invoices from all businesses.'
          : 'Scoped by active tenant.'}
      </p>
      {err && <div className="err-banner">{err}</div>}
      <div className="toolbar" style={{ marginBottom: '0.75rem' }}>
        <span className="muted">{rows.length} invoice(s)</span>
        <button type="button" className="btn-ghost" onClick={load}>
          Refresh
        </button>
      </div>
      <div className="form-row-2" style={{ maxWidth: '480px', marginBottom: '0.5rem' }}>
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
        Add invoice
      </button>
      <div className="table-wrap">
        {rows.length === 0 ? (
          <div className="empty-state">
            {isPlatformOwner
              ? 'No invoices across businesses.'
              : 'No invoices for this tenant.'}
          </div>
        ) : (
          <table className="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>Booking</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
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
                  <td>
                    <button
                      type="button"
                      className="btn-ghost"
                      style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                      onClick={() => setSelectedId(r.id)}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {selectedId && (
        <div className="connection-panel" style={{ marginTop: '1rem' }}>
          <div className="detail-row">
            <span>Selected invoice</span>
            <span>{selectedId}</span>
          </div>
          <div className="detail-row">
            <span>Booking ID</span>
            <span>{rows.find((r) => r.id === selectedId)?.bookingId ?? '—'}</span>
          </div>
        </div>
      )}
    </div>
  );
}

