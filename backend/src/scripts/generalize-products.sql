ALTER TABLE products
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS default_adjustments JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pricing_policy JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE SEQUENCE IF NOT EXISTS products_id_seq;
SELECT setval(
  'products_id_seq',
  GREATEST(COALESCE((SELECT MAX(id) FROM products), 0), 1),
  COALESCE((SELECT MAX(id) FROM products), 0) > 0
);
ALTER TABLE products ALTER COLUMN id SET DEFAULT nextval('products_id_seq');
ALTER SEQUENCE products_id_seq OWNED BY products.id;

CREATE INDEX IF NOT EXISTS idx_products_organization_category
  ON products (organization_id, category);

CREATE INDEX IF NOT EXISTS idx_products_attributes
  ON products USING GIN (attributes);

CREATE INDEX IF NOT EXISTS idx_products_tags
  ON products USING GIN (tags);

UPDATE products
SET
  default_adjustments = CASE
    WHEN calibrationcharges IS NOT NULL
      AND calibrationcharges > 0
      AND default_adjustments = '[]'::jsonb
    THEN jsonb_build_array(jsonb_build_object(
      'id', 'legacy.calibration',
      'code', 'calibration',
      'label', 'Calibration',
      'type', 'fixed',
      'value', calibrationcharges,
      'taxable', false
    ))
    ELSE default_adjustments
  END,
  pricing_policy = jsonb_strip_nulls(jsonb_build_object(
    'maxDiscountPercent', maxdiscount,
    'maxMarkupPercent', maxupsell
  )) || pricing_policy;
