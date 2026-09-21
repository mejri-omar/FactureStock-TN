BEGIN;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS is_government_supported BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS support_category VARCHAR(80);

ALTER TABLE invoice_items
ADD COLUMN IF NOT EXISTS is_government_supported BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS support_category VARCHAR(80);

UPDATE invoice_items ii
SET is_government_supported = COALESCE(p.is_government_supported, FALSE),
    support_category = p.support_category
FROM products p
WHERE ii.product_id = p.id;

COMMIT;
