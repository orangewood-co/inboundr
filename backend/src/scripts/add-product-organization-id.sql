ALTER TABLE products
  ADD COLUMN IF NOT EXISTS organization_id TEXT;

-- After creating/backfilling an organization, assign existing rows explicitly:
-- UPDATE products
-- SET organization_id = '<organization_id>'
-- WHERE organization_id IS NULL;

CREATE INDEX IF NOT EXISTS products_organization_id_idx
  ON products (organization_id);

CREATE INDEX IF NOT EXISTS products_organization_addedtime_idx
  ON products (organization_id, addedtime DESC, id DESC);
