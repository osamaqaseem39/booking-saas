import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  getBusinessDashboardView,
  listBusinessLocations,
  listBusinesses,
  listBookingsForTenant,
  listInvoicesForTenant,
} from '../api/saasClient';
import type { BookingRecord } from '../types/booking';
import type {
  BusinessDashboardBusinessRow,
  BusinessLocationRow,
  BusinessRow,
  InvoiceRow,
} from '../types/domain';

type Counts = {
  locations: number;
  users: number;
  bookings: number;
  invoices: number;
};

function formatMoney(value: number, currency?: string): string {
  const n = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  return currency ? `${n} ${currency}` : n;
}

function aggregateBookings(bookings: BookingRecord[]) {
  const byStatus: Record<string, number> = {};
  const byPaymentStatus: Record<string, number> = {};
  let totalAmount = 0;
  let paidAmount = 0;
  let pendingPaymentAmount = 0;
  let failedAmount = 0;
  let refundedAmount = 0;
  const bySport: Record<string, { count: number; amount: number }> = {};

  for (const b of bookings) {
    const st = b.bookingStatus ?? 'unknown';
    byStatus[st] = (byStatus[st] ?? 0) + 1;
    const pStatus = b.payment?.paymentStatus ?? 'unknown';
    byPaymentStatus[pStatus] = (byPaymentStatus[pStatus] ?? 0) + 1;
    const amt = Number(b.pricing?.totalAmount ?? 0);
    totalAmount += amt;
    const sport = b.sportType ?? 'unknown';
    if (!bySport[sport]) bySport[sport] = { count: 0, amount: 0 };
    bySport[sport].count += 1;
    bySport[sport].amount += amt;

    switch (pStatus) {
      case 'paid':
        paidAmount += amt;
        break;
      case 'pending':
        pendingPaymentAmount += amt;
        break;
      case 'failed':
        failedAmount += amt;
        break;
      case 'refunded':
        refundedAmount += amt;
        break;
      default:
        break;
    }
  }

  const currency =
    bookings[0]?.items?.[0]?.currency?.trim() ||
    undefined;

  return {
    byStatus,
    byPaymentStatus,
    totalAmount,
    paidAmount,
    pendingPaymentAmount,
    failedAmount,
    refundedAmount,
    bySport,
    currency,
  };
}

function aggregateInvoices(invoices: InvoiceRow[]) {
  const byStatus: Record<string, number> = {};
  let totalAmount = 0;
  for (const inv of invoices) {
    const amount = Number(inv.amount ?? 0);
    totalAmount += amount;
    const st = (inv.status ?? 'unknown').toLowerCase();
    byStatus[st] = (byStatus[st] ?? 0) + amount;
  }
  return { byStatus, totalAmount, count: invoices.length };
}

function toProperCase(value?: string | null): string {
  if (!value) return '—';
  return value
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

export default function BusinessTenantStatsPage() {
  const { businessId = '' } = useParams();
  const [business, setBusiness] = useState<BusinessRow | null>(null);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [businessLocations, setBusinessLocations] = useState<BusinessLocationRow[]>([]);
  const [dashboardRow, setDashboardRow] = useState<BusinessDashboardBusinessRow | null>(
    null,
  );
  const [counts, setCounts] = useState<Counts>({
    locations: 0,
    users: 0,
    bookings: 0,
    invoices: 0,
  });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const membershipCount = useMemo(
    () => business?.memberships?.length ?? 0,
    [business],
  );

  const bookingAgg = useMemo(() => aggregateBookings(bookings), [bookings]);
  const invoiceAgg = useMemo(() => aggregateInvoices(invoices), [invoices]);
  const displayCurrency =
    business?.settings?.currency?.trim() ||
    bookingAgg.currency ||
    invoices[0]?.currency ||
    '';

  useEffect(() => {
    if (!businessId.trim()) return;
    void (async () => {
      setLoading(true);
      setErr(null);
      try {
        const businesses = await listBusinesses();
        const selected = businesses.find((b) => b.id === businessId) ?? null;
        setBusiness(selected);
        if (!selected) {
          setBookings([]);
          setInvoices([]);
          setBusinessLocations([]);
          setDashboardRow(null);
          setCounts({ locations: 0, users: 0, bookings: 0, invoices: 0 });
          return;
        }

        const [locations, bookingRows, invoiceRows, dashboardView] = await Promise.all([
          listBusinessLocations(),
          listBookingsForTenant(selected.tenantId),
          listInvoicesForTenant(selected.tenantId),
          getBusinessDashboardView().catch(() => null),
        ]);
        setBookings(bookingRows);
        setInvoices(invoiceRows);
        setBusinessLocations(locations.filter((row) => row.businessId === selected.id));
        const dashBiz =
          dashboardView?.businesses?.find((b) => b.businessId === selected.id) ?? null;
        setDashboardRow(dashBiz);
        setCounts({
          locations: locations.filter((row) => row.businessId === selected.id).length,
          users: selected.memberships?.length ?? 0,
          bookings: bookingRows.length,
          invoices: invoiceRows.length,
        });
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load tenant stats');
      } finally {
        setLoading(false);
      }
    })();
  }, [businessId]);

  return (
    <div>
      <Link to="/app/businesses" className="btn-ghost btn-compact">
        Back to businesses
      </Link>

      <h1 className="page-title" style={{ marginTop: '1rem' }}>
        {business?.businessName ?? 'Business'}
      </h1>
      <p className="muted" style={{ marginTop: '-0.25rem' }}>
        Profile, revenue and booking metrics, invoices, and footprint for this tenant.
      </p>

      {err && <div className="err-banner">{err}</div>}

      {loading ? (
        <div className="empty-state">Loading business…</div>
      ) : (
        <>
          <section className="connection-panel business-profile-card" style={{ margin: 0 }}>
            <div className="business-profile-card__head">
              <h2>Business profile</h2>
              <p className="muted">Core identity, ownership, and billing setup.</p>
            </div>
            <div className="business-profile-grid">
              <div className="business-profile-item">
                <span className="business-profile-item__label">Legal name</span>
                <strong className="business-profile-item__value">
                  {business?.legalName?.trim() || '—'}
                </strong>
              </div>
              <div className="business-profile-item">
                <span className="business-profile-item__label">Type</span>
                <strong className="business-profile-item__value">
                  {toProperCase(business?.businessType)}
                </strong>
              </div>
              <div className="business-profile-item">
                <span className="business-profile-item__label">Status</span>
                <strong className="business-profile-item__value">
                  {toProperCase(business?.status ?? 'active')}
                </strong>
              </div>
              <div className="business-profile-item">
                <span className="business-profile-item__label">Tenant ID</span>
                <strong className="business-profile-item__value business-profile-item__value--code">
                  <code>{business?.tenantId ?? '—'}</code>
                </strong>
              </div>
              <div className="business-profile-item">
                <span className="business-profile-item__label">Created</span>
                <strong className="business-profile-item__value">
                  {business?.createdAt
                    ? new Date(business.createdAt).toLocaleString()
                    : '—'}
                </strong>
              </div>
              <div className="business-profile-item">
                <span className="business-profile-item__label">Sports offered</span>
                <strong className="business-profile-item__value">
                  {business?.sportsOffered?.length
                    ? business.sportsOffered.map(toProperCase).join(', ')
                    : '—'}
                </strong>
              </div>
              <div className="business-profile-item business-profile-item--wide">
                <span className="business-profile-item__label">Owner</span>
                <strong className="business-profile-item__value">
                  {business?.owner?.name || business?.owner?.email || business?.owner?.phone
                    ? [
                        business.owner?.name,
                        business.owner?.email,
                        business.owner?.phone,
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    : '—'}
                </strong>
              </div>
              <div className="business-profile-item business-profile-item--wide">
                <span className="business-profile-item__label">Subscription</span>
                <strong className="business-profile-item__value">
                  {business?.subscription
                    ? [
                        business.subscription.plan,
                        business.subscription.status,
                        business.subscription.billingCycle,
                      ]
                        .filter(Boolean)
                        .join(' · ') || '—'
                    : '—'}
                </strong>
              </div>
              <div className="business-profile-item business-profile-item--wide">
                <span className="business-profile-item__label">Settings</span>
                <strong className="business-profile-item__value">
                  {business?.settings
                    ? [
                        business.settings.timezone
                          ? `TZ ${business.settings.timezone}`
                          : null,
                        business.settings.currency
                          ? business.settings.currency
                          : null,
                        business.settings.allowOnlinePayments != null
                          ? `Online payments ${business.settings.allowOnlinePayments ? 'on' : 'off'}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || '—'
                    : '—'}
                </strong>
              </div>
            </div>
          </section>

          <h2 className="page-title" style={{ marginTop: '1.25rem', fontSize: '1.1rem' }}>
            Revenue & bookings
          </h2>
          <p className="muted" style={{ marginTop: '0.15rem', marginBottom: '0.65rem' }}>
            Snapshot from the platform dashboard API (when available), plus totals computed from
            booking and invoice lists for this tenant.
          </p>

          {dashboardRow ? (
            <div className="connection-grid" style={{ marginTop: '0.5rem' }}>
              <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
                <h2>Revenue (total)</h2>
                <strong style={{ fontSize: '1.25rem' }}>
                  {formatMoney(dashboardRow.revenueTotal, displayCurrency)}
                </strong>
              </div>
              <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
                <h2>Revenue (paid)</h2>
                <strong style={{ fontSize: '1.25rem' }}>
                  {formatMoney(dashboardRow.revenuePaid, displayCurrency)}
                </strong>
              </div>
              <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
                <h2>Outstanding</h2>
                <strong style={{ fontSize: '1.25rem' }}>
                  {formatMoney(
                    Math.max(0, dashboardRow.revenueTotal - dashboardRow.revenuePaid),
                    displayCurrency,
                  )}
                </strong>
              </div>
              <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
                <h2>Bookings (all)</h2>
                <strong style={{ fontSize: '1.25rem' }}>{dashboardRow.bookingCount}</strong>
              </div>
              <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
                <h2>Confirmed</h2>
                <strong style={{ fontSize: '1.25rem' }}>
                  {dashboardRow.confirmedBookingCount}
                </strong>
              </div>
              <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
                <h2>Pending</h2>
                <strong style={{ fontSize: '1.25rem' }}>{dashboardRow.pendingBookingCount}</strong>
              </div>
              <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
                <h2>Cancelled</h2>
                <strong style={{ fontSize: '1.25rem' }}>
                  {dashboardRow.cancelledBookingCount}
                </strong>
              </div>
              <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
                <h2>Locations</h2>
                <strong style={{ fontSize: '1.25rem' }}>{dashboardRow.locationCount}</strong>
              </div>
              <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
                <h2>Courts</h2>
                <strong style={{ fontSize: '1.25rem' }}>{dashboardRow.courtCount}</strong>
              </div>
            </div>
          ) : (
            <div className="connection-panel muted" style={{ marginTop: '0.5rem' }}>
              Dashboard snapshot not available for this business (API returned no matching row or
              the request failed). Figures below are from live booking and invoice lists only.
            </div>
          )}

          <h2 className="page-title" style={{ marginTop: '1.35rem', fontSize: '1.1rem' }}>
            Booking value & payments
          </h2>
          <div className="connection-grid" style={{ marginTop: '0.5rem' }}>
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>Booking value (sum)</h2>
              <strong style={{ fontSize: '1.25rem' }}>
                {formatMoney(bookingAgg.totalAmount, displayCurrency)}
              </strong>
            </div>
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>Collected</h2>
              <strong style={{ fontSize: '1.25rem' }}>
                {formatMoney(bookingAgg.paidAmount, displayCurrency)}
              </strong>
            </div>
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>Pending payment</h2>
              <strong style={{ fontSize: '1.25rem' }}>
                {formatMoney(bookingAgg.pendingPaymentAmount, displayCurrency)}
              </strong>
            </div>
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>Failed / refunded</h2>
              <strong style={{ fontSize: '1.1rem' }}>
                {formatMoney(bookingAgg.failedAmount + bookingAgg.refundedAmount, displayCurrency)}
              </strong>
            </div>
          </div>

          <div
            className="connection-panel"
            style={{ marginTop: '1rem', padding: '0.9rem 1rem' }}
          >
            <h3 style={{ margin: '0 0 0.65rem', fontSize: '0.95rem' }}>Bookings by status</h3>
            {Object.keys(bookingAgg.byStatus).length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                No bookings yet.
              </p>
            ) : (
              <table className="data data--noninteractive" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(bookingAgg.byStatus)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([status, n]) => (
                      <tr key={status}>
                        <td>{toProperCase(status)}</td>
                        <td>{n}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>

          <div
            className="connection-panel"
            style={{ marginTop: '0.75rem', padding: '0.9rem 1rem' }}
          >
            <h3 style={{ margin: '0 0 0.65rem', fontSize: '0.95rem' }}>Payments by status</h3>
            {Object.keys(bookingAgg.byPaymentStatus).length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                No payment rows.
              </p>
            ) : (
              <table className="data data--noninteractive" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Payment</th>
                    <th>Bookings</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(bookingAgg.byPaymentStatus)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([status, n]) => (
                      <tr key={status}>
                        <td>{toProperCase(status)}</td>
                        <td>{n}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>

          <div
            className="connection-panel"
            style={{ marginTop: '0.75rem', padding: '0.9rem 1rem' }}
          >
            <h3 style={{ margin: '0 0 0.65rem', fontSize: '0.95rem' }}>By sport</h3>
            {Object.keys(bookingAgg.bySport).length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                No sport breakdown.
              </p>
            ) : (
              <table className="data data--noninteractive" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Sport</th>
                    <th>Bookings</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(bookingAgg.bySport)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([sport, row]) => (
                      <tr key={sport}>
                        <td>{toProperCase(sport)}</td>
                        <td>{row.count}</td>
                        <td>{formatMoney(row.amount, displayCurrency)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>

          <h2 className="page-title" style={{ marginTop: '1.35rem', fontSize: '1.1rem' }}>
            Invoices & billing
          </h2>
          <div className="connection-grid" style={{ marginTop: '0.5rem' }}>
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>Invoices</h2>
              <strong style={{ fontSize: '1.25rem' }}>{invoiceAgg.count}</strong>
            </div>
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>Invoice total</h2>
              <strong style={{ fontSize: '1.25rem' }}>
                {formatMoney(invoiceAgg.totalAmount, displayCurrency)}
              </strong>
            </div>
          </div>
          {Object.keys(invoiceAgg.byStatus).length > 0 ? (
            <div
              className="connection-panel"
              style={{ marginTop: '0.75rem', padding: '0.9rem 1rem' }}
            >
              <h3 style={{ margin: '0 0 0.65rem', fontSize: '0.95rem' }}>Amount by invoice status</h3>
              <table className="data data--noninteractive" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(invoiceAgg.byStatus)
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([status, amount]) => (
                      <tr key={status}>
                        <td>{toProperCase(status)}</td>
                        <td>{formatMoney(amount, displayCurrency)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <h2 className="page-title" style={{ marginTop: '1.35rem', fontSize: '1.1rem' }}>
            People & footprint
          </h2>
          <div className="connection-grid" style={{ marginTop: '0.5rem' }}>
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>Members</h2>
              <strong style={{ fontSize: '1.25rem' }}>{membershipCount}</strong>
            </div>
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>Locations</h2>
              <strong style={{ fontSize: '1.25rem' }}>{counts.locations}</strong>
            </div>
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>Users</h2>
              <strong style={{ fontSize: '1.25rem' }}>{counts.users}</strong>
            </div>
            <div className="connection-panel" style={{ margin: 0, padding: '0.9rem 1rem' }}>
              <h2>Bookings (list)</h2>
              <strong style={{ fontSize: '1.25rem' }}>{counts.bookings}</strong>
            </div>
          </div>

          <div
            className="connection-panel"
            style={{ marginTop: '1rem', padding: '0.9rem 1rem' }}
          >
            <h3 style={{ margin: '0 0 0.65rem', fontSize: '0.95rem' }}>Business locations</h3>
            {businessLocations.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                No locations found for this business.
              </p>
            ) : (
              <table className="data data--noninteractive" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Location</th>
                    <th>City</th>
                    <th>Type</th>
                    <th>Facilities</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {businessLocations.map((loc) => (
                    <tr key={loc.id}>
                      <td>{loc.name}</td>
                      <td>{loc.city ?? '—'}</td>
                      <td>{toProperCase(loc.locationType)}</td>
                      <td>{loc.facilityCourts?.length ?? 0}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <Link to={`/app/locations/${loc.id}`} className="action-link">
                            View
                          </Link>
                          <Link to="/app/Facilites" className="action-link">
                            Facilities
                          </Link>
                          <Link
                            to={`/app/bookings/new?locationId=${encodeURIComponent(loc.id)}`}
                            className="action-link"
                          >
                            Add booking
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="page-actions-row" style={{ marginTop: '0.75rem', flexWrap: 'wrap' }}>
            <Link to="/app/bookings" className="btn-ghost">
              Open bookings
            </Link>
            <Link to="/app/billing" className="btn-ghost">
              Open billing
            </Link>
            {business ? (
              <Link to={`/app/businesses/${business.id}/edit`} className="btn-primary">
                Edit business
              </Link>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
