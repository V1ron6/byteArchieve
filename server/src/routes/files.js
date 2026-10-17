import { Router } from 'express';
import crypto from 'node:crypto';
import { q } from '../db.js';
import { requireAuth, optionalAuth } from '../auth.js';
import { presignUpload, presignDownload, headObject, deleteObject } from '../r2.js';

const router = Router();
const MAX_BYTES = Number(process.env.MAX_FILE_MB || 100) * 1024 * 1024;
const MAX_OPEN_PER_USER = 50; // pending + uploading

// file-type filter used by the browse chips
const KINDS = {
  pdf: ['pdf'],
  doc: ['doc', 'docx', 'txt', 'rtf', 'odt', 'md'],
  sheet: ['xls', 'xlsx', 'csv', 'ods'],
  slide: ['ppt', 'pptx', 'key', 'odp'],
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'],
};

const safeName = (n) =>
  n.replace(/[^\w.\- ]+/g, '_').replace(/\s+/g, '_').slice(0, 120) || 'file';

const FILE_COLS = `f.id, f.title, f.description, f.original_name, f.size, f.mime,
  f.status, f.review_note, f.downloads, f.created_at, u.username AS uploader`;

/* ---------- public: browse approved files ---------- */
router.get('/', async (req, res) => {
  const search = String(req.query.q || '').trim().slice(0, 100);
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 20;
  const params = [];
  let where = `f.status = 'approved'`;
  if (search) {
    params.push(`%${search.replace(/[%_]/g, '\\$&')}%`);
    where += ` AND (f.title ILIKE $1 OR f.description ILIKE $1 OR f.original_name ILIKE $1)`;
  }
  const kindExts = KINDS[String(req.query.kind || '')];
  if (kindExts) {
    params.push(kindExts.map((e) => `%.${e}`));
    where += ` AND lower(f.original_name) LIKE ANY ($${params.length}::text[])`;
  }
  const { rows } = await q(
    `SELECT ${FILE_COLS}, COUNT(*) OVER() AS total
     FROM files f JOIN users u ON u.id = f.owner_id
     WHERE ${where}
     ORDER BY f.created_at DESC
     LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
    params
  );
  res.json({
    files: rows.map(({ total, ...f }) => f),
    total: Number(rows[0]?.total || 0),
    page,
    pages: Math.ceil(Number(rows[0]?.total || 0) / limit),
  });
});

/* ---------- my uploads ---------- */
router.get('/mine', requireAuth, async (req, res) => {
  const { rows } = await q(
    `SELECT ${FILE_COLS} FROM files f JOIN users u ON u.id = f.owner_id
     WHERE f.owner_id = $1 AND f.status <> 'uploading'
     ORDER BY f.created_at DESC`,
    [req.user.id]
  );
  res.json({ files: rows });
});

/* ---------- upload step 1: get a presigned PUT url ---------- */
router.post('/upload-url', requireAuth, async (req, res) => {
  const { filename, size, type, title, description } = req.body || {};
  const bytes = Number(size);
  if (!filename || typeof filename !== 'string')
    return res.status(400).json({ error: 'filename required' });
  if (!Number.isFinite(bytes) || bytes <= 0)
    return res.status(400).json({ error: 'Invalid size' });
  if (bytes > MAX_BYTES)
    return res.status(413).json({ error: `Max file size is ${MAX_BYTES / 1024 / 1024} MB` });
  const cleanTitle = String(title || filename).trim().slice(0, 150);
  if (!cleanTitle) return res.status(400).json({ error: 'Title required' });

  const { rows: open } = await q(
    `SELECT COUNT(*)::int AS n FROM files WHERE owner_id = $1 AND status IN ('uploading','pending')`,
    [req.user.id]
  );
  if (open[0].n >= MAX_OPEN_PER_USER)
    return res.status(429).json({ error: 'Too many files awaiting review' });

  const mime = String(type || 'application/octet-stream').slice(0, 120);
  const key = `uploads/${req.user.id}/${crypto.randomUUID()}-${safeName(filename)}`;
  const { rows } = await q(
    `INSERT INTO files (owner_id, title, description, original_name, r2_key, size, mime)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [req.user.id, cleanTitle, String(description || '').slice(0, 2000), filename.slice(0, 255), key, bytes, mime]
  );
  const url = await presignUpload(key, mime, bytes);
  res.status(201).json({ id: rows[0].id, url });
});

/* ---------- upload step 2: confirm the object landed in R2 ---------- */
router.post('/:id/confirm', requireAuth, async (req, res) => {
  const { rows } = await q(
    `SELECT id, r2_key, size FROM files WHERE id = $1 AND owner_id = $2 AND status = 'uploading'`,
    [req.params.id, req.user.id]
  );
  const f = rows[0];
  if (!f) return res.status(404).json({ error: 'Upload not found' });

  const head = await headObject(f.r2_key);
  if (!head || Number(head.ContentLength) !== Number(f.size)) {
    return res.status(400).json({ error: 'File was not uploaded correctly' });
  }
  await q(`UPDATE files SET status = 'pending' WHERE id = $1`, [f.id]);
  res.json({ ok: true, status: 'pending' });
});

/* ---------- download link ---------- */
async function resolveLink(req, res) {
  const { rows } = await q('SELECT * FROM files WHERE id = $1', [req.params.id]);
  const f = rows[0];
  if (!f) return res.status(404).json({ error: 'Not found' });

  const isPrivileged = req.user && (req.user.role === 'admin' || req.user.id === f.owner_id);
  if (f.status !== 'approved' && !(isPrivileged && f.status !== 'uploading'))
    return res.status(404).json({ error: 'Not found' });

  if (f.status === 'approved')
    await q('UPDATE files SET downloads = downloads + 1 WHERE id = $1', [f.id]);
  return presignDownload(f.r2_key, f.original_name);
}

// JSON form (used by the app, supports auth for pending files)
router.get('/:id/link', optionalAuth, async (req, res) => {
  const url = await resolveLink(req, res);
  if (url) res.json({ url });
});

// direct form (plain <a href>), approved files only
router.get('/:id/download', optionalAuth, async (req, res) => {
  const url = await resolveLink(req, res);
  if (url) res.redirect(302, url);
});

/* ---------- delete own file ---------- */
router.delete('/:id', requireAuth, async (req, res) => {
  const { rows } = await q(
    'DELETE FROM files WHERE id = $1 AND owner_id = $2 RETURNING r2_key',
    [req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  await deleteObject(rows[0].r2_key).catch(() => {});
  res.json({ ok: true });
});

export default router;
