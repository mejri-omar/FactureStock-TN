const express = require('express');
const pool = require('./db');
const { verifyToken, requireAdmin } = require('./authMiddleware');

const router = express.Router();

router.get('/customers', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM customers ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

router.post('/customers', verifyToken, async (req, res) => {
  const { name, contact, address, matricule_fiscal } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO customers (name, contact, address, matricule_fiscal) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, contact || null, address || null, matricule_fiscal || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add customer' });
  }
});

router.delete('/customers/:id', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const salesCheck = await pool.query('SELECT id FROM sales WHERE customer_id = $1 LIMIT 1', [id]);
    if (salesCheck.rows.length > 0) {
      return res.status(400).json({
        error: 'Impossible de supprimer : ce client a des ventes associées',
      });
    }

    const result = await pool.query('DELETE FROM customers WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ message: 'Customer deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// Record a payment against a customer's balance - any logged-in user (staff or admin)
router.post('/customers/:id/payments', verifyToken, async (req, res) => {
  const { id } = req.params;
  const { amount, note } = req.body;

  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const custResult = await client.query('SELECT * FROM customers WHERE id = $1 FOR UPDATE', [id]);
    if (custResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Customer not found' });
    }

    await client.query(
      'INSERT INTO customer_payments (customer_id, amount, employee_id, note) VALUES ($1, $2, $3, $4)',
      [id, amount, req.user.id, note || null]
    );

    const updated = await client.query(
      'UPDATE customers SET balance = balance - $1 WHERE id = $2 RETURNING *',
      [amount, id]
    );

    await client.query('COMMIT');
    res.status(201).json({ message: 'Payment recorded', customer: updated.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to record payment' });
  } finally {
    client.release();
  }
});

// View payment history for a customer - any logged-in user
router.get('/customers/:id/payments', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT cp.*, u.username AS employee_username
      FROM customer_payments cp
      JOIN users u ON cp.employee_id = u.id
      WHERE cp.customer_id = $1
      ORDER BY cp.date DESC
    `, [id]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

router.put('/customers/:id', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, contact, address, matricule_fiscal } = req.body;

  try {
    const existing = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const current = existing.rows[0];
    const updatedName = name !== undefined ? name : current.name;
    const updatedContact = contact !== undefined ? contact : current.contact;
    const updatedAddress = address !== undefined ? address : current.address;
    const updatedMatricule = matricule_fiscal !== undefined ? matricule_fiscal : current.matricule_fiscal;

    const result = await pool.query(
      'UPDATE customers SET name = $1, contact = $2, address = $3, matricule_fiscal = $4 WHERE id = $5 RETURNING *',
      [updatedName, updatedContact, updatedAddress, updatedMatricule, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

module.exports = router;
