import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { q } from '../db.js';
import { signToken, requireAuth } from '../auth.js';

const router = Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, try again later' },
});

const USERNAME_RE = /^[a-zA-Z0-9_]{3,24}$/;

const publicUser = (u) => ({ id: u.id, username: u.username, role: u.role });

router.post('/register', limiter, async (req, res) => {
  const { username, password } = req.body || {};
  if (!USERNAME_RE.test(username || ''))
    return res.status(400).json({ error: 'Username: 3-24 chars, letters, numbers, underscore' });
  if (typeof password !== 'string' || password.length < 8 || password.length > 128)
    return res.status(400).json({ error: 'Password must be 8-128 characters' });

  const hash = await bcrypt.hash(password, 12);
  try {
    const { rows } = await q(
      `INSERT INTO users (username, password_hash) VALUES ($1, $2)
       RETURNING id, username, role`,
      [username, hash]
    );
    res.status(201).json({ token: signToken(rows[0]), user: publicUser(rows[0]) });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Username already taken' });
    throw e;
  }
});

router.post('/login', limiter, async (req, res) => {
  const { username, password } = req.body || {};
  const { rows } = await q('SELECT * FROM users WHERE lower(username) = lower($1)', [
    String(username || ''),
  ]);
  const u = rows[0];
  const ok = u && (await bcrypt.compare(String(password || ''), u.password_hash));
  if (!ok) return res.status(401).json({ error: 'Invalid username or password' });
  if (u.banned) return res.status(403).json({ error: 'This account is suspended' });
  res.json({ token: signToken(u), user: publicUser(u) });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

export default router;
