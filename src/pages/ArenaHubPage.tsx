import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getArenaMeta,
  listCricketIndoor,
  listFutsalFields,
  listPadelCourts,
  listTurfCourts,
} from '../api/saasClient';
import type { NamedCourt } from '../types/domain';

export default function ArenaHubPage() {
  const [meta, setMeta] = useState<unknown>(null);
  const [turf, setTurf] = useState<NamedCourt[]>([]);
  const [futsal, setFutsal] = useState<NamedCourt[]>([]);
  const [padel, setPadel] = useState<NamedCourt[]>([]);
  const [cricket, setCricket] = useState<NamedCourt[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setErr(null);
      try {
        const m = await getArenaMeta();
        setMeta(m);
        const [tu, fu, pa, cr] = await Promise.all([
          listTurfCourts(),
          listFutsalFields(),
          listPadelCourts(),
          listCricketIndoor(),
        ]);
        setTurf(tu);
        setFutsal(fu);
        setPadel(pa);
        setCricket(cr);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Failed to load arena data');
      }
    })();
  }, []);

  function Table({ title, rows }: { title: string; rows: NamedCourt[] }) {
    return (
      <div style={{ marginBottom: '1.25rem' }}>
        <h3 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>{title}</h3>
        <div className="table-wrap">
          {rows.length === 0 ? (
            <div className="empty-state">None</div>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>ID</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>
                      <code style={{ fontSize: '0.7rem' }}>{r.id}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Arena courts</h1>
      <p className="muted">
        Lists use your session headers and active tenant. Courts are tied to a{' '}
        <strong>business location</strong>; use{' '}
        <code>?businessLocationId=</code> on each list call to scope a venue, or
        open <Link to="/app/locations">Locations → Manage</Link> for the hub UI.
        Mutations require <code>platform-owner</code> or{' '}
        <code>business-admin</code>.
      </p>
      {err && <div className="err-banner">{err}</div>}
      <h3 style={{ fontSize: '1rem' }}>Meta</h3>
      <pre className="code-block" style={{ marginBottom: '1.5rem' }}>
        {JSON.stringify(meta, null, 2)}
      </pre>
      <Table title="Turf courts" rows={turf} />
      <Table title="Futsal fields" rows={futsal} />
      <Table title="Padel courts" rows={padel} />
      <Table title="Cricket indoor" rows={cricket} />
    </div>
  );
}
