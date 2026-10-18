import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, Download, ExternalLink, FileText, Info, Landmark, Library, Search, X } from 'lucide-react';
import { api } from '../api.js';
import { Empty, ErrorMsg } from '../ui.jsx';

const SOURCES = [
  { id: 'books', label: 'Books', icon: Library, name: 'Open Library', blurb: 'Free-to-read books and textbooks, scanned by the Internet Archive.', ph: 'Search books, e.g. sociology' },
  { id: 'classics', label: 'Classics', icon: Landmark, name: 'Project Gutenberg', blurb: 'Public-domain ebooks you can download as EPUB or read in the browser.', ph: 'Search classics, e.g. Weber' },
  { id: 'papers', label: 'Papers', icon: FileText, name: 'OpenAlex', blurb: 'Open-access research papers, journal articles and theses.', ph: 'Search papers, e.g. migration' },
];

function DiscoverSkeleton() {
  return (
    <div className="dcard skel" aria-hidden="true">
      <div className="dcover shimmer" />
      <div className="dbody">
        <div className="line shimmer w80" />
        <div className="line sm shimmer w50" />
        <div className="line sm shimmer w35" />
      </div>
    </div>
  );
}

function Cover({ item, Icon }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="dcover">
      {item.cover && !failed ? (
        <img src={item.cover} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        <Icon size={28} strokeWidth={1.7} aria-hidden="true" />
      )}
    </div>
  );
}

function DiscoverCard({ item, Icon }) {
  const authors = item.authors.join(', ');
  return (
    <article className="dcard">
      <Cover item={item} Icon={Icon} />
      <div className="dbody">
        <h4 className="dtitle" title={item.title}>
          <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
        </h4>
        {(authors || item.year) && (
          <p className="dby">{[authors, item.year].filter(Boolean).join(' · ')}</p>
        )}
        {item.tags.length > 0 && (
          <div className="dtags">
            {item.tags.map((t) => <span key={t}>{t}</span>)}
          </div>
        )}
        <div className="dfoot">
          <span className="dfmt">{item.format}</span>
          <div className="actions">
            {item.download && (
              <a className="icon-btn" href={item.download} target="_blank" rel="noopener noreferrer" aria-label={`Download ${item.title}`}>
                <Download size={18} strokeWidth={2.4} aria-hidden="true" />
              </a>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export default function Discover() {
  const [params, setParams] = useSearchParams();
  const source = SOURCES.find((s) => s.id === params.get('source')) || SOURCES[0];
  const urlQ = params.get('q') || '';
  const page = Math.max(parseInt(params.get('page'), 10) || 1, 1);

  const [text, setText] = useState(urlQ);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [slow, setSlow] = useState(false);
  const searchRef = useRef(null);

  const update = (next) => {
    const p = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => (v && v !== 1 && !(k === 'source' && v === 'books') ? p.set(k, v) : p.delete(k)));
    setParams(p, { replace: true });
  };

  // typing is debounced into the URL, so searches are shareable and back/forward just works
  useEffect(() => {
    if (text === urlQ) return undefined;
    const t = setTimeout(() => update({ q: text.trim(), page: 1 }), 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  useEffect(() => { setText(urlQ); }, [urlQ]);

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    const qs = new URLSearchParams({ source: source.id, q: urlQ, page });
    api(`/discover?${qs}`)
      .then((d) => live && setData(d))
      .catch((e) => live && (setError(e.message), setData(null)))
      .finally(() => live && setLoading(false));
    return () => { live = false; };
  }, [source.id, urlQ, page]);

  useEffect(() => {
    if (!loading) { setSlow(false); return undefined; }
    const t = setTimeout(() => setSlow(true), 5000);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const items = data?.items || [];
  const first = loading && !items.length;
  const Icon = source.id === 'papers' ? FileText : BookOpen;

  return (
    <>
      <section className="hero discover-hero">
        <span className="pill-count"><i /> Free to read · from open libraries</span>
        <h1>
          Discover <span className="grad">books and papers.</span>
        </h1>
        <p>Search millions of free, legal titles. We link you straight to the source.</p>

        <div className="tabs" role="tablist" aria-label="Where to search">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={source.id === s.id}
              className={source.id === s.id ? 'on' : ''}
              onClick={() => update({ source: s.id, page: 1 })}
            >
              <s.icon size={15} aria-hidden="true" /> {s.label}
            </button>
          ))}
        </div>

        <div className="searchbox" role="search">
          <Search size={20} aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            aria-label={`Search ${source.name}`}
            placeholder={source.ph}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          {text ? (
            <button type="button" className="clear-btn" aria-label="Clear search" onClick={() => { setText(''); update({ q: '', page: 1 }); searchRef.current?.focus(); }}>
              <X size={16} />
            </button>
          ) : (
            <kbd aria-hidden="true">/</kbd>
          )}
        </div>
        <p className="source-note">
          {source.blurb} <strong>Source: {source.name}.</strong>
        </p>
      </section>

      <section className="browse">
        {slow && (
          <div className="notice wake" role="status">
            <Info size={18} aria-hidden="true" />
            Still searching. The free source or our server is a little slow right now.
          </div>
        )}
        <ErrorMsg error={error} />

        {!loading && !error && !items.length && (
          <Empty>{urlQ ? `Nothing found for "${urlQ}" on ${source.name}. Try different words.` : 'Nothing to show right now.'}</Empty>
        )}

        {first ? (
          <div className="dgrid" aria-busy="true">
            {Array.from({ length: 6 }, (_, i) => <DiscoverSkeleton key={i} />)}
          </div>
        ) : (
          <div className={`dgrid ${loading ? 'busy' : ''}`} aria-busy={loading}>
            {items.map((it) => <DiscoverCard key={it.id} item={it} Icon={Icon} />)}
          </div>
        )}

        {data && data.pages > 1 && (
          <div className="pager">
            <button className="btn ghost" disabled={page <= 1 || loading} onClick={() => update({ page: page - 1 })}>Previous</button>
            <span>Page {data.page} of {data.pages}</span>
            <button className="btn ghost" disabled={page >= data.pages || loading} onClick={() => update({ page: page + 1 })}>Next</button>
          </div>
        )}

        {items.length > 0 && (
          <p className="discover-foot">
            <ExternalLink size={13} aria-hidden="true" /> Links open on the source's own site. byteArchieve doesn't host these files.
          </p>
        )}
      </section>
    </>
  );
}
