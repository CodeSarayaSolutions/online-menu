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

CREATE FUNCTION sarayamenu.test_reject_movement() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected movement failure'; END $$;
CREATE TRIGGER test_reject_movement BEFORE INSERT ON sarayamenu.inventory_movements FOR EACH ROW EXECUTE FUNCTION sarayamenu.test_reject_movement();
DO $$ DECLARE actor uuid='00000000-0000-4000-a000-000000000002'; tab_id uuid; failed boolean=false; events_before bigint;
BEGIN
 tab_id=(sarayamenu.hos_action(actor,'tab.open','fixture-a','{"tableId":"00000000-0000-4000-b000-000000000001"}')->>'id')::uuid;
 PERFORM sarayamenu.hos_action(actor,'tab.add','fixture-a',jsonb_build_object('tabId',tab_id,'productId','fixture-coffee','quantity',2,'fireStatus','fired'));
 SELECT count(*) INTO events_before FROM sarayamenu.audit_events;
 BEGIN PERFORM sarayamenu.hos_action(actor,'tab.close','fixture-a',jsonb_build_object('tabId',tab_id,'paymentMethod','cash','requestKey','injected-close'));EXCEPTION WHEN raise_exception THEN failed=true;END;
 ASSERT failed,'Failure injection did not run';
 ASSERT (SELECT status='open' AND closed_at IS NULL AND total=4 FROM sarayamenu.table_tabs WHERE id=tab_id),'Failed settlement changed bill';
 ASSERT (SELECT quantity=10 FROM sarayamenu.inventory WHERE product_id='fixture-coffee'),'Stock decrement survived failed settlement';
 ASSERT (SELECT count(*)=events_before FROM sarayamenu.audit_events),'Failed settlement left audit changes';
 ASSERT NOT EXISTS(SELECT 1 FROM sarayamenu.operation_receipts WHERE request_key='injected-close'),'Failed settlement saved success receipt';
 DROP TRIGGER test_reject_movement ON sarayamenu.inventory_movements;
 PERFORM sarayamenu.hos_action(actor,'tab.close','fixture-a',jsonb_build_object('tabId',tab_id,'paymentMethod','cash','requestKey','injected-close'));
 ASSERT (SELECT quantity=8 FROM sarayamenu.inventory WHERE product_id='fixture-coffee'),'Recovery did not deduct exactly once';
 ASSERT (SELECT count(*)=1 FROM sarayamenu.inventory_movements WHERE inventory_movements.tab_id=(SELECT id FROM sarayamenu.table_tabs WHERE restaurant_id='fixture-a')),'Recovery movement missing';
END $$;
ROLLBACK;
SELECT 'PASS: injected stock-history failure rolls back bill, stock, audit and receipt; same-key recovery succeeds' AS result;
