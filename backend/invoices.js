const express = require('express');
const pool = require('./db');
const { verifyToken } = require('./authMiddleware');

const router = express.Router();

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundCurrency(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
}

function parseYear(rawYear) {
  const year = parseInt(rawYear, 10) || new Date().getFullYear();
  if (year < 2000 || year > 2100) {
    return null;
  }
  return year;
}

// Create invoice from an existing sale
router.post('/invoices/from-sale/:saleId', verifyToken, async (req, res) => {
  const { saleId } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // If an active (non-voided) invoice already exists for this sale, return it (idempotent)
    const existingInv = await client.query(
      `SELECT * FROM invoices WHERE sale_id = $1 AND status != 'voided' LIMIT 1`,
      [saleId]
    );
    if (process.env.DEBUG === 'true') {
      console.log('invoices.from-sale: existingInv count=', existingInv.rows.length, 'for saleId=', saleId);
    }
    if (existingInv.rows.length > 0) {
      const inv = existingInv.rows[0];
      if (process.env.DEBUG === 'true') {
        console.log('invoices.from-sale: returning existing invoice id=', inv.id);
      }
      const items = await client.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [inv.id]);
      await client.query('COMMIT');
      return res.status(200).json({ invoice: inv, items: items.rows });
    }

    const saleResult = await client.query('SELECT * FROM sales WHERE id = $1 FOR SHARE', [saleId]);
    if (saleResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Sale not found' });
    }
    const sale = saleResult.rows[0];

    const itemsResult = await client.query(
      `SELECT si.*,
              p.name AS product_name,
              p.unit,
              COALESCE(p.tva_rate, 0) AS tva_rate,
              COALESCE(p.is_government_supported, FALSE) AS is_government_supported,
              p.support_category
       FROM sale_items si
       LEFT JOIN products p ON si.product_id = p.id
       WHERE si.sale_id = $1`,
      [saleId]
    );

    if (itemsResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Sale has no items to invoice' });
    }

    // Get next invoice number using DB function
    const invNumRes = await client.query('SELECT next_invoice_number() AS invoice_number');
    const invoice_number = invNumRes.rows[0].invoice_number;

    // Build invoice totals and prepare items
    let subtotal = 0;
    let tax_total = 0;
    const invoiceItems = [];

    for (const si of itemsResult.rows) {
      const qty = toNumber(si.quantity);
      const unit_price = toNumber(si.unit_price);
      const tva = toNumber(si.tva_rate);
      const line_total = roundCurrency(qty * unit_price);
      subtotal += line_total;
      tax_total += roundCurrency(line_total * (tva / 100));

      invoiceItems.push({
        product_id: si.product_id,
        description: si.product_name || 'Item',
        quantity: qty,
        unit: si.unit || 'unité',
        unit_price: unit_price,
        tva_rate: tva,
        line_total,
        is_government_supported: Boolean(si.is_government_supported),
        support_category: si.support_category,
      });
    }

    subtotal = roundCurrency(subtotal);
    tax_total = roundCurrency(tax_total);
    const total = roundCurrency(subtotal + tax_total);

    const insertInv = await client.query(
      `INSERT INTO invoices (invoice_number, sale_id, customer_id, issued_by, subtotal, tax_total, total, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [invoice_number, sale.id, sale.customer_id, req.user.id, subtotal, tax_total, total, null]
    );
    const invoice = insertInv.rows[0];

    for (const it of invoiceItems) {
      await client.query(
        `INSERT INTO invoice_items
          (invoice_id, product_id, description, quantity, unit, unit_price, tva_rate, line_total,
           is_government_supported, support_category)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          invoice.id,
          it.product_id,
          it.description,
          it.quantity,
          it.unit,
          it.unit_price,
          it.tva_rate,
          it.line_total,
          it.is_government_supported,
          it.support_category,
        ]
      );
    }

    await client.query('COMMIT');

    // Fetch created invoice with its items
    const created = await pool.query('SELECT * FROM invoices WHERE id = $1', [invoice.id]);
    const items = await pool.query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id ASC', [invoice.id]);

    res.status(201).json({ invoice: created.rows[0], items: items.rows });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Failed to create invoice from sale' });
  } finally {
    client.release();
  }
});

// Get single invoice with items
router.get('/invoices/:id', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    const inv = await pool.query(
      `SELECT i.*, c.name AS customer_name, u.username AS issued_by_username
       FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.id
       LEFT JOIN users u ON i.issued_by = u.id
       WHERE i.id = $1`,
      [id]
    );
    if (inv.rows.length === 0) return res.status(404).json({ error: 'Invoice not found' });

    const items = await pool.query('SELECT * FROM invoice_items WHERE invoice_id = $1 ORDER BY id ASC', [id]);
    res.json({ invoice: inv.rows[0], items: items.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// List invoices (paginated)
router.get('/invoices', verifyToken, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page || '1'));
  const per_page = Math.max(1, parseInt(req.query.per_page || '20'));
  const offset = (page - 1) * per_page;

  try {
    const list = await pool.query(
      `SELECT i.*, c.name AS customer_name, u.username AS issued_by_username
       FROM invoices i
       LEFT JOIN customers c ON i.customer_id = c.id
       LEFT JOIN users u ON i.issued_by = u.id
       ORDER BY i.issued_at DESC
       LIMIT $1 OFFSET $2`,
      [per_page, offset]
    );

    const countRes = await pool.query('SELECT COUNT(*)::int AS total FROM invoices');
    res.json({ invoices: list.rows, page, per_page, total: countRes.rows[0].total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list invoices' });
  }
});

// Annual report built from invoices and invoice_items
router.get('/invoices/report/annual', verifyToken, async (req, res) => {
  const year = parseYear(req.query.year);
  if (!year) {
    return res.status(400).json({ error: 'year must be between 2000 and 2100' });
  }

  try {
    const totals = await pool.query(
      `SELECT COALESCE(SUM(i.subtotal),0)::numeric(12,2) AS subtotal,
              COALESCE(SUM(i.tax_total),0)::numeric(12,2) AS tax_total,
              COALESCE(SUM(i.total),0)::numeric(12,2) AS total_ttc,
              COUNT(*)::int AS invoice_count,
              COUNT(DISTINCT i.customer_id)::int AS customer_count,
              COALESCE(AVG(i.total),0)::numeric(12,2) AS average_invoice
       FROM invoices i
       WHERE i.status != 'voided' AND EXTRACT(YEAR FROM i.issued_at) = $1`,
      [year]
    );

    const byItem = await pool.query(
      `SELECT ii.description,
              COALESCE(ii.unit, p.unit, 'unité') AS unit,
              COALESCE(ii.is_government_supported, FALSE) AS is_government_supported,
              ii.support_category,
              COALESCE(SUM(ii.quantity),0)::numeric AS total_quantity,
              COALESCE(SUM(ii.line_total),0)::numeric(12,2) AS revenue_ht,
              COALESCE(SUM(ii.line_total * COALESCE(ii.tva_rate,0) / 100),0)::numeric(12,2) AS tax_total,
              COALESCE(SUM(ii.line_total + (ii.line_total * COALESCE(ii.tva_rate,0) / 100)),0)::numeric(12,2) AS revenue_ttc,
              COALESCE(SUM(ii.quantity * COALESCE(p.cout_unitaire,0)),0)::numeric(12,2) AS total_cost,
              COALESCE(SUM(ii.line_total - (ii.quantity * COALESCE(p.cout_unitaire,0))),0)::numeric(12,2) AS gross_margin
       FROM invoices i
       JOIN invoice_items ii ON ii.invoice_id = i.id
       LEFT JOIN products p ON p.id = ii.product_id
       WHERE i.status != 'voided' AND EXTRACT(YEAR FROM i.issued_at) = $1
       GROUP BY ii.description,
                COALESCE(ii.unit, p.unit, 'unité'),
                COALESCE(ii.is_government_supported, FALSE),
                ii.support_category
       ORDER BY COALESCE(ii.is_government_supported, FALSE) DESC, revenue_ht DESC`,
      [year]
    );

    const byMonth = await pool.query(
      `SELECT m.month,
              COALESCE(pm.subtotal,0)::numeric(12,2) AS subtotal,
              COALESCE(pm.tax_total,0)::numeric(12,2) AS tax_total,
              COALESCE(pm.total_ttc,0)::numeric(12,2) AS total_ttc,
              COALESCE(pm.invoice_count,0)::int AS invoice_count
       FROM generate_series(1,12) AS m(month)
       LEFT JOIN (
         SELECT EXTRACT(MONTH FROM i.issued_at)::int AS month,
                SUM(i.subtotal)::numeric(12,2) AS subtotal,
                SUM(i.tax_total)::numeric(12,2) AS tax_total,
                SUM(i.total)::numeric(12,2) AS total_ttc,
                COUNT(*)::int AS invoice_count
         FROM invoices i
         WHERE i.status != 'voided' AND EXTRACT(YEAR FROM i.issued_at) = $1
         GROUP BY month
       ) pm ON pm.month = m.month
       ORDER BY m.month`,
      [year]
    );

    const byCustomer = await pool.query(
      `SELECT c.id,
              c.name,
              c.matricule_fiscal,
              COUNT(i.id)::int AS invoice_count,
              COALESCE(SUM(i.subtotal),0)::numeric(12,2) AS subtotal,
              COALESCE(SUM(i.tax_total),0)::numeric(12,2) AS tax_total,
              COALESCE(SUM(i.total),0)::numeric(12,2) AS total_ttc
       FROM invoices i
       LEFT JOIN customers c ON c.id = i.customer_id
       WHERE i.status != 'voided' AND EXTRACT(YEAR FROM i.issued_at) = $1
       GROUP BY c.id, c.name, c.matricule_fiscal
       ORDER BY total_ttc DESC
       LIMIT 20`,
      [year]
    );

    const byTaxRate = await pool.query(
      `SELECT COALESCE(ii.tva_rate,0)::numeric(5,2) AS tva_rate,
              COALESCE(SUM(ii.line_total),0)::numeric(12,2) AS taxable_amount,
              COALESCE(SUM(ii.line_total * COALESCE(ii.tva_rate,0) / 100),0)::numeric(12,2) AS tax_total
       FROM invoices i
       JOIN invoice_items ii ON ii.invoice_id = i.id
       WHERE i.status != 'voided' AND EXTRACT(YEAR FROM i.issued_at) = $1
       GROUP BY COALESCE(ii.tva_rate,0)
       ORDER BY tva_rate ASC`,
      [year]
    );

    const byPaymentMethod = await pool.query(
      `SELECT COALESCE(s.payment_method, 'unknown') AS payment_method,
              COUNT(DISTINCT i.id)::int AS invoice_count,
              COALESCE(SUM(i.total),0)::numeric(12,2) AS total_ttc
       FROM invoices i
       LEFT JOIN sales s ON s.id = i.sale_id
       WHERE i.status != 'voided' AND EXTRACT(YEAR FROM i.issued_at) = $1
       GROUP BY COALESCE(s.payment_method, 'unknown')
       ORDER BY total_ttc DESC`,
      [year]
    );

    const bySupportedCategory = await pool.query(
      `SELECT COALESCE(ii.support_category, 'non_classe') AS support_category,
              COUNT(DISTINCT i.id)::int AS invoice_count,
              COUNT(DISTINCT ii.product_id)::int AS product_count,
              COALESCE(SUM(ii.quantity),0)::numeric AS total_quantity,
              COALESCE(SUM(ii.line_total),0)::numeric(12,2) AS revenue_ht,
              COALESCE(SUM(ii.line_total * COALESCE(ii.tva_rate,0) / 100),0)::numeric(12,2) AS tax_total,
              COALESCE(SUM(ii.line_total + (ii.line_total * COALESCE(ii.tva_rate,0) / 100)),0)::numeric(12,2) AS revenue_ttc
       FROM invoices i
       JOIN invoice_items ii ON ii.invoice_id = i.id
       WHERE i.status != 'voided'
         AND COALESCE(ii.is_government_supported, FALSE) = TRUE
         AND EXTRACT(YEAR FROM i.issued_at) = $1
       GROUP BY COALESCE(ii.support_category, 'non_classe')
       ORDER BY revenue_ht DESC`,
      [year]
    );

    const supportedTotals = await pool.query(
      `SELECT COALESCE(SUM(ii.line_total),0)::numeric(12,2) AS revenue_ht,
              COALESCE(SUM(ii.line_total * COALESCE(ii.tva_rate,0) / 100),0)::numeric(12,2) AS tax_total,
              COALESCE(SUM(ii.line_total + (ii.line_total * COALESCE(ii.tva_rate,0) / 100)),0)::numeric(12,2) AS revenue_ttc,
              COALESCE(SUM(ii.quantity),0)::numeric AS total_quantity,
              COUNT(DISTINCT i.id)::int AS invoice_count
       FROM invoices i
       JOIN invoice_items ii ON ii.invoice_id = i.id
       WHERE i.status != 'voided'
         AND COALESCE(ii.is_government_supported, FALSE) = TRUE
         AND EXTRACT(YEAR FROM i.issued_at) = $1`,
      [year]
    );

    res.json({
      year,
      subtotal: totals.rows[0].subtotal,
      tax_total: totals.rows[0].tax_total,
      total_ttc: totals.rows[0].total_ttc,
      total_revenue: totals.rows[0].subtotal,
      invoice_count: totals.rows[0].invoice_count,
      customer_count: totals.rows[0].customer_count,
      average_invoice: totals.rows[0].average_invoice,
      revenue_by_item: byItem.rows,
      revenue_by_month: byMonth.rows,
      revenue_by_customer: byCustomer.rows,
      tax_by_rate: byTaxRate.rows,
      payment_methods: byPaymentMethod.rows,
      supported_totals: supportedTotals.rows[0],
      supported_by_category: bySupportedCategory.rows,
    });
  } catch (err) {
    console.error('Failed to build annual report', err);
    res.status(500).json({ error: 'Failed to build annual report' });
  }
});

module.exports = router;
