import { Router } from 'express';
import rateLimit from 'express-rate-limit';

/**
 * Discover: a thin proxy over free, legal catalogues.
 *   books    Open Library, only titles that are free to read online (Internet Archive scans)
 *   classics Project Gutenberg via Gutendex, public-domain ebooks
 *   papers   OpenAlex, open-access research papers
 * Everything is normalised to one shape so the client has a single card.
 * Files are never copied: results link out to the source.
 */

const router = Router();

router.use(
  rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many searches. Wait a minute and try again.' },
  })
);

const PER_PAGE = 24;
const TIMEOUT_MS = 9000;
const CONTACT = process.env.DISCOVER_CONTACT || ''; // optional email, puts you in OpenAlex's faster "polite pool"
const UA = `byteArchieve/1.0 (free study archive${CONTACT ? `; ${CONTACT}` : ''})`;

/* ---------- tiny TTL cache so repeat searches don't hammer the free APIs ---------- */
const CACHE_TTL = 10 * 60_000;
const CACHE_MAX = 300;
const cache = new Map();
const cacheGet = (k) => {
  const hit = cache.get(k);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL) { cache.delete(k); return null; }
  return hit.value;
};
const cacheSet = (k, value) => {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(k, { at: Date.now(), value });
};

/* ---------- helpers ---------- */
class UpstreamError extends Error {}

async function getJson(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      redirect: 'follow',
    });
    if (!res.ok) throw new UpstreamError(`upstream ${res.status}`);
    return await res.json();
  } catch (e) {
    throw e instanceof UpstreamError ? e : new UpstreamError(e.name === 'AbortError' ? 'timeout' : e.message);
  } finally {
    clearTimeout(timer);
  }
}

/** only ever hand the browser plain http(s) links */
const safeUrl = (u) => {
  if (typeof u !== 'string') return null;
  try {
    const p = new URL(u);
    return p.protocol === 'https:' || p.protocol === 'http:' ? p.href.replace(/^http:/, 'https:') : null;
  } catch {
    return null;
  }
};

const clean = (s, max = 200) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim().slice(0, max) : '');

/** "Last, First" -> "First Last" (Gutenberg style) */
const flipName = (n) => {
  const m = /^([^,]+),\s*(.+)$/.exec(n || '');
  return m ? `${m[2]} ${m[1]}` : n || '';
};

const pageCount = (total, per) => Math.max(1, Math.min(Math.ceil((total || 0) / per), 40));

/* ---------- sources ---------- */

async function openLibrary(q, page) {
  const u = new URL('https://openlibrary.org/search.json');
  u.searchParams.set('q', q || 'subject:textbooks');
  u.searchParams.set('has_fulltext', 'true');
  u.searchParams.set('limit', String(PER_PAGE));
  u.searchParams.set('page', String(page));
  u.searchParams.set('fields', 'key,title,author_name,first_publish_year,cover_i,ia,ebook_access,subject,language');
  const d = await getJson(u);

  const items = (d.docs || [])
    .filter((x) => x.ebook_access === 'public' && Array.isArray(x.ia) && x.ia.length) // free to read, no loan needed
    .map((x) => {
      const ia = x.ia[0];
      return {
        id: `ol:${x.key}`,
        title: clean(x.title),
        authors: (x.author_name || []).slice(0, 3).map((a) => clean(a, 80)),
        year: x.first_publish_year || null,
        cover: x.cover_i ? `https://covers.openlibrary.org/b/id/${x.cover_i}-M.jpg` : null,
        tags: (x.subject || []).slice(0, 3).map((s) => clean(s, 40)),
        format: 'Read online',
        url: safeUrl(`https://archive.org/details/${encodeURIComponent(ia)}`),
        download: null,
        info: safeUrl(`https://openlibrary.org${x.key}`),
      };
    })
    .filter((x) => x.title && x.url);

  return { items, total: d.numFound || 0, pages: pageCount(d.numFound, PER_PAGE) };
}

async function gutenberg(q, page) {
  const u = new URL('https://gutendex.com/books');
  if (q) u.searchParams.set('search', q);
  u.searchParams.set('languages', 'en');
  u.searchParams.set('page', String(page));
  const d = await getJson(u);

  const pick = (f) =>
    safeUrl(
      f['application/epub+zip'] ||
        f['application/pdf'] ||
        f['text/html'] ||
        f['text/html; charset=utf-8'] ||
        null
    );
  const fmtName = (f) =>
    f['application/epub+zip'] ? 'EPUB' : f['application/pdf'] ? 'PDF' : 'HTML';

  const items = (d.results || [])
    .map((b) => {
      const f = b.formats || {};
      return {
        id: `pg:${b.id}`,
        title: clean(b.title),
        authors: (b.authors || []).slice(0, 3).map((a) => clean(flipName(a.name), 80)),
        year: null,
        cover: safeUrl(f['image/jpeg']),
        tags: (b.subjects || []).slice(0, 2).map((s) => clean(s.split(' -- ')[0], 40)),
        format: fmtName(f),
        url: safeUrl(`https://www.gutenberg.org/ebooks/${b.id}`),
        download: pick(f),
        info: null,
      };
    })
    .filter((x) => x.title && x.url);

  return { items, total: d.count || 0, pages: pageCount(d.count, 32) };
}

async function openAlex(q, page) {
  const u = new URL('https://api.openalex.org/works');
  const filters = [
    'open_access.is_oa:true',
    'is_paratext:false',
    'type:article|book|book-chapter|dissertation',
  ];
  // commas, pipes and colons are filter syntax, so keep them out of the search text
  const term = q.replace(/[,|:]/g, ' ').trim();
  if (term) filters.push(`title_and_abstract.search:${term}`);
  u.searchParams.set('filter', filters.join(','));
  if (!term) u.searchParams.set('sort', 'cited_by_count:desc');
  u.searchParams.set('per-page', String(PER_PAGE));
  u.searchParams.set('page', String(page));
  u.searchParams.set(
    'select',
    'id,title,doi,publication_year,authorships,open_access,primary_location,best_oa_location,cited_by_count,type'
  );
  if (CONTACT) u.searchParams.set('mailto', CONTACT);
  const d = await getJson(u);

  const items = (d.results || [])
    .map((w) => {
      const loc = w.best_oa_location || w.primary_location || {};
      const names = (w.authorships || []).map((a) => clean(a.author?.display_name, 80)).filter(Boolean);
      const pdf = safeUrl(loc.pdf_url);
      return {
        id: `oa:${w.id}`,
        title: clean(w.title, 300),
        authors: names.length > 3 ? [...names.slice(0, 3), 'et al.'] : names,
        year: w.publication_year || null,
        cover: null,
        tags: [clean(loc.source?.display_name, 60), w.cited_by_count ? `${w.cited_by_count} citations` : '']
          .filter(Boolean),
        format: pdf ? 'PDF' : 'Open access',
        url: safeUrl(w.open_access?.oa_url || loc.landing_page_url || w.doi),
        download: pdf,
        info: null,
      };
    })
    .filter((x) => x.title && x.url);

  return { items, total: d.meta?.count || 0, pages: pageCount(d.meta?.count, PER_PAGE) };
}

const SOURCES = {
  books: { run: openLibrary, name: 'Open Library' },
  classics: { run: gutenberg, name: 'Project Gutenberg' },
  papers: { run: openAlex, name: 'OpenAlex' },
};

/* ---------- route ---------- */
router.get('/', async (req, res) => {
  const source = String(req.query.source || 'books');
  const def = SOURCES[source];
  if (!def) return res.status(400).json({ error: 'Unknown source' });

  const q = clean(String(req.query.q || ''), 100);
  const page = Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), 40);

  const key = `${source}|${q.toLowerCase()}|${page}`;
  const hit = cacheGet(key);
  if (hit) return res.set('Cache-Control', 'public, max-age=300').json(hit);

  try {
    const out = await def.run(q, page);
    const body = { source, sourceName: def.name, q, page, ...out };
    cacheSet(key, body);
    res.set('Cache-Control', 'public, max-age=300').json(body);
  } catch (e) {
    console.warn(`discover ${source} failed:`, e.message);
    res.status(502).json({ error: `${def.name} is not responding right now. Try again in a moment.` });
  }
});

export default router;
