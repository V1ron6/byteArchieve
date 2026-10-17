import { Router } from 'express';
import { q } from '../db.js';
import { requireAdmin } from '../auth.js';
import { deleteObject } from '../r2.js';

const router = Router();
router.use(requireAdmin);

const STATUSES = ['pending', 'approved', 'rejected'];

router.get('/stats', async (_req, res) => {
  const [{ rows: f }, { rows: u }] = await Promise.all([
    q(`SELECT status, COUNT(*)::int AS n, COALESCE(SUM(size),0)::bigint AS bytes
       FROM files WHERE status <> 'uploading' GROUP BY status`),
    q(`SELECT COUNT(*)::int AS n FROM users`),
  ]);
  res.json({
    files: Object.fromEntries(f.map((r) => [r.status, { count: r.n, bytes: Number(r.bytes) }])),
    users: u[0].n,
  });
});

router.get('/files', async (req, res) => {
  const status = STATUSES.includes(req.query.status) ? req.query.status : 'pending';
  const { rows } = await q(
    `SELECT f.id, f.title, f.description, f.original_name, f.size, f.mime, f.status,
            f.review_note, f.downloads, f.created_at, f.reviewed_at, u.username AS uploader
     FROM files f JOIN users u ON u.id = f.owner_id
     WHERE f.status = $1
     ORDER BY f.created_at DESC LIMIT 200`,
    [status]
  );
  res.json({ files: rows });
});

router.patch('/files/:id', async (req, res) => {
  const { status, note } = req.body || {};
  if (!['approved', 'rejected', 'pending'].includes(status))
    return res.status(400).json({ error: 'Invalid status' });
  const { rows } = await q(
    `UPDATE files SET status = $1, review_note = $2, reviewed_at = now()
     WHERE id = $3 AND status <> 'uploading' RETURNING id, status`,
    [status, note ? String(note).slice(0, 500) : null, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

router.delete('/files/:id', async (req, res) => {
  const { rows } = await q('DELETE FROM files WHERE id = $1 RETURNING r2_key', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  await deleteObject(rows[0].r2_key).catch(() => {});
  res.json({ ok: true });
});

router.get('/users', async (_req, res) => {
  const { rows } = await q(
    `SELECT u.id, u.username, u.role, u.banned, u.created_at,
            COUNT(f.id) FILTER (WHERE f.status = 'approved')::int AS approved,
            COUNT(f.id) FILTER (WHERE f.status = 'rejected')::int AS rejected
     FROM users u LEFT JOIN files f ON f.owner_id = u.id
     GROUP BY u.id ORDER BY u.created_at DESC LIMIT 500`
  );
  res.json({ users: rows });
});

router.patch('/users/:id', async (req, res) => {
  if (req.params.id === req.user.id)
    return res.status(400).json({ error: "You can't suspend yourself" });
  const banned = !!req.body?.banned;
  const { rows } = await q(
    `UPDATE users SET banned = $1 WHERE id = $2 AND role <> 'admin' RETURNING id, banned`,
    [banned, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Not found' });
  res.json(rows[0]);
});

export default router;
