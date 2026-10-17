import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, Send, Trash2, UploadCloud } from 'lucide-react';
import { api, putToR2, openFile, fmtSize, fmtDate } from '../api.js';
import { Badge, FileRow, Empty, ErrorMsg } from '../ui.jsx';

export default function Upload() {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [mine, setMine] = useState([]);
  const [drag, setDrag] = useState(false);
  const input = useRef();

  const load = useCallback(
    () => api('/files/mine').then((d) => setMine(d.files)).catch((e) => setError(e.message)),
    []
  );
  useEffect(() => { load(); }, [load]);

  const pick = (f) => {
    if (!f) return;
    setFile(f);
    setDone(false);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return setError('Choose a file first');
    setError('');
    setDone(false);
    try {
      setProgress(0);
      const { id, url } = await api('/files/upload-url', {
        method: 'POST',
        body: { filename: file.name, size: file.size, type: file.type, title, description },
      });
      await putToR2(url, file, setProgress);
      await api(`/files/${id}/confirm`, { method: 'POST' });
      setFile(null); setTitle(''); setDescription(''); setDone(true);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setProgress(null);
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this file?')) return;
    try { await api(`/files/${id}`, { method: 'DELETE' }); load(); } catch (e) { setError(e.message); }
  };

  const busy = progress !== null;

  return (
    <section className="upload-grid">
      <form className="card" onSubmit={submit}>
        <h2>Upload a file</h2>

        <div
          className={`dropzone ${drag ? 'drag' : ''}`}
          onClick={() => input.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
        >
          {file ? (
            <>
              <strong>{file.name}</strong>
              <span className="muted small">{fmtSize(file.size)}</span>
            </>
          ) : (
            <>
              <UploadCloud size={32} strokeWidth={1.8} className="dz-icon" aria-hidden="true" />
              <strong>Drop a file here, or click to browse</strong>
              <span className="muted small">Up to 100 MB</span>
            </>
          )}
          <input ref={input} type="file" hidden onChange={(e) => pick(e.target.files[0])} />
        </div>

        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Sociology 101 - Past Questions" maxLength={150} required />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is in this file?" rows={3} maxLength={2000} />
        </label>

        <div className="notice">Uploads stay private until an admin approves them.</div>
        <ErrorMsg error={error} />
        {done && <div className="notice ok">Submitted. It will appear here once reviewed.</div>}
        {busy && <div className="bar"><div style={{ width: `${Math.round(progress * 100)}%` }} /></div>}
        <button className="btn block" disabled={busy}>{busy ? `Uploading ${Math.round(progress * 100)}%` : <><Send size={16} /> Submit for review</>}</button>
      </form>

      <div className="mine">
        <h3>My uploads</h3>
        {!mine.length && <Empty>Nothing uploaded yet.</Empty>}
        {mine.map((f) => (
          <FileRow
            key={f.id}
            file={f}
            meta={
              `${fmtDate(f.created_at)}  ·  ` +
              (f.status === 'approved' ? `${f.downloads} downloads`
                : f.status === 'rejected' ? `Rejected${f.review_note ? `: ${f.review_note}` : ''}`
                : 'Waiting for review')
            }
          >
            <Badge status={f.status} />
            <button className="btn ghost" type="button" onClick={() => openFile(f.id).catch((e) => setError(e.message))}><ExternalLink size={15} /> Open</button>
            <button className="btn ghost danger" type="button" onClick={() => remove(f.id)}><Trash2 size={15} /> Delete</button>
          </FileRow>
        ))}
      </div>
    </section>
  );
}
