BEGIN;

ALTER TABLE invoice_items
ADD COLUMN IF NOT EXISTS unit VARCHAR(50) DEFAULT 'unité';

UPDATE invoice_items ii
SET unit = COALESCE(p.unit, 'unité')
FROM products p
WHERE ii.product_id = p.id
  AND (ii.unit IS NULL OR ii.unit = 'unité');

ALTER TABLE invoice_items
ALTER COLUMN unit SET NOT NULL;

COMMIT;
