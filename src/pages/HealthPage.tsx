import { useEffect, useState } from 'react';
import { fetchHealth } from '../api/saasClient';

export default function HealthPage() {
  const [data, setData] = useState<{ status: string; service: string } | null>(
    null,
  );
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        setData(await fetchHealth());
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Unreachable');
      }
    })();
  }, []);

  return (
    <div>
      <h1 className="page-title">API health</h1>
      {err && <div className="err-banner">{err}</div>}
      {data && (
        <div className="connection-panel" style={{ margin: 0 }}>
          <div className="detail-row">
            <span>Status</span>
            <span>{data.status}</span>
          </div>
          <div className="detail-row">
            <span>Service</span>
            <span>{data.service}</span>
          </div>
        </div>
      )}
    </div>
  );
}
