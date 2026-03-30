import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  createCricketIndoorCourt,
  createFutsalField,
  createPadelCourt,
  createTurfCourt,
  deleteCricketIndoorCourt,
  deleteFutsalField,
  deletePadelCourt,
  deleteTurfCourt,
  getArenaMeta,
  listBusinessLocations,
  listCricketIndoor,
  listFutsalFields,
  listPadelCourts,
  listTurfCourts,
  updateCricketIndoorCourt,
  updateFutsalField,
  updatePadelCourt,
  updateTurfCourt,
} from '../api/saasClient';
import type { NamedCourt } from '../types/domain';

export default function ArenaHubPage() {
  const [meta, setMeta] = useState<unknown>(null);
  const [turf, setTurf] = useState<NamedCourt[]>([]);
  const [futsal, setFutsal] = useState<NamedCourt[]>([]);
  const [padel, setPadel] = useState<NamedCourt[]>([]);
  const [cricket, setCricket] = useState<NamedCourt[]>([]);
  const [locationId, setLocationId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function reload() {
    setErr(null);
    try {
      const m = await getArenaMeta();
      setMeta(m);
      const [tu, fu, pa, cr, locs] = await Promise.all([
        listTurfCourts(),
        listFutsalFields(),
        listPadelCourts(),
        listCricketIndoor(),
        listBusinessLocations(),
      ]);
      setTurf(tu);
      setFutsal(fu);
      setPadel(pa);
      setCricket(cr);
      if (!locationId.trim() && locs.length > 0) {
        setLocationId(locs[0]?.id ?? '');
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to load arena data');
    }
  }

  useEffect(() => {
    void (async () => {
      await reload();
    })();
  }, []);

  async function renameCourt(
    kind: 'turf' | 'futsal' | 'padel' | 'cricket',
    row: NamedCourt,
  ) {
    const name = window.prompt('New name', row.name)?.trim();
    if (!name) return;
    setBusy(true);
    setErr(null);
    try {
      if (kind === 'turf') await updateTurfCourt(row.id, { name });
      if (kind === 'futsal') await updateFutsalField(row.id, { name });
      if (kind === 'padel') await updatePadelCourt(row.id, { name });
      if (kind === 'cricket') await updateCricketIndoorCourt(row.id, { name });
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function deleteCourt(kind: 'turf' | 'futsal' | 'padel' | 'cricket', id: string) {
    const yes = window.confirm('Delete this court? This cannot be undone.');
    if (!yes) return;
    setBusy(true);
    setErr(null);
    try {
      if (kind === 'turf') await deleteTurfCourt(id);
      if (kind === 'futsal') await deleteFutsalField(id);
      if (kind === 'padel') await deletePadelCourt(id);
      if (kind === 'cricket') await deleteCricketIndoorCourt(id);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

  async function addCourt(kind: 'turf' | 'futsal' | 'padel' | 'cricket') {
    if (!locationId.trim()) {
      setErr('Pick a location ID first.');
      return;
    }
    const name = window.prompt('Court name')?.trim();
    if (!name) return;
    setBusy(true);
    setErr(null);
    try {
      if (kind === 'turf') {
        await createTurfCourt({ businessLocationId: locationId.trim(), name, sportMode: 'both' });
      }
      if (kind === 'futsal') {
        await createFutsalField({ businessLocationId: locationId.trim(), name });
      }
      if (kind === 'padel') {
        await createPadelCourt({ businessLocationId: locationId.trim(), name });
      }
      if (kind === 'cricket') {
        await createCricketIndoorCourt({ businessLocationId: locationId.trim(), name });
      }
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  function Table({
    title,
    rows,
    kind,
  }: {
    title: string;
    rows: NamedCourt[];
    kind: 'turf' | 'futsal' | 'padel' | 'cricket';
  }) {
    return (
      <div style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
          <h3 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>{title}</h3>
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void addCourt(kind)}>
            Add
          </button>
        </div>
        <div className="table-wrap">
          {rows.length === 0 ? (
            <div className="empty-state">None</div>
          ) : (
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>ID</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>
                      <code style={{ fontSize: '0.7rem' }}>{r.id}</code>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn-ghost"
                          style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                          disabled={busy}
                          onClick={() => void renameCourt(kind, r)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-danger"
                          style={{ padding: '0.2rem 0.45rem', fontSize: '0.75rem' }}
                          disabled={busy}
                          onClick={() => void deleteCourt(kind, r.id)}
                        >
                          Delete
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
      <div className="form-row-2" style={{ maxWidth: '660px', marginBottom: '1rem' }}>
        <div>
          <label>Default location ID for add actions</label>
          <input value={locationId} onChange={(e) => setLocationId(e.target.value)} placeholder="Location UUID" />
        </div>
        <div style={{ alignSelf: 'end' }}>
          <button type="button" className="btn-ghost" onClick={() => void reload()} disabled={busy}>
            Refresh lists
          </button>
        </div>
      </div>
      <h3 style={{ fontSize: '1rem' }}>Meta</h3>
      <pre className="code-block" style={{ marginBottom: '1.5rem' }}>
        {JSON.stringify(meta, null, 2)}
      </pre>
      <Table title="Turf courts" rows={turf} kind="turf" />
      <Table title="Futsal fields" rows={futsal} kind="futsal" />
      <Table title="Padel courts" rows={padel} kind="padel" />
      <Table title="Cricket indoor" rows={cricket} kind="cricket" />
    </div>
  );
}
