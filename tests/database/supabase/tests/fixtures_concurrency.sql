INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
 email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES ('12000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','concurrency@example.test','',now(),'{}','{}',now(),now()) ON CONFLICT DO NOTHING;
INSERT INTO public.profiles(id,username) VALUES ('12000000-0000-4000-8000-000000000001','concurrency') ON CONFLICT DO NOTHING;
INSERT INTO public.evo_vault_categories(id,name,slug) VALUES ('32000000-0000-4000-8000-000000000001','Concurrency','concurrency') ON CONFLICT DO NOTHING;
INSERT INTO public.evo_vault_products(id,kind,name,slug,product_mode,price,currency,is_active,category_id)
SELECT ('42000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid, 'book', 'Race '||n, 'race-'||n,
 'digital', 100, 'USD', true, '32000000-0000-4000-8000-000000000001'::uuid FROM generate_series(1,8) n;
INSERT INTO public.evo_vault_books(vault_product_id)
SELECT id FROM public.evo_vault_products WHERE slug LIKE 'race-%';
INSERT INTO public.evo_vault_book_assets(vault_product_id,title,file_path,file_size,is_primary)
SELECT id,'PDF','vault/'||slug||'.pdf',100,true FROM public.evo_vault_products WHERE slug LIKE 'race-%';
