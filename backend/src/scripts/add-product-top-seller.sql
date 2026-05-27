ALTER TABLE products
ADD COLUMN IF NOT EXISTS is_top_seller BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_products_organization_top_seller
ON products (organization_id, is_top_seller);
