const express = require('express');
const pool = require('./db');
const { verifyToken, requireAdmin } = require('./authMiddleware');
const { normalizeSupportFields } = require('./support-categories');

const router = express.Router();

router.get('/products', verifyToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM products ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

router.post('/products', verifyToken, async (req, res) => {
  const {
    name,
    price,
    stock_quantity,
    unit,
    tva_rate,
    cout_unitaire,
    is_government_supported,
    support_category,
  } = req.body;

  if (!name || price === undefined || stock_quantity === undefined) {
    return res.status(400).json({ error: 'name, price, and stock_quantity are required' });
  }

  try {
    const support = normalizeSupportFields({ is_government_supported, support_category });
    const result = await pool.query(
      `INSERT INTO products
        (name, price, stock_quantity, unit, tva_rate, cout_unitaire, is_government_supported, support_category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        name,
        price,
        stock_quantity,
        unit || 'unité',
        tva_rate || 0,
        cout_unitaire ?? null,
        support.isSupported,
        support.category,
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to add product' });
  }
});

router.put('/products/:id', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const {
    name,
    price,
    stock_quantity,
    unit,
    tva_rate,
    cout_unitaire,
    is_government_supported,
    support_category,
  } = req.body;

  if (
    name === undefined &&
    price === undefined &&
    stock_quantity === undefined &&
    unit === undefined &&
    tva_rate === undefined &&
    cout_unitaire === undefined &&
    is_government_supported === undefined &&
    support_category === undefined
  ) {
    return res.status(400).json({ error: 'Provide at least one field to update' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query('SELECT * FROM products WHERE id = $1 FOR UPDATE', [id]);
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found' });
    }

    const current = existing.rows[0];
    const updatedName = name !== undefined ? name : current.name;
    const updatedPrice = price !== undefined ? price : current.price;
    const updatedStockQuantity = stock_quantity !== undefined ? stock_quantity : current.stock_quantity;
    const updatedUnit = unit !== undefined ? unit : current.unit;
    const updatedTva = tva_rate !== undefined ? tva_rate : current.tva_rate;
    const updatedUnitCost = cout_unitaire !== undefined ? cout_unitaire : current.cout_unitaire;
    const support = normalizeSupportFields({
      is_government_supported: is_government_supported !== undefined
        ? is_government_supported
        : current.is_government_supported,
      support_category: support_category !== undefined ? support_category : current.support_category,
    });
    const stockDelta = Number(updatedStockQuantity) - Number(current.stock_quantity);

    const result = await client.query(
      `UPDATE products
       SET name = $1,
           price = $2,
           stock_quantity = $3,
           unit = $4,
           tva_rate = $5,
           cout_unitaire = $6,
           is_government_supported = $7,
           support_category = $8
       WHERE id = $9
       RETURNING *`,
      [
        updatedName,
        updatedPrice,
        updatedStockQuantity,
        updatedUnit,
        updatedTva,
        updatedUnitCost,
        support.isSupported,
        support.category,
        id,
      ]
    );

    if (stock_quantity !== undefined && stockDelta !== 0) {
      await client.query(
        `INSERT INTO stock_movements
          (product_id, type, quantity, related_sale_id, created_by, note)
         VALUES ($1, 'manual_edit', $2, NULL, $3, $4)`,
        [id, stockDelta, req.user.id, 'Direct edit via product update endpoint']
      );
    }

    await client.query('COMMIT');
    res.json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Failed to update product' });
  } finally {
    client.release();
  }
});

router.post('/products/:id/stock-correction', verifyToken, requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { quantity_change, note } = req.body;

  if (quantity_change === undefined) {
    return res.status(400).json({ error: 'quantity_change is required' });
  }

  const parsedChange = Number(quantity_change);
  if (isNaN(parsedChange)) {
    return res.status(400).json({ error: 'quantity_change must be a valid number' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const productResult = await client.query('SELECT * FROM products WHERE id = $1', [id]);
    if (productResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Product not found' });
    }

    const newStock = productResult.rows[0].stock_quantity + parsedChange;
    if (newStock < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Correction would make stock negative' });
    }

    await client.query('UPDATE products SET stock_quantity = $1 WHERE id = $2', [newStock, id]);

    await client.query(
      `INSERT INTO stock_movements (product_id, type, quantity, created_by, note)
       VALUES ($1, 'damage_correction', $2, $3, $4)`,
      [id, parsedChange, req.user.id, note || null]
    );

    await client.query('COMMIT');
    res.json({ message: 'Stock corrected', new_stock: newStock });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to correct stock' });
  } finally {
    client.release();
  }
});

module.exports = router;
