-- Synthetic, disposable-only reservation fixtures. Also used by separate-session races.
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
 raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
SELECT ('19000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'reservation-'||n||'@example.test','',now(),'{}','{}',now(),now() FROM generate_series(1,2) n;
INSERT INTO public.profiles(id,username)
SELECT ('19000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'reservation_'||n FROM generate_series(1,2) n;
INSERT INTO public.addresses(id,user_id,full_name,phone,address_line1,address_line2,landmark,city,state,postal_code,country)
SELECT ('99000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 ('19000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'Reservation Customer '||n,'000','Synthetic Street','Unit 1','Synthetic Landmark','City','State','000','India'
 FROM generate_series(1,2) n;
SET CONSTRAINTS ALL DEFERRED;
INSERT INTO public.evo_store_categories(id,name,slug,is_active)
VALUES('39000000-0000-4000-8000-000000000001','Reservation Category','reservation-category',true);
INSERT INTO public.evo_store_products(id,category_id,name,slug,product_mode,base_price,currency)
SELECT ('49000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '39000000-0000-4000-8000-000000000001','Reservation Product '||n,'reservation-product-'||n,'physical',10,'USD'
 FROM generate_series(1,8) n;
INSERT INTO public.evo_store_variants(id,product_id,sku,name,price,currency,weight_g,size_code,color_code,is_active)
SELECT ('59000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 ('49000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'RESERVATION-'||n,'Reservation Variant '||n,99,'USD',100,'M','BLUE',true FROM generate_series(1,8) n;
INSERT INTO public.evo_store_inventory(variant_id,quantity_on_hand,quantity_reserved)
SELECT id,20,0 FROM public.evo_store_variants WHERE sku LIKE 'RESERVATION-%';
INSERT INTO public.evo_store_variant_prices(variant_id,currency,amount,is_active)
SELECT id,prices.currency,prices.amount,true FROM public.evo_store_variants
 CROSS JOIN (VALUES ('USD',10.25::numeric),('JPY',100::numeric)) prices(currency,amount)
 WHERE sku LIKE 'RESERVATION-%';
INSERT INTO public.evo_store_product_images(id,product_id,storage_path,is_primary,is_active)
SELECT ('69000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 ('49000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '49000000-0000-4000-8000-'||lpad(n::text,12,'0')||'/69000000-0000-4000-8000-'||lpad(n::text,12,'0')||'.jpg',true,true
 FROM generate_series(1,8) n;
UPDATE public.evo_store_products SET publication_status='published' WHERE slug LIKE 'reservation-product-%';
SET CONSTRAINTS ALL IMMEDIATE;
