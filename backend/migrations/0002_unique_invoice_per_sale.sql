-- Migration: enforce one active invoice per sale by creating a partial unique index
-- If multiple active invoices exist for the same sale, void all but the earliest one

BEGIN;

-- Find duplicate active invoices (same sale_id, status != 'voided') and void all but the earliest
WITH dupes AS (
  SELECT sale_id, MIN(id) AS keep_id, ARRAY_AGG(id ORDER BY id) AS ids
  FROM invoices
  WHERE sale_id IS NOT NULL AND status != 'voided'
  GROUP BY sale_id
  HAVING COUNT(*) > 1
), to_void AS (
  SELECT id FROM (
    SELECT unnest(ids) AS id, generate_subscripts(ids,1) AS ord
    FROM dupes
  ) x WHERE ord > 1
)
UPDATE invoices
SET status = 'voided', notes = COALESCE(notes, '') || ' [voided by migration 0002 to enforce single active invoice per sale]'
WHERE id IN (SELECT id FROM to_void);

-- Create the partial unique index that only enforces uniqueness for active invoices
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_sale_id_active
ON invoices (sale_id)
WHERE status != 'voided' AND sale_id IS NOT NULL;

COMMIT;
