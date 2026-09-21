const express = require('express');
const bcrypt = require('bcrypt');
const pool = require('./db');
const { verifyToken, requireAdmin } = require('./middleware');

const router = express.Router();

router.get('/users', verifyToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role, created_at FROM users ORDER BY created_at ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/users', verifyToken, requireAdmin, async (req, res) => {
  const { username, password, role } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ error: 'username, password, and role are required' });
  }
  if (!['admin', 'staff'].includes(role)) {
    return res.status(400).json({ error: 'role must be admin or staff' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'password must be at least 6 characters' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'That username is already taken' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id, username, role, created_at',
      [username, password_hash, role]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.put('/users/:id/password', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { new_password } = req.body;

  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ error: 'new_password must be at least 6 characters' });
  }

  try {
    const existing = await pool.query('SELECT id FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const password_hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [password_hash, id]);

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

router.delete('/users/:id', verifyToken, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id)) {
    return res.status(400).json({ error: 'Invalid user id' });
  }
  if (req.user.id === id) {
    return res.status(400).json({ error: 'You cannot delete your own active account' });
  }

  try {
    const userResult = await pool.query('SELECT id, role FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (userResult.rows[0].role === 'admin') {
      const adminCount = await pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'");
      if (Number(adminCount.rows[0].count) <= 1) {
        return res.status(400).json({ error: 'At least one administrator account must remain' });
      }
    }

    const [sales, payments, stockMovements] = await Promise.all([
      pool.query('SELECT id FROM sales WHERE employee_id = $1 LIMIT 1', [id]),
      pool.query('SELECT id FROM customer_payments WHERE employee_id = $1 LIMIT 1', [id]),
      pool.query('SELECT id FROM stock_movements WHERE created_by = $1 LIMIT 1', [id]),
    ]);

    if (sales.rows.length || payments.rows.length || stockMovements.rows.length) {
      return res.status(400).json({
        error: 'This user cannot be deleted because they are linked to sales or stock history',
      });
    }

    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

module.exports = router;
