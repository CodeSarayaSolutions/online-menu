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

UPDATE sarayamenu.restaurants SET kitchen_enabled=true WHERE id='fixture-a';
INSERT INTO sarayamenu.component_styles(restaurant_id,styles) VALUES('fixture-a','{"viewOnlyMode":false}') ON CONFLICT(restaurant_id) DO UPDATE SET styles=excluded.styles;
INSERT INTO sarayamenu.guest_sessions(token_hash,restaurant_id,table_id,expires_at) VALUES('guest-test-hash','fixture-a','00000000-0000-4000-b000-000000000001',now()+interval '5 minutes');
INSERT INTO sarayamenu.users(id,name,email,platform_role) VALUES('00000000-0000-4000-a000-000000000006','Kitchen','kitchen@onm.invalid','user');
INSERT INTO sarayamenu.restaurant_access(user_id,restaurant_id,role) VALUES('00000000-0000-4000-a000-000000000006','fixture-a','kitchen');
INSERT INTO sarayamenu.variations(id,product_id,name,required,min_select,max_select) VALUES('fixture-size','fixture-coffee','Size',true,1,1);
INSERT INTO sarayamenu.variation_options(id,variation_id,label,price_adjustment) VALUES('fixture-large','fixture-size','Large',1);
INSERT INTO sarayamenu.addons(id,product_id,name,price) VALUES('fixture-sugar','fixture-coffee','Sugar',0.5);
DO $$ DECLARE r jsonb; order_id text; bill uuid; line_id uuid; rejected boolean=false; count_before bigint;
 items jsonb='[{"id":"fixture-coffee","name":"FORGED","quantity":2,"price":0.01,"station":"bar","selectedVariations":[{"variationId":"fixture-size","optionId":"fixture-large","priceAdjustment":-99}],"selectedAddons":[{"id":"fixture-sugar","quantity":2,"price":0}]}]';
BEGIN
 BEGIN PERFORM sarayamenu.hos_guest_submit('guest-test-hash','fixture-b','request-wrong-venue',items,'','00000000-0000-4000-b000-000000000001');EXCEPTION WHEN invalid_authorization_specification THEN rejected=true;END;
 ASSERT rejected,'Cross venue guest order accepted';rejected=false;
 BEGIN PERFORM sarayamenu.hos_guest_submit('guest-test-hash','fixture-a','request-options-missing','[{"id":"fixture-coffee","quantity":2}]','','00000000-0000-4000-b000-000000000001');EXCEPTION WHEN raise_exception THEN rejected=true;END;
 ASSERT rejected,'Required option bypassed';
 r=sarayamenu.hos_guest_submit('guest-test-hash','fixture-a','request-guest-1',items,'Test note','00000000-0000-4000-b000-000000000001');order_id=r->>'id';
 ASSERT (r->>'total')::numeric=8,'Client pricing trusted';
 ASSERT (SELECT o.items->0->>'name'='Coffee' AND o.items->0->>'station'='kitchen' AND payment_method='unpaid' FROM sarayamenu.orders o WHERE id=order_id),'Client metadata or payment trusted';
 r=sarayamenu.hos_guest_submit('guest-test-hash','fixture-a','request-guest-1',items,'Test note','00000000-0000-4000-b000-000000000001');ASSERT r->>'id'=order_id,'Retry duplicated order';
 ASSERT (SELECT count(*)=0 FROM sarayamenu.table_tabs WHERE restaurant_id='fixture-a'),'Pending order created bill before acceptance';
 rejected=false;BEGIN PERFORM sarayamenu.hos_guest_decide('00000000-0000-4000-a000-000000000004','fixture-a',order_id,true,15);EXCEPTION WHEN insufficient_privilege THEN rejected=true;END;ASSERT rejected,'Manager can operate bar';
 r=sarayamenu.hos_guest_decide('00000000-0000-4000-a000-000000000005','fixture-a',order_id,true,15);bill=(r->>'tabId')::uuid;
 r=sarayamenu.hos_guest_decide('00000000-0000-4000-a000-000000000005','fixture-a',order_id,true,15);ASSERT (r->>'tabId')::uuid=bill,'Acceptance not idempotent';
 ASSERT (SELECT count(*)=1 FROM sarayamenu.tab_items WHERE tab_id=bill),'Acceptance duplicated lines';
 ASSERT (SELECT waiter_id IS NULL AND origin='guest' AND total=8 AND status='open' FROM sarayamenu.table_tabs WHERE id=bill),'Guest bill state wrong';
 SELECT id INTO line_id FROM sarayamenu.tab_items WHERE tab_id=bill;
 r=sarayamenu.hos_action('00000000-0000-4000-a000-000000000005','station.done','fixture-a',jsonb_build_object('tabId',bill,'station','bar','lines',jsonb_build_array(jsonb_build_object('id',line_id,'quantity',2))));
 ASSERT (SELECT status='preparing' FROM sarayamenu.orders WHERE id=order_id),'Bar acknowledgement skipped kitchen';
 r=sarayamenu.hos_action('00000000-0000-4000-a000-000000000006','station.done','fixture-a',jsonb_build_object('tabId',bill,'station','kitchen','lines',jsonb_build_array(jsonb_build_object('id',line_id,'quantity',2))));
 ASSERT (SELECT status='ready' FROM sarayamenu.orders WHERE id=order_id),'Preparation readiness missing';
 ASSERT (SELECT quantity=10 FROM sarayamenu.inventory WHERE product_id='fixture-coffee'),'Preparation deducted stock';
 ASSERT (SELECT status='open' AND total=8 AND closed_at IS NULL FROM sarayamenu.table_tabs WHERE id=bill),'Preparation settled bill';
 r=sarayamenu.hos_action('00000000-0000-4000-a000-000000000002','tab.claim','fixture-a',jsonb_build_object('tabId',bill));
 rejected=false;BEGIN PERFORM sarayamenu.hos_action('00000000-0000-4000-a000-000000000003','tab.claim','fixture-a',jsonb_build_object('tabId',bill));EXCEPTION WHEN insufficient_privilege THEN rejected=true;END;ASSERT rejected,'Second waiter stole responsibility';
 r=sarayamenu.hos_action('00000000-0000-4000-a000-000000000002','tab.add','fixture-a',jsonb_build_object('tabId',bill,'productId','fixture-coffee','quantity',1));
 ASSERT (SELECT origin='guest' AND waiter_id='00000000-0000-4000-a000-000000000002' FROM sarayamenu.table_tabs WHERE id=bill),'Waiter addition lost guest origin';
 r=sarayamenu.hos_action('00000000-0000-4000-a000-000000000002','tab.close','fixture-a',jsonb_build_object('tabId',bill,'paymentMethod','cash','requestKey','settle-guest-bill'));
 ASSERT (SELECT quantity=7 FROM sarayamenu.inventory WHERE product_id='fixture-coffee'),'Guest and waiter stock not settled together';
 ASSERT (SELECT total=10 AND status='closed' FROM sarayamenu.table_tabs WHERE id=bill),'Guest and waiter money not settled together';
 UPDATE sarayamenu.guest_sessions SET expires_at=now()-interval '1 second' WHERE token_hash='guest-test-hash';
 rejected=false;BEGIN PERFORM sarayamenu.hos_guest_submit('guest-test-hash','fixture-a','request-expired',items,'','00000000-0000-4000-b000-000000000001');EXCEPTION WHEN invalid_authorization_specification THEN rejected=true;END;ASSERT rejected,'Expired session accepted';
 -- A lost-response retry recovers the existing receipt even after expiry.
 r=sarayamenu.hos_guest_submit('guest-test-hash','fixture-a','request-guest-1',items,'Test note','00000000-0000-4000-b000-000000000001');ASSERT r->>'id'=order_id,'Expired successful retry duplicated or disappeared';
 ASSERT EXISTS(SELECT 1 FROM sarayamenu.audit_events WHERE actor_id='00000000-0000-4000-a000-000000000005' AND action='guest.accept'),'Bar acceptance actor not audited';
END $$;
SELECT 'guest ordering, pricing, acceptance, stations, responsibility, settlement assertions passed' AS result;
ROLLBACK;
