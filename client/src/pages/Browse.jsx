import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { api, API } from '../api.js';
import { FileCard, DownloadIcon, Empty, ErrorMsg } from '../ui.jsx';

const KINDS = [
  ['all', 'All'],
  ['pdf', 'PDF'],
  ['doc', 'Docs'],
  ['sheet', 'Sheets'],
  ['slide', 'Slides'],
  ['image', 'Images'],
];

export default function Browse() {
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('all');
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ files: [], pages: 0, total: 0, page: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      const qs = new URLSearchParams({ q, page });
      if (kind !== 'all') qs.set('kind', kind);
      api(`/files?${qs}`)
        .then((d) => { setData(d); setError(''); })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, kind, page]);

  return (
    <>
      <section className="hero">
        <span className="pill-count"><i /> {data.total} files · free to download</span>
        <h1>
          The public archive for <span className="grad">everything you study.</span>
        </h1>
        <p>Notes, past questions, slides and more. Every upload is reviewed before it goes public.</p>

        <div className="searchbox">
          <Search size={20} aria-hidden="true" />
          <input
            placeholder="Search notes, past questions, slides…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
          />
        </div>

        <div className="chips">
          {KINDS.map(([k, label]) => (
            <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => { setKind(k); setPage(1); }}>
              {label}
            </button>
          ))}
        </div>
      </section>

      <section className="browse">
        <ErrorMsg error={error} />
        {!loading && !data.files.length && !error && (
          <Empty>{q ? `Nothing matches "${q}".` : 'No files here yet. Be the first to upload one.'}</Empty>
        )}

        <div className="grid">
          {data.files.map((f) => (
            <FileCard key={f.id} file={f}>
              <a className="icon-btn" href={`${API}/files/${f.id}/download`} aria-label={`Download ${f.title}`}>
                <DownloadIcon />
              </a>
            </FileCard>
          ))}
        </div>

        {data.pages > 1 && (
          <div className="pager">
            <button className="btn ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span>Page {data.page} of {data.pages}</span>
            <button className="btn ghost" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        )}
      </section>
    </>
  );
}
