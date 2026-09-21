const express = require('express');
const cors = require('cors');
const pool = require('./db');
const authRoutes = require('./auth');
const productRoutes = require('./products');
const customerRoutes = require('./customers');
const salesRoutes = require('./sales');
const supplierRoutes = require('./suppliers');
const purchaseOrderRoutes = require('./purchase-orders');
const userRoutes = require('./users');
const dashboardRoutes = require('./dashboard');
const invoiceRoutes = require('./invoices');
require('dotenv').config();

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
  process.exit(1);
});

const app = express();

const exactAllowedOrigins = [
  'https://facture-stock-tn.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const isAllowed =
      exactAllowedOrigins.includes(origin) ||
      origin.endsWith('.vercel.app');

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn('Blocked by CORS, origin received:', origin);
      const err = new Error('Origin not allowed by CORS');
      err.status = 403;
      callback(err);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

// cors() gère automatiquement les requêtes OPTIONS (preflight)
app.use(cors(corsOptions));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Food dashboard backend is running' });
});

app.get('/api/test-db', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ dbTime: result.rows[0].now });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database connection failed' });
  }
});

app.use('/api', authRoutes);
app.use('/api', productRoutes);
app.use('/api', customerRoutes);
app.use('/api', salesRoutes);
app.use('/api', supplierRoutes);
app.use('/api', purchaseOrderRoutes);
app.use('/api', userRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', invoiceRoutes);

// Gestion centralisée des erreurs (renvoie 403 propre pour les CORS bloqués)
app.use((err, req, res, next) => {
  if (err.message === 'Origin not allowed by CORS') {
    return res.status(403).json({ error: 'Origin not allowed by CORS' });
  }

  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.on('error', (err) => {
  console.error('HTTP server error:', err);
  process.exit(1);
});

server.on('close', () => {
  console.log('HTTP server closed');
});

module.exports = app;