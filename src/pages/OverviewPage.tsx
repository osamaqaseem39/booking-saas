import { useSession } from '../context/SessionContext';

export default function OverviewPage() {
  const { session, tenantId } = useSession();

  return (
    <div>
      <h1 className="page-title">Overview</h1>
      <div className="connection-panel" style={{ margin: 0 }}>
        <div className="detail-row">
          <span>Signed in as</span>
          <span>
            {session?.fullName} ({session?.email})
          </span>
        </div>
        <div className="detail-row">
          <span>User ID</span>
          <span>{session?.id}</span>
        </div>
        <div className="detail-row">
          <span>Roles</span>
          <span>{session?.roles?.join(', ') || '—'}</span>
        </div>
        <div className="detail-row">
          <span>Active tenant</span>
          <span>{tenantId || '—'}</span>
        </div>
      </div>
      <p className="muted" style={{ marginTop: '1rem' }}>
        Platform owners also get <strong>Locations</strong> (all businesses,
        each with a <strong>location type</strong>) and{' '}
        <strong>End users</strong> (accounts with the customer role). Other
        menu items depend on your roles.
      </p>
    </div>
  );
}
