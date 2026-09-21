const express = require('express');
const pool = require('./db');
const { verifyToken, requireAdmin } = require('./middleware');

const router = express.Router();

router.get('/suppliers', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM suppliers ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch suppliers' });
  }
});

router.post('/suppliers', verifyToken, async (req, res) => {
  const { name, contact } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO suppliers (name, contact) VALUES ($1, $2) RETURNING *',
      [name, contact || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to add supplier' });
  }
});

router.delete('/suppliers/:id', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const poCheck = await pool.query('SELECT id FROM purchase_orders WHERE supplier_id = $1 LIMIT 1', [id]);
    if (poCheck.rows.length > 0) {
      return res.status(400).json({
        error: 'Impossible de supprimer : ce fournisseur a des livraisons associées',
      });
    }

    const result = await pool.query('DELETE FROM suppliers WHERE id = $1 RETURNING id', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    res.json({ message: 'Supplier deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete supplier' });
  }
});

router.put('/suppliers/:id', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { name, contact } = req.body;

  // Validate at least one field is provided and not empty
  const hasName = name !== undefined && name !== null && String(name).trim() !== '';
  const hasContact = contact !== undefined && contact !== null && String(contact).trim() !== '';
  
  if (!hasName && !hasContact) {
    return res.status(400).json({ error: 'Provide at least name or contact to update' });
  }

  try {
    const existing = await pool.query('SELECT * FROM suppliers WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Supplier not found' });
    }

    if (hasName) {
      const dupCheck = await pool.query(
        'SELECT id FROM suppliers WHERE LOWER(name) = LOWER($1) AND id != $2',
        [name, id]
      );
      if (dupCheck.rows.length > 0) {
        return res.status(409).json({ error: 'Un fournisseur avec ce nom existe déjà' });
      }
    }

    const updatedName = hasName ? name : existing.rows[0].name;
    const updatedContact = hasContact ? contact : existing.rows[0].contact;

    const result = await pool.query(
      'UPDATE suppliers SET name = $1, contact = $2 WHERE id = $3 RETURNING *',
      [updatedName, updatedContact, id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update supplier' });
  }
});

module.exports = router;
