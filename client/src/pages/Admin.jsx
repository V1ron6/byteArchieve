import { useCallback, useEffect, useState } from 'react';
import { Ban, Check, Eye, RotateCcw, Trash2, X } from 'lucide-react';
import { api, openFile, fmtDate } from '../api.js';
import { FileRow, FileRowSkeleton, Empty, ErrorMsg, useToast } from '../ui.jsx';

const TABS = ['pending', 'approved', 'rejected', 'users'];

export default function Admin() {
  const toast = useToast();
  const [tab, setTab] = useState('pending');
  const [stats, setStats] = useState(null);
  const [files, setFiles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, list] = await Promise.all([
        api('/admin/stats'),
        tab === 'users' ? api('/admin/users') : api(`/admin/files?status=${tab}`),
      ]);
      setStats(s);
      tab === 'users' ? setUsers(list.users) : setFiles(list.files);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  // switching tabs clears the old list so files never show under the wrong tab
  useEffect(() => {
    setLoading(true);
    setFiles([]);
    setUsers([]);
    load();
  }, [load]);

  const act = async (fn, message) => {
    try {
      await fn();
      if (message) toast(message, 'success');
      await load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const review = (id, status) => {
    const note = status === 'rejected' ? prompt('Reason (optional, shown to the uploader):') : null;
    if (status === 'rejected' && note === null) return;
    act(
      () => api(`/admin/files/${id}`, { method: 'PATCH', body: { status, note } }),
      status === 'approved' ? 'File approved and now public' : 'File rejected'
    );
  };
  const del = (id) => confirm('Permanently delete this file?') && act(() => api(`/admin/files/${id}`, { method: 'DELETE' }), 'File deleted');
  const ban = (u) =>
    act(() => api(`/admin/users/${u.id}`, { method: 'PATCH', body: { banned: !u.banned } }), u.banned ? `${u.username} restored` : `${u.username} suspended`);

  const count = (k) => stats?.files?.[k]?.count ?? 0;

  return (
    <section className="admin">
      <h1>Review queue</h1>

      <div className="stats">
        <div className="stat feature"><span>Pending review</span><b>{count('pending')}</b></div>
        <div className="stat"><span>Approved</span><b className="success">{count('approved')}</b></div>
        <div className="stat"><span>Rejected</span><b className="danger">{count('rejected')}</b></div>
        <div className="stat"><span>Users</span><b>{stats?.users ?? 0}</b></div>
      </div>

      <div className="tabs" role="tablist" aria-label="Review sections">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <ErrorMsg error={error} />

      {tab !== 'users' && (
        <div className="queue">
          {loading && [0, 1, 2].map((i) => <FileRowSkeleton key={i} />)}
          {!loading && !files.length && !error && <Empty>Nothing here.</Empty>}
          {files.map((f) => (
            <FileRow key={f.id} file={f} meta={`Uploaded by ${f.uploader}  ·  ${fmtDate(f.created_at)}${f.review_note ? `  ·  Note: ${f.review_note}` : ''}`}>
              <button className="btn ghost" onClick={() => openFile(f.id).catch((e) => toast(e.message, 'error'))}><Eye size={15} /> Preview</button>
              {f.status !== 'rejected' && <button className="btn ghost" onClick={() => review(f.id, 'rejected')}><X size={15} /> Reject</button>}
              {f.status !== 'approved' && <button className="btn" onClick={() => review(f.id, 'approved')}><Check size={15} /> Approve</button>}
              <button className="btn ghost danger" onClick={() => del(f.id)} aria-label="Delete"><Trash2 size={15} /></button>
            </FileRow>
          ))}
        </div>
      )}

      {tab === 'users' && (
        <div className="queue">
          {loading && [0, 1, 2].map((i) => <FileRowSkeleton key={i} />)}
          {users.map((u) => (
            <div className="row" key={u.id}>
              <div className="info">
                <div className="title">{u.username} {u.role === 'admin' && <span className="badge approved">Admin</span>} {u.banned && <span className="badge rejected">Suspended</span>}</div>
                <div className="meta">Joined {fmtDate(u.created_at)}  ·  {u.approved} approved  ·  {u.rejected} rejected</div>
              </div>
              {u.role !== 'admin' && (
                <button className="btn ghost" onClick={() => ban(u)}>{u.banned ? <><RotateCcw size={15} /> Restore</> : <><Ban size={15} /> Suspend</>}</button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
