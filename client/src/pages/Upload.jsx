import { useCallback, useEffect, useRef, useState } from 'react';
import { ExternalLink, FileText, Send, Trash2, UploadCloud, X } from 'lucide-react';
import { api, putToR2, openFile, fmtSize, fmtDate } from '../api.js';
import { Badge, FileRow, FileRowSkeleton, Empty, ErrorMsg, useToast } from '../ui.jsx';

export default function Upload() {
  const toast = useToast();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [mine, setMine] = useState([]);
  const [loadingMine, setLoadingMine] = useState(true);
  const [drag, setDrag] = useState(false);
  const input = useRef();

  const load = useCallback(
    () =>
      api('/files/mine')
        .then((d) => setMine(d.files))
        .catch((e) => toast(e.message, 'error'))
        .finally(() => setLoadingMine(false)),
    [toast]
  );
  useEffect(() => { load(); }, [load]);

  const pick = (f) => {
    if (!f) return;
    setFile(f);
    setError('');
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
  };

  const clearFile = (e) => {
    e.stopPropagation();
    setFile(null);
    if (input.current) input.current.value = '';
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return setError('Choose a file first');
    setError('');
    try {
      setProgress(0);
      const { id, url } = await api('/files/upload-url', {
        method: 'POST',
        body: { filename: file.name, size: file.size, type: file.type, title, description },
      });
      await putToR2(url, file, setProgress);
      await api(`/files/${id}/confirm`, { method: 'POST' });
      setFile(null); setTitle(''); setDescription('');
      if (input.current) input.current.value = '';
      toast('Submitted. It will appear in the archive once an admin approves it.', 'success');
      load();
    } catch (err) {
      setError(err.message);
      toast(err.message, 'error');
    } finally {
      setProgress(null);
    }
  };

  const remove = async (id) => {
    if (!confirm('Delete this file?')) return;
    try {
      await api(`/files/${id}`, { method: 'DELETE' });
      toast('File deleted', 'success');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const busy = progress !== null;
  const pct = Math.round((progress ?? 0) * 100);

  return (
    <section className="upload-grid">
      <form className="card" onSubmit={submit}>
        <h2>Upload a file</h2>

        <div
          className={`dropzone ${drag ? 'drag' : ''}`}
          role="button"
          tabIndex={0}
          aria-label="Choose a file to upload"
          onClick={() => input.current.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current.click(); } }}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
        >
          {file ? (
            <div className="picked">
              <FileText size={28} strokeWidth={1.8} className="dz-icon" aria-hidden="true" />
              <div>
                <strong>{file.name}</strong>
                <span className="muted small">{fmtSize(file.size)}</span>
              </div>
              <button type="button" className="clear-btn" onClick={clearFile} aria-label="Remove file" disabled={busy}>
                <X size={16} />
              </button>
            </div>
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
        {busy && (
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
            <div style={{ width: `${pct}%` }} />
          </div>
        )}
        <button className="btn block" disabled={busy}>
          {busy ? `Uploading ${pct}%` : <><Send size={16} /> Submit for review</>}
        </button>
      </form>

      <div className="mine">
        <h3>My uploads</h3>
        {loadingMine && [0, 1, 2].map((i) => <FileRowSkeleton key={i} />)}
        {!loadingMine && !mine.length && <Empty>Nothing uploaded yet.</Empty>}
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
            <button className="btn ghost" type="button" onClick={() => openFile(f.id).catch((e) => toast(e.message, 'error'))}><ExternalLink size={15} /> Open</button>
            <button className="btn ghost danger" type="button" onClick={() => remove(f.id)}><Trash2 size={15} /> Delete</button>
          </FileRow>
        ))}
      </div>
    </section>
  );
}
