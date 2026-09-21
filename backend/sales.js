const express = require('express');
const pool = require('./db');
const { verifyToken, requireAdmin } = require('./authMiddleware');

const router = express.Router();

router.post('/sales', verifyToken, async (req, res) => {
  const { customer_id, payment_method, items } = req.body;

  if (!customer_id || !payment_method || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'customer_id, payment_method, and items are required' });
  }
  if (!['cash', 'card', 'credit'].includes(payment_method)) {
    return res.status(400).json({ error: 'payment_method must be cash, card, or credit' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const custResult = await client.query('SELECT id FROM customers WHERE id = $1', [customer_id]);
    if (custResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Customer not found' });
    }

    let total = 0;
    const lineItems = [];

    for (const item of items) {
      const { product_id, quantity } = item;
      if (!product_id || !quantity || quantity <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'each item needs product_id and a positive quantity' });
      }

      const prodResult = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [product_id]);
      if (prodResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Product ${product_id} not found` });
      }

      const product = prodResult.rows[0];
      if (product.stock_quantity < quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Not enough stock for ${product.name}` });
      }

      const unit_price = parseFloat(product.price);
      total += unit_price * quantity;
      lineItems.push({
        product_id,
        quantity,
        unit_price,
        name: product.name,
        tva_rate: parseFloat(product.tva_rate) || 0,
      });
    }

    const saleResult = await client.query(
      `INSERT INTO sales (customer_id, employee_id, total, payment_method, status)
       VALUES ($1, $2, $3, $4, 'paid') RETURNING *`,
      [customer_id, req.user.id, total, payment_method]
    );
    const sale = saleResult.rows[0];

    for (const li of lineItems) {
      await client.query(
        `INSERT INTO sale_items (sale_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)`,
        [sale.id, li.product_id, li.quantity, li.unit_price]
      );
      await client.query(
        `UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2`,
        [li.quantity, li.product_id]
      );
      await client.query(
        `INSERT INTO stock_movements (product_id, type, quantity, related_sale_id, created_by)
         VALUES ($1, 'out', $2, $3, $4)`,
        [li.product_id, li.quantity, sale.id, req.user.id]
      );
    }

    // Credit sale: add the total to the customer's running balance
    if (payment_method === 'credit') {
      await client.query(
        'UPDATE customers SET balance = balance + $1 WHERE id = $2',
        [total, customer_id]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ sale, items: lineItems, total });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to process sale' });
  } finally {
    client.release();
  }
});

router.get('/sales', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, c.name AS customer_name, u.username AS employee_username
      FROM sales s
      JOIN customers c ON s.customer_id = c.id
      JOIN users u ON s.employee_id = u.id
      ORDER BY s.date DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch sales' });
  }
});

router.get('/sales/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const saleResult = await pool.query(`
      SELECT s.*, c.name AS customer_name, u.username AS employee_username
      FROM sales s
      JOIN customers c ON s.customer_id = c.id
      JOIN users u ON s.employee_id = u.id
      WHERE s.id = $1
    `, [id]);

    if (saleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    const itemsResult = await pool.query(`
      SELECT si.*, p.name AS product_name, p.tva_rate, p.unit
      FROM sale_items si
      JOIN products p ON si.product_id = p.id
      WHERE si.sale_id = $1
    `, [id]);

    res.json({ ...saleResult.rows[0], items: itemsResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch sale' });
  }
});

router.post('/sales/:id/void', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const saleResult = await client.query('SELECT * FROM sales WHERE id = $1 FOR UPDATE', [id]);
    if (saleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Sale not found' });
    }

    const sale = saleResult.rows[0];
    if (sale.status === 'voided') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Sale is already voided' });
    }

    const itemsResult = await client.query('SELECT * FROM sale_items WHERE sale_id = $1', [id]);

    for (const item of itemsResult.rows) {
      await client.query(
        'UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2',
        [item.quantity, item.product_id]
      );
      await client.query(
        `INSERT INTO stock_movements (product_id, type, quantity, related_sale_id, created_by, note)
         VALUES ($1, 'in', $2, $3, $4, $5)`,
        [item.product_id, item.quantity, id, req.user.id, 'Stock restored from voided sale']
      );
    }

    // If this was a credit sale, reverse the balance charge too
    if (sale.payment_method === 'credit') {
      await client.query(
        'UPDATE customers SET balance = balance - $1 WHERE id = $2',
        [sale.total, sale.customer_id]
      );
    }

    await client.query(
      `UPDATE sales SET status = 'voided', voided_by = $1, voided_at = NOW() WHERE id = $2`,
      [req.user.id, id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Sale voided, stock restored, and balance reversed if applicable' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to void sale' });
  } finally {
    client.release();
  }
});

router.put('/sales/:id/edit', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items is required and cannot be empty' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const saleResult = await client.query('SELECT * FROM sales WHERE id = $1 FOR UPDATE', [id]);
    if (saleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Sale not found' });
    }

    const sale = saleResult.rows[0];
    if (sale.status === 'voided') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot edit a voided sale' });
    }

    const oldItemsResult = await client.query('SELECT * FROM sale_items WHERE sale_id = $1', [id]);
    for (const oldItem of oldItemsResult.rows) {
      await client.query(
        'UPDATE products SET stock_quantity = stock_quantity + $1 WHERE id = $2',
        [oldItem.quantity, oldItem.product_id]
      );
      await client.query(
        `INSERT INTO stock_movements (product_id, type, quantity, related_sale_id, created_by, note)
         VALUES ($1, 'in', $2, $3, $4, $5)`,
        [oldItem.product_id, oldItem.quantity, id, req.user.id, `Correction facture #${id} - ancien article retiré`]
      );
    }
    await client.query('DELETE FROM sale_items WHERE sale_id = $1', [id]);

    let newTotal = 0;
    for (const item of items) {
      const { product_id, quantity } = item;
      if (!product_id || !quantity || quantity <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'each item needs product_id and a positive quantity' });
      }

      const prodResult = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [product_id]);
      if (prodResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: `Product ${product_id} not found` });
      }

      const product = prodResult.rows[0];
      if (product.stock_quantity < quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Not enough stock for ${product.name}` });
      }

      const unit_price = parseFloat(product.price);
      newTotal += unit_price * quantity;

      await client.query(
        'INSERT INTO sale_items (sale_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)',
        [id, product_id, quantity, unit_price]
      );
      await client.query(
        'UPDATE products SET stock_quantity = stock_quantity - $1 WHERE id = $2',
        [quantity, product_id]
      );
      await client.query(
        `INSERT INTO stock_movements (product_id, type, quantity, related_sale_id, created_by, note)
         VALUES ($1, 'out', $2, $3, $4, $5)`,
        [product_id, quantity, id, req.user.id, `Correction facture #${id} - nouvel article`]
      );
    }

    if (sale.payment_method === 'credit') {
      const difference = newTotal - parseFloat(sale.total);
      await client.query(
        'UPDATE customers SET balance = balance + $1 WHERE id = $2',
        [difference, sale.customer_id]
      );
    }

    await client.query(
      'UPDATE sales SET total = $1, edited_by = $2, edited_at = NOW() WHERE id = $3',
      [newTotal, req.user.id, id]
    );

    await client.query('COMMIT');
    res.json({ message: 'Sale updated', new_total: newTotal });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to edit sale' });
  } finally {
    client.release();
  }
});
module.exports = router;
