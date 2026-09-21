const express = require('express');
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
  process.exit(1);
});
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

const app = express();

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);

    const isAllowedOrigin =
      origin === 'https://facture-stock-tn.vercel.app' ||
      origin === 'http://localhost:5173' ||
      origin === 'http://localhost:3000' ||
      /^https:\/\/facture-stock-.*\.vercel\.app$/.test(origin);

    if (isAllowedOrigin) {
      return callback(null, true);
    }

    const err = new Error('Origin not allowed by CORS');
    err.status = 403;
    return callback(err);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
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

app.use((err, req, res, next) => {
  if (err && err.message === 'Origin not allowed by CORS') {
    return res.status(err.status || 403).json({ error: err.message });
  }

  console.error(err);
  return res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

server.on('error', (err) => {
  console.error('HTTP server error:', err);
  process.exit(1);
});

server.on('close', () => {
  console.log('HTTP server closed');
});