INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
 email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('12000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','concurrency@example.test','',now(),'{}','{}',now(),now()) ON CONFLICT DO NOTHING;
INSERT INTO public.profiles(id,username) VALUES ('12000000-0000-4000-8000-000000000001','concurrency') ON CONFLICT DO NOTHING;
INSERT INTO public.roles(id,code,name) VALUES
 ('22000000-0000-4000-8000-000000000001','admin','Administrator')
ON CONFLICT (code) DO NOTHING;
INSERT INTO public.user_roles(user_id,role_id)
SELECT '12000000-0000-4000-8000-000000000001',id FROM public.roles WHERE code='admin'
ON CONFLICT DO NOTHING;
INSERT INTO public.evo_vault_categories(id,name,slug) VALUES ('32000000-0000-4000-8000-000000000001','Concurrency','concurrency') ON CONFLICT DO NOTHING;
INSERT INTO public.evo_vault_products(id,kind,name,slug,product_mode,price,currency,is_active,category_id)
SELECT ('42000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid, 'book', 'Race '||n, 'race-'||n,
 'digital', 100, 'USD', true, '32000000-0000-4000-8000-000000000001'::uuid FROM generate_series(1,8) n;
INSERT INTO public.evo_vault_books(vault_product_id)
SELECT id FROM public.evo_vault_products WHERE slug LIKE 'race-%';
INSERT INTO public.evo_vault_book_assets(vault_product_id,title,file_path,file_size,is_primary)
SELECT id,'PDF','vault/'||slug||'.pdf',100,true FROM public.evo_vault_products WHERE slug LIKE 'race-%';

INSERT INTO public.evo_store_categories(id,name,slug,is_active) VALUES
 ('32000000-0000-4000-8000-000000000101','Price Concurrency','price-concurrency',true);
INSERT INTO public.evo_store_products(id,category_id,name,slug,product_mode,base_price,currency) VALUES
 ('42000000-0000-4000-8000-000000000101','32000000-0000-4000-8000-000000000101','Mutation First','price-race-mutation-first','physical',10,'USD'),
 ('42000000-0000-4000-8000-000000000102','32000000-0000-4000-8000-000000000101','Archive First','price-race-archive-first','physical',10,'USD'),
 ('42000000-0000-4000-8000-000000000103','32000000-0000-4000-8000-000000000101','Ordered A','price-race-ordered-a','physical',10,'USD'),
 ('42000000-0000-4000-8000-000000000104','32000000-0000-4000-8000-000000000101','Ordered B','price-race-ordered-b','physical',10,'USD');
INSERT INTO public.evo_store_products(id,category_id,name,slug,product_mode,base_price,currency)
SELECT ('42000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 '32000000-0000-4000-8000-000000000101','Inventory Race '||n,'inventory-race-'||n,
 'physical',10,'USD' FROM generate_series(105,113) n;
INSERT INTO public.evo_store_variants(id,product_id,sku,name,price,currency) VALUES
 ('52000000-0000-4000-8000-000000000101','42000000-0000-4000-8000-000000000101','PRICE-RACE-1','Mutation First',10,'USD'),
 ('52000000-0000-4000-8000-000000000102','42000000-0000-4000-8000-000000000102','PRICE-RACE-2','Archive First',10,'USD'),
 ('52000000-0000-4000-8000-000000000103','42000000-0000-4000-8000-000000000103','PRICE-RACE-3','Ordered A',10,'USD'),
 ('52000000-0000-4000-8000-000000000104','42000000-0000-4000-8000-000000000104','PRICE-RACE-4','Ordered B',10,'USD');
INSERT INTO public.evo_store_variants(id,product_id,sku,name,price,currency)
SELECT ('52000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 ('42000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 'INV-RACE-'||n,'Inventory Race '||n,10,'USD' FROM generate_series(105,113) n;
INSERT INTO public.evo_store_variant_prices(id,variant_id,currency,amount) VALUES
 ('72000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000101','USD',10),
 ('72000000-0000-4000-8000-000000000002','52000000-0000-4000-8000-000000000102','USD',10),
 ('72000000-0000-4000-8000-000000000003','52000000-0000-4000-8000-000000000103','USD',10),
 ('72000000-0000-4000-8000-000000000004','52000000-0000-4000-8000-000000000104','EUR',10);
INSERT INTO public.evo_store_inventory(variant_id,quantity_on_hand)
SELECT ('52000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 CASE WHEN n IN (108,109) THEN 10 ELSE 20 END
FROM generate_series(105,112) n;
