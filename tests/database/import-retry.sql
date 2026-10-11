-- Run only against an isolated schema. Every fixture is rolled back.
BEGIN;
INSERT INTO sarayamenu.users(id,name,email,platform_role) VALUES
 ('00000000-0000-4000-a000-000000000001','Test Admin','admin@onm.invalid','admin'),
 ('00000000-0000-4000-a000-000000000002','Test Waiter A','a@onm.invalid','user'),
 ('00000000-0000-4000-a000-000000000003','Test Waiter B','b@onm.invalid','user'),
 ('00000000-0000-4000-a000-000000000004','Test Manager','manager@onm.invalid','user'),
 ('00000000-0000-4000-a000-000000000005','Test Bar','bar@onm.invalid','user');
INSERT INTO sarayamenu.restaurants(id,name) VALUES('fixture-a','Fixture A'),('fixture-b','Fixture B');
INSERT INTO sarayamenu.restaurant_access(user_id,restaurant_id,role) VALUES
 ('00000000-0000-4000-a000-000000000002','fixture-a','employee'),
 ('00000000-0000-4000-a000-000000000003','fixture-a','employee'),
 ('00000000-0000-4000-a000-000000000004','fixture-a','manager'),
 ('00000000-0000-4000-a000-000000000005','fixture-a','bar');
INSERT INTO sarayamenu.restaurant_tables(id,restaurant_id,label) VALUES('00000000-0000-4000-b000-000000000001','fixture-a','1');
INSERT INTO sarayamenu.products(id,restaurant_id,category,name,price,station) VALUES('fixture-coffee','fixture-a','Drinks','Coffee',2,'kitchen');
INSERT INTO sarayamenu.inventory(restaurant_id,product_id,product_name,quantity,unit,tracked) VALUES('fixture-a','fixture-coffee','Coffee',10,'kom',true);

DO $$ DECLARE actor uuid='00000000-0000-4000-a000-000000000004'; r jsonb; again jsonb; rejected boolean=false;
BEGIN
 ASSERT sarayamenu.hos_import_receipt(actor,'fixture-a','import-test','payload-hash') IS NULL,'Unexpected import receipt';
 r=sarayamenu.hos_menu_save(actor,'fixture-a',0,'{"importMetadata":{"hash":"payload-hash"},"categoriesUpsert":[{"id":"fixture-drinks","label":"Drinks"}]}','import-test');
 again=sarayamenu.hos_import_receipt(actor,'fixture-a','import-test','payload-hash');
 ASSERT r=again AND again->>'revision'='1','Lost-response import recovery failed';
 BEGIN PERFORM sarayamenu.hos_import_receipt(actor,'fixture-a','import-test','different-hash');EXCEPTION WHEN unique_violation THEN rejected=true;END;
 ASSERT rejected,'Different payload re-used import receipt';rejected=false;
 BEGIN PERFORM sarayamenu.hos_import_receipt('00000000-0000-4000-a000-000000000002','fixture-a','import-test','payload-hash');EXCEPTION WHEN insufficient_privilege THEN rejected=true;END;
 ASSERT rejected,'Waiter could recover admin import';
END $$;
ROLLBACK;
SELECT 'PASS: menu import lost-response recovery, payload binding and permissions' AS result;
