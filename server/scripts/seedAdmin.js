import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../src/db.js';

const { ADMIN_USERNAME: u, ADMIN_PASSWORD: p } = process.env;
if (!u || !p || p.length < 8) {
  console.error('Set ADMIN_USERNAME and ADMIN_PASSWORD (min 8 chars)');
  process.exit(1);
}
const hash = await bcrypt.hash(p, 12);
await pool.query(
  `INSERT INTO users (username, password_hash, role) VALUES ($1, $2, 'admin')
   ON CONFLICT (lower(username)) DO UPDATE SET password_hash = $2, role = 'admin', banned = FALSE`,
  [u, hash]
);
console.log(`admin "${u}" ready`);
await pool.end();
