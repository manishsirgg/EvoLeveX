-- Evo Store: two-level category hierarchy (schema only).
-- Do not deploy independently of the matching admin/product/catalog changes.
ALTER TABLE public.evo_store_categories
  ADD COLUMN parent_id uuid NULL;

ALTER TABLE public.evo_store_categories
  ADD CONSTRAINT evo_store_categories_parent_fkey
  FOREIGN KEY (parent_id) REFERENCES public.evo_store_categories(id)
  ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE public.evo_store_categories
  ADD CONSTRAINT evo_store_categories_not_self_parent
  CHECK (parent_id IS NULL OR parent_id <> id);

CREATE INDEX evo_store_categories_parent_sort_idx
  ON public.evo_store_categories (parent_id, sort_order, name, id);

-- Serialize category reparenting and child creation with product assignment.
-- The parent lock is shared with the product-category guard below.
CREATE FUNCTION private.guard_evo_store_category_hierarchy()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE parent_parent_id uuid;
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    SELECT parent.parent_id INTO parent_parent_id
      FROM public.evo_store_categories parent
      WHERE parent.id = NEW.parent_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'EVO_STORE_CATEGORY_PARENT_MISSING';
    END IF;
    IF parent_parent_id IS NOT NULL THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'EVO_STORE_CATEGORY_MAX_DEPTH';
    END IF;
    IF EXISTS (SELECT 1 FROM public.evo_store_categories child WHERE child.parent_id = NEW.id) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'EVO_STORE_CATEGORY_MAX_DEPTH';
    END IF;
    IF EXISTS (SELECT 1 FROM public.evo_store_products product WHERE product.category_id = NEW.parent_id) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'EVO_STORE_CATEGORY_PARENT_HAS_PRODUCTS';
    END IF;
    IF EXISTS (SELECT 1 FROM public.evo_store_products product WHERE product.category_id = NEW.id) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'EVO_STORE_CATEGORY_HAS_PRODUCTS';
    END IF;
  END IF;
  -- A parent cannot be hidden while published merchandise depends on a child.
  IF NOT NEW.is_active AND NEW.parent_id IS NULL AND EXISTS (
    SELECT 1 FROM public.evo_store_categories child
    JOIN public.evo_store_products product ON product.category_id = child.id
    WHERE child.parent_id = NEW.id
      AND product.publication_status = 'published'::public.evo_store_publication_status
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'EVO_STORE_CATEGORY_PARENT_HAS_PUBLISHED_PRODUCTS';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_evo_store_category_hierarchy()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER evo_store_categories_hierarchy_guard
BEFORE INSERT OR UPDATE OF parent_id, is_active ON public.evo_store_categories
FOR EACH ROW EXECUTE FUNCTION private.guard_evo_store_category_hierarchy();

-- A product may reference a category only when it has no children.
-- Locking the selected category prevents a concurrent child insertion
-- from turning that category into a non-leaf during product assignment.
CREATE FUNCTION private.guard_evo_store_product_leaf_category()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE selected_parent_id uuid;
BEGIN
  IF NEW.category_id IS NOT NULL THEN
    SELECT category.parent_id INTO selected_parent_id
      FROM public.evo_store_categories category
      WHERE category.id = NEW.category_id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '23503', MESSAGE = 'EVO_STORE_CATEGORY_NOT_FOUND';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.evo_store_categories child
      WHERE child.parent_id = NEW.category_id
    ) THEN
      RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'EVO_STORE_CATEGORY_PARENT_NOT_ASSIGNABLE';
    END IF;
    IF NEW.publication_status = 'published'::public.evo_store_publication_status
       AND selected_parent_id IS NOT NULL THEN
      PERFORM 1 FROM public.evo_store_categories parent
        WHERE parent.id = selected_parent_id AND parent.is_active FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'EVO_STORE_CATEGORY_PARENT_INACTIVE';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.guard_evo_store_product_leaf_category()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER evo_store_products_leaf_category_guard
BEFORE INSERT OR UPDATE OF category_id, publication_status ON public.evo_store_products
FOR EACH ROW EXECUTE FUNCTION private.guard_evo_store_product_leaf_category();
