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

DO $$ DECLARE actor uuid='00000000-0000-4000-a000-000000000002'; bill uuid; line uuid; r jsonb; failed boolean=false; BEGIN
 bill=(sarayamenu.hos_action(actor,'tab.open','fixture-a','{"tableId":"00000000-0000-4000-b000-000000000001"}')->>'id')::uuid;
 r=sarayamenu.hos_action(actor,'tab.add','fixture-a',jsonb_build_object('tabId',bill,'productId','fixture-coffee','quantity',1,'fireStatus','backlog'));line=(r->>'id')::uuid;
 ASSERT r->>'fire_status'='backlog' AND r->>'fired_at' IS NULL,'Deferred round sent immediately';
 BEGIN PERFORM sarayamenu.hos_action('00000000-0000-4000-a000-000000000005','station.done','fixture-a',jsonb_build_object('tabId',bill,'station','bar','lines',jsonb_build_array(jsonb_build_object('id',line,'quantity',1))));EXCEPTION WHEN raise_exception THEN failed=true;END;ASSERT failed,'Bar acknowledged unsent backlog';failed=false;
 BEGIN PERFORM sarayamenu.hos_action(actor,'tab.fire','fixture-a',jsonb_build_object('tabId',bill,'itemIds',jsonb_build_array(line,'00000000-0000-4000-c000-000000000099')));EXCEPTION WHEN raise_exception THEN failed=true;END;ASSERT failed,'Invalid mixed batch activated partial backlog';
 ASSERT (SELECT fire_status='backlog' FROM sarayamenu.tab_items WHERE id=line),'Batch failed partially';
 PERFORM sarayamenu.hos_action(actor,'tab.fire','fixture-a',jsonb_build_object('tabId',bill,'itemIds',jsonb_build_array(line),'requestKey','fire-once'));
 PERFORM sarayamenu.hos_action(actor,'tab.fire','fixture-a',jsonb_build_object('tabId',bill,'itemIds',jsonb_build_array(line),'requestKey','fire-once'));
 ASSERT (SELECT fire_status='fired' AND fired_at IS NOT NULL FROM sarayamenu.tab_items WHERE id=line),'Backlog activation failed';
 ASSERT (SELECT total=2 AND status='open' FROM sarayamenu.table_tabs WHERE id=bill),'Activation changed money';
 ASSERT (SELECT quantity=10 FROM sarayamenu.inventory WHERE product_id='fixture-coffee'),'Activation deducted inventory';
END $$;
ROLLBACK;
SELECT 'PASS: deferred round, atomic activation batch, repeat activation, no money or stock side effects' AS result;
