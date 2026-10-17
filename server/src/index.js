import 'dotenv/config';
import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from './routes/auth.js';
import fileRoutes from './routes/files.js';
import adminRoutes from './routes/admin.js';

const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(','),
  })
);
app.use(express.json({ limit: '100kb' }));

app.get('/api/health', (_req, res) => res.json(
{
   ok: true,
   name: 'byteArchieve',
   version:'1.0.0 base',
   Devteam: 'curiosity',
   ecosystem: 'Bytecloud'
   }

          ));
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/admin', adminRoutes);

app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// express-async-errors forwards thrown async errors here
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`byteArchieve API on localhost:${port}`));
