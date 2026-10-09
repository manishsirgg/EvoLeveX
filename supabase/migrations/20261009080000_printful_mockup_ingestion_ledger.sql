-- Printful mockup ingestion ledger: no bytes are uploaded by this migration.
-- Database-owned identity for retries, reconciliation and audit. Deploy only after reviewed CI.
BEGIN;
CREATE TABLE private.evo_store_printful_mockup_ingestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.evo_store_products(id) ON DELETE RESTRICT,
  printful_file_id bigint NOT NULL CHECK (printful_file_id > 0),
  color_code text NOT NULL CHECK (color_code ~ '^[A-Z0-9][A-Z0-9-]{0,31}$'),
  storage_bucket text NOT NULL DEFAULT 'evo-store-products'
    CHECK (storage_bucket = 'evo-store-products'),
  storage_path text NOT NULL
    CHECK (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}[.]png$'),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','uploaded','verified','failed')),
  last_error_code text CHECK (last_error_code IS NULL OR last_error_code ~ '^[A-Z0-9_]{1,80}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evo_store_printful_mockup_once UNIQUE (product_id,printful_file_id),
  CONSTRAINT evo_store_printful_mockup_path_once UNIQUE (storage_bucket,storage_path)
);
ALTER TABLE private.evo_store_printful_mockup_ingestions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.evo_store_printful_mockup_ingestions
  FROM PUBLIC, anon, authenticated, service_role;
CREATE INDEX evo_store_printful_mockup_ingestions_status_idx
  ON private.evo_store_printful_mockup_ingestions(status,created_at);
COMMIT;
