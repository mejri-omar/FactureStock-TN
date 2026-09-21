-- Migration: create invoices and invoice_items tables
-- Creates a helper function next_invoice_number() which returns YEAR-0001 style numbers

BEGIN;

-- invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id SERIAL PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  sale_id INTEGER REFERENCES sales(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  issued_by INTEGER REFERENCES users(id),
  issued_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW() NOT NULL,
  status TEXT DEFAULT 'issued' NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  tax_total NUMERIC(12,2) NOT NULL,
  total NUMERIC(12,2) NOT NULL,
  notes TEXT
);

-- invoice_items table
CREATE TABLE IF NOT EXISTS invoice_items (
  id SERIAL PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  description TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  tva_rate NUMERIC(5,2),
  line_total NUMERIC(12,2) NOT NULL
);

-- Function to generate next invoice number per calendar year
-- Format: YYYY-0001 (zero-padded 4 digits)
CREATE OR REPLACE FUNCTION next_invoice_number() RETURNS TEXT AS $$
DECLARE
  y TEXT := TO_CHAR(NOW(), 'YYYY');
  maxnum INTEGER;
  last TEXT;
BEGIN
  SELECT MAX(invoice_number) INTO last FROM invoices WHERE invoice_number LIKE y || '-%';
  IF last IS NULL THEN
    RETURN y || '-0001';
  END IF;
  -- Extract numeric suffix after dash
  SELECT CAST(SUBSTRING(last FROM '[0-9]+$') AS INTEGER) INTO maxnum;
  IF maxnum IS NULL THEN
    RETURN y || '-0001';
  END IF;
  maxnum := maxnum + 1;
  RETURN y || '-' || LPAD(CAST(maxnum AS TEXT), 4, '0');
END;
$$ LANGUAGE plpgsql;

COMMIT;
