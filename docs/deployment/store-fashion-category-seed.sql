-- EvoLeveX Fashion seed: run only AFTER hierarchy migration and app deployment.
-- Safe for an initially empty category catalog. No products are created.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $seed$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'evo_store_categories' AND column_name = 'parent_id'
  ) THEN
    RAISE EXCEPTION 'STORE_CATEGORY_HIERARCHY_NOT_INSTALLED';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.evo_store_categories
    WHERE slug IN ('fashion','t-shirts','hoodies-sweatshirts','shirts','jackets','bottomwear')
  ) THEN
    RAISE EXCEPTION 'STORE_FASHION_SEED_CONFLICT_REVIEW_EXISTING_CATEGORIES';
  END IF;
END;
$seed$;

INSERT INTO public.evo_store_categories
  (name, slug, description, sort_order, is_active)
VALUES
  ('Fashion', 'fashion',
   'Men''s fashion, apparel and everyday essentials.', 0, true);

INSERT INTO public.evo_store_categories
  (name, slug, description, parent_id, sort_order, is_active)
SELECT item.name, item.slug, item.description, parent.id, item.sort_order, true
FROM public.evo_store_categories AS parent
CROSS JOIN (VALUES
  ('T-Shirts', 't-shirts', 'Premium men''s T-shirts and graphic tees.', 0),
  ('Hoodies & Sweatshirts', 'hoodies-sweatshirts', 'Hoodies and sweatshirts for men.', 1),
  ('Shirts', 'shirts', 'Men''s casual and smart shirts.', 2),
  ('Jackets', 'jackets', 'Men''s outerwear and jackets.', 3),
  ('Bottomwear', 'bottomwear', 'Men''s trousers, shorts and everyday bottomwear.', 4)
) AS item(name, slug, description, sort_order)
WHERE parent.slug = 'fashion';

DO $verify$
BEGIN
  IF (SELECT count(*) FROM public.evo_store_categories WHERE slug IN
    ('fashion','t-shirts','hoodies-sweatshirts','shirts','jackets','bottomwear')) <> 6
     OR (SELECT count(*) FROM public.evo_store_categories child
       JOIN public.evo_store_categories parent ON parent.id = child.parent_id
       WHERE parent.slug='fashion') <> 5
  THEN
    RAISE EXCEPTION 'STORE_FASHION_SEED_VERIFICATION_FAILED';
  END IF;
END;
$verify$;

COMMIT;

SELECT parent.name AS parent_category, child.name AS subcategory,
       child.slug, child.sort_order, child.is_active
FROM public.evo_store_categories AS child
JOIN public.evo_store_categories AS parent ON parent.id = child.parent_id
WHERE parent.slug = 'fashion'
ORDER BY child.sort_order, child.name;
