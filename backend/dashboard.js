const express = require('express');
const pool = require('./db');
const { verifyToken } = require('./authMiddleware');

const router = express.Router();

const LOW_STOCK_THRESHOLD = 10;

router.get('/dashboard/summary', verifyToken, async (req, res) => {
  try {
    const todaySales = await pool.query(`
      SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS total
      FROM sales
      WHERE status = 'paid' AND date::date = CURRENT_DATE
    `);

    const lowStock = await pool.query(
      `SELECT COUNT(*) AS count FROM products WHERE stock_quantity < $1`,
      [LOW_STOCK_THRESHOLD]
    );

    const owedByCustomers = await pool.query(
      `SELECT COALESCE(SUM(balance), 0) AS total FROM customers WHERE balance > 0`
    );

    let pendingCheques = 0;
    if (req.user.role === 'admin') {
      const chequesResult = await pool.query(
        `SELECT COUNT(*) AS count FROM purchase_orders WHERE payment_method = 'chèque' AND cheque_status = 'en_attente'`
      );
      pendingCheques = parseInt(chequesResult.rows[0].count);
    }

    res.json({
      todaySalesTotal: parseFloat(todaySales.rows[0].total),
      todaySalesCount: parseInt(todaySales.rows[0].count),
      lowStockCount: parseInt(lowStock.rows[0].count),
      lowStockThreshold: LOW_STOCK_THRESHOLD,
      totalOwedByCustomers: parseFloat(owedByCustomers.rows[0].total),
      pendingChequesCount: pendingCheques,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
});

module.exports = router;
