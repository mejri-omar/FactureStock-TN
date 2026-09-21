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
const defaultAllowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];

const configuredOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([...defaultAllowedOrigins, ...configuredOrigins]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }
    const err = new Error('Origin not allowed by CORS');
    err.status = 403;
    return callback(err);
  },
}));
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
