const express = require('express');
const pool = require('./db');
const { verifyToken, requireAdmin } = require('./authMiddleware');

const router = express.Router();

router.post('/purchase-orders', verifyToken, async (req, res) => {
  const { supplier_id, items } = req.body;

  if (!supplier_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'supplier_id and items are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const supplierResult = await client.query('SELECT id FROM suppliers WHERE id = $1', [supplier_id]);
    if (supplierResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Supplier not found' });
    }

    let total = 0;
    for (const item of items) {
      const { product_id, quantity, unit_cost } = item;
      if (!product_id || !quantity || quantity <= 0 || unit_cost === undefined) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'each item needs product_id, positive quantity, and unit_cost' });
      }

      const prodResult = await client.query('SELECT id FROM products WHERE id = $1', [product_id]);
      if (prodResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Product ${product_id} not found` });
      }

      total += quantity * unit_cost;
    }

    const poResult = await client.query(
      `INSERT INTO purchase_orders (supplier_id, total) VALUES ($1, $2) RETURNING *`,
      [supplier_id, total]
    );
    const purchaseOrder = poResult.rows[0];

    for (const item of items) {
      const { product_id, quantity, unit_cost } = item;

      await client.query(
        `INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, unit_cost)
         VALUES ($1, $2, $3, $4)`,
        [purchaseOrder.id, product_id, quantity, unit_cost]
      );

      await client.query(
        `UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2`,
        [quantity, product_id]
      );

      await client.query(
        `INSERT INTO stock_movements (product_id, type, quantity, related_purchase_order_id, created_by)
         VALUES ($1, 'in', $2, $3, $4)`,
        [product_id, quantity, purchaseOrder.id, req.user.id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ purchaseOrder, items, total });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to record delivery' });
  } finally {
    client.release();
  }
});

router.get('/purchase-orders', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT po.*, s.name AS supplier_name
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      ORDER BY po.date DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch purchase orders' });
  }
});

router.put('/purchase-orders/:id/payment', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { payment_method, cheque_number, cheque_due_date } = req.body;

  if (!['espèces', 'chèque'].includes(payment_method)) {
    return res.status(400).json({ error: "payment_method must be 'espèces' or 'chèque'" });
  }
  if (payment_method === 'chèque' && (!cheque_number || !cheque_due_date)) {
    return res.status(400).json({ error: 'cheque_number and cheque_due_date are required for a check payment' });
  }

  try {
    const existing = await pool.query('SELECT id FROM purchase_orders WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }

    const result = await pool.query(
      `UPDATE purchase_orders
       SET payment_method = $1,
           cheque_number = $2,
           cheque_due_date = $3,
           cheque_status = $4,
           payment_recorded_by = $5
       WHERE id = $6 RETURNING *`,
      [
        payment_method,
        payment_method === 'chèque' ? cheque_number : null,
        payment_method === 'chèque' ? cheque_due_date : null,
        payment_method === 'chèque' ? 'en_attente' : null,
        req.user.id,
        id,
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to record payment' });
  }
});

router.put('/purchase-orders/:id/cheque-status', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { cheque_status } = req.body;

  const validStatuses = ['en_attente', 'encaissé', 'rejeté'];
  
  if (!cheque_status || !validStatuses.includes(cheque_status)) {
    return res.status(400).json({ error: 'Invalid cheque_status. Must be one of: ' + validStatuses.join(', ') });
  }

  try {
    const existing = await pool.query('SELECT * FROM purchase_orders WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Purchase order not found' });
    }
    if (existing.rows[0].payment_method !== 'chèque') {
      return res.status(400).json({ error: 'This delivery was not paid by check' });
    }

    const result = await pool.query(
      'UPDATE purchase_orders SET cheque_status = $1 WHERE id = $2 RETURNING *',
      [cheque_status, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update cheque status' });
  }
});

router.get('/purchase-orders/upcoming-cheques', verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT po.*, s.name AS supplier_name
      FROM purchase_orders po
      JOIN suppliers s ON po.supplier_id = s.id
      WHERE po.payment_method = 'chèque' AND po.cheque_status = 'en_attente'
      ORDER BY po.cheque_due_date ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch upcoming cheques' });
  }
});

module.exports = router;
