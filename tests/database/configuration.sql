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

DO $$ DECLARE actor uuid='00000000-0000-4000-a000-000000000004'; admin_id uuid='00000000-0000-4000-a000-000000000001'; r jsonb; ident uuid; failed boolean=false;
BEGIN
 r=sarayamenu.hos_action(actor,'table.create','fixture-a','{"label":"New table","capacity":4,"requestKey":"table-new"}'); ident=(r->>'id')::uuid;
 ASSERT sarayamenu.hos_action(actor,'table.create','fixture-a','{"label":"New table","capacity":4,"requestKey":"table-new"}')->>'id'=ident::text,'Table retry duplicated';
 BEGIN PERFORM sarayamenu.hos_action(actor,'table.update','fixture-b',jsonb_build_object('id',ident,'label','Bad','capacity',4));EXCEPTION WHEN insufficient_privilege THEN failed=true;END;
 ASSERT failed,'Cross-venue table update allowed';failed=false;
 BEGIN PERFORM sarayamenu.hos_action('00000000-0000-4000-a000-000000000002','table.retire','fixture-a',jsonb_build_object('id',ident));EXCEPTION WHEN insufficient_privilege THEN failed=true;END;
 ASSERT failed,'Waiter retired table';
 PERFORM sarayamenu.hos_action(actor,'table.retire','fixture-a',jsonb_build_object('id',ident));
 ASSERT (SELECT NOT is_active FROM sarayamenu.restaurant_tables WHERE id=ident),'Table not retired';
 r=sarayamenu.hos_action(actor,'happyhour.save','fixture-a','{"startTime":"22:00","endTime":"02:00","active":true,"products":[{"productId":"fixture-coffee","overridePrice":1}],"requestKey":"happy-save"}');ident=(r->>'id')::uuid;
 ASSERT (r->'products'->0->>'override_price')::numeric=1,'Happy-hour price missing';failed=false;
 BEGIN PERFORM sarayamenu.hos_action(actor,'happyhour.save','fixture-a',jsonb_build_object('id',ident,'label','Broken','startTime','10:00','endTime','12:00','active',true,'products','[{"productId":"missing","overridePrice":2}]'::jsonb));EXCEPTION WHEN raise_exception THEN failed=true;END;
 ASSERT failed,'Invalid product accepted';
 ASSERT (SELECT start_time='22:00'::time FROM sarayamenu.happy_hour_schedules WHERE id=ident),'Failed save changed schedule';
 ASSERT (SELECT override_price=1 FROM sarayamenu.happy_hour_products WHERE schedule_id=ident),'Failed save lost prices';
 PERFORM sarayamenu.hos_action(actor,'happyhour.delete','fixture-a',jsonb_build_object('id',ident));
 ASSERT NOT EXISTS(SELECT 1 FROM sarayamenu.happy_hour_products WHERE schedule_id=ident),'Delete left prices';
 PERFORM sarayamenu.hos_action(admin_id,'venue.delete','fixture-b','{"requestKey":"delete-empty"}');
 ASSERT NOT EXISTS(SELECT 1 FROM sarayamenu.restaurants WHERE id='fixture-b'),'Empty venue not deleted';
 ASSERT EXISTS(SELECT 1 FROM sarayamenu.audit_events WHERE actor_id=actor AND restaurant_id='fixture-a' AND action='table.retire'),'No attributed table audit';
END $$;
SET LOCAL ROLE anon;
DO $$ DECLARE failed boolean=false; BEGIN
 BEGIN UPDATE sarayamenu.restaurants SET kitchen_enabled=true WHERE id='fixture-a';EXCEPTION WHEN insufficient_privilege THEN failed=true;END;
 ASSERT failed,'Direct browser kitchen configuration allowed';failed=false;
 BEGIN DELETE FROM sarayamenu.happy_hour_products;EXCEPTION WHEN insufficient_privilege THEN failed=true;END;
 ASSERT failed,'Direct browser happy-hour mutation allowed';
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: atomic configuration, table ownership, retries, audit and write boundaries' AS result;
