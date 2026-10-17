import jwt from 'jsonwebtoken';
import { q } from './db.js';

const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error('JWT_SECRET is required');

export const signToken = (user) =>
  jwt.sign({ sub: user.id }, SECRET, { expiresIn: '7d' });

async function loadUser(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Bearer ')) return null;
  try {
    const { sub } = jwt.verify(h.slice(7), SECRET);
    const { rows } = await q(
      'SELECT id, username, role, banned FROM users WHERE id = $1',
      [sub]
    );
    const u = rows[0];
    return u && !u.banned ? u : null;
  } catch {
    return null;
  }
}

export const optionalAuth = async (req, _res, next) => {
  req.user = await loadUser(req);
  next();
};

export const requireAuth = async (req, res, next) => {
  req.user = await loadUser(req);
  if (!req.user) return res.status(401).json({ error: 'Login required' });
  next();
};

export const requireAdmin = async (req, res, next) => {
  req.user = await loadUser(req);
  if (!req.user) return res.status(401).json({ error: 'Login required' });
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  next();
};
