-- Synthetic, disposable-only expiry fixtures. Also used by separate-session races.
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
 raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
SELECT ('18000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '00000000-0000-0000-0000-000000000000','authenticated','authenticated',
 'expiry-'||n||'@example.test','',now(),'{}','{}',now(),now() FROM generate_series(1,120) n;
INSERT INTO public.profiles(id,username)
SELECT ('18000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'expiry_'||n FROM generate_series(1,120) n;
INSERT INTO public.addresses(id,user_id,full_name,phone,address_line1,address_line2,landmark,city,state,postal_code,country)
SELECT ('98000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 ('18000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'Expiry Customer '||n,'000','Synthetic Street','Unit 1','Synthetic Landmark','City','State','000','India'
 FROM generate_series(1,120) n;
SET CONSTRAINTS ALL DEFERRED;
INSERT INTO public.evo_store_categories(id,name,slug,is_active)
VALUES('38000000-0000-4000-8000-000000000001','Expiry Category','expiry-category',true);
INSERT INTO public.evo_store_products(id,category_id,name,slug,product_mode,base_price,currency)
SELECT ('48000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '38000000-0000-4000-8000-000000000001','Expiry Product '||n,'expiry-product-'||n,'physical',10,'USD'
 FROM generate_series(1,8) n;
INSERT INTO public.evo_store_variants(id,product_id,sku,name,price,currency,weight_g,size_code,color_code,is_active)
SELECT ('58000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 ('48000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'RESERVATION-'||n,'Expiry Variant '||n,99,'USD',100,'M','BLUE',true FROM generate_series(1,8) n;
INSERT INTO public.evo_store_inventory(variant_id,quantity_on_hand,quantity_reserved)
SELECT id,1000,0 FROM public.evo_store_variants WHERE sku LIKE 'RESERVATION-%';
INSERT INTO public.evo_store_variant_prices(variant_id,currency,amount,is_active)
SELECT id,prices.currency,prices.amount,true FROM public.evo_store_variants
 CROSS JOIN (VALUES ('USD',10.25::numeric),('JPY',100::numeric)) prices(currency,amount)
 WHERE sku LIKE 'RESERVATION-%';
INSERT INTO public.evo_store_product_images(id,product_id,storage_path,is_primary,is_active)
SELECT ('68000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 ('48000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '48000000-0000-4000-8000-'||lpad(n::text,12,'0')||'/68000000-0000-4000-8000-'||lpad(n::text,12,'0')||'.jpg',true,true
 FROM generate_series(1,8) n;
UPDATE public.evo_store_products SET publication_status='published' WHERE slug LIKE 'expiry-product-%';
SET CONSTRAINTS ALL IMMEDIATE;

-- A second variant of product 1 exercises both same-parent and cross-parent unions.
SET CONSTRAINTS ALL DEFERRED;
INSERT INTO public.evo_store_variants(id,product_id,sku,name,price,currency,weight_g,is_active)
VALUES('58000000-0000-4000-8000-000000000009','48000000-0000-4000-8000-000000000001','EXPIRY-9','Expiry Variant 9',10,'USD',100,true);
INSERT INTO public.evo_store_inventory(variant_id,quantity_on_hand,quantity_reserved)
VALUES('58000000-0000-4000-8000-000000000009',1000,0);
INSERT INTO public.evo_store_variant_prices(variant_id,currency,amount,is_active)
VALUES('58000000-0000-4000-8000-000000000009','USD',10.25,true);
SET CONSTRAINTS ALL IMMEDIATE;
