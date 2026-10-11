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

INSERT INTO sarayamenu.sessions(user_id,token_hash,expires_at,purpose,credential_version) VALUES('00000000-0000-4000-a000-000000000004','inventory-test-session',now()+interval '1 hour','full',0);
INSERT INTO sarayamenu.products(id,restaurant_id,category,name,price,station) VALUES('fixture-bottle','fixture-a','Drinks','Bottle',3,'bar');
DO $$ DECLARE actor uuid='00000000-0000-4000-a000-000000000004'; r jsonb; rejected boolean=false;
BEGIN
 r=sarayamenu.hos_action(actor,'inventory.initialize','fixture-a','{"productId":"fixture-bottle","quantity":24,"requestKey":"init-stock"}');
 r=sarayamenu.hos_action(actor,'inventory.initialize','fixture-a','{"productId":"fixture-bottle","quantity":24,"requestKey":"init-stock"}');
 ASSERT (SELECT quantity=24 FROM sarayamenu.inventory WHERE product_id='fixture-bottle'),'Initialization retry changed stock';
 ASSERT (SELECT sum(quantity_delta)=24 AND count(*)=1 FROM sarayamenu.inventory_movements WHERE product_id='fixture-bottle'),'Missing or duplicated initialization history';
 BEGIN PERFORM sarayamenu.hos_action(actor,'inventory.initialize','fixture-a','{"productId":"fixture-bottle","quantity":99,"requestKey":"reset-stock"}');EXCEPTION WHEN unique_violation THEN rejected=true;END;
 ASSERT rejected,'Initialization overwrote existing stock';
 r=sarayamenu.hos_action(actor,'inventory.adjust','fixture-a','{"productId":"fixture-bottle","delta":6,"requestKey":"restock"}');
 r=sarayamenu.hos_action(actor,'inventory.adjust','fixture-a','{"productId":"fixture-bottle","delta":6,"requestKey":"restock"}');
 ASSERT (SELECT quantity=30 FROM sarayamenu.inventory WHERE product_id='fixture-bottle'),'Restock repeated';
 r=sarayamenu.hos_action(actor,'inventory.tracked','fixture-a','{"productId":"fixture-coffee","tracked":false}');
 r=sarayamenu.hos_action(actor,'inventory.tracked','fixture-a','{"productId":"fixture-bottle","tracked":false}');
 ASSERT (SELECT quantity=30 FROM sarayamenu.inventory WHERE product_id='fixture-bottle'),'Disabling erased quantity';
 ASSERT (SELECT count(*)=2 FROM sarayamenu.inventory_movements WHERE product_id='fixture-bottle'),'Disabling erased history';
 rejected=false;
 BEGIN PERFORM sarayamenu.hos_action('00000000-0000-4000-a000-000000000002','inventory.adjust','fixture-a','{"productId":"fixture-bottle","delta":6}');EXCEPTION WHEN insufficient_privilege THEN rejected=true;END;
 ASSERT rejected,'Waiter can manually edit stock';
END $$;
INSERT INTO sarayamenu.table_tabs(id,restaurant_id,table_id,waiter_id,status,total,closed_at,payment_method)
VALUES('00000000-0000-4000-c000-000000000001','fixture-a','00000000-0000-4000-b000-000000000001','00000000-0000-4000-a000-000000000002','closed',2410,now(),'cash');
INSERT INTO sarayamenu.tab_items(tab_id,product_id,product_name,quantity,unit_price,total_price,station,fire_status)
SELECT '00000000-0000-4000-c000-000000000001','fixture-coffee','Coffee',1,2,2,'bar','fired' FROM generate_series(1,1205);
DO $$ DECLARE r jsonb; product jsonb; rejected boolean=false;
BEGIN
 r=sarayamenu.hos_inventory('inventory-test-session','fixture-a');
 SELECT value INTO product FROM jsonb_array_elements(r->'rows') WHERE value->>'id'='fixture-coffee';
 ASSERT product->>'sold'='1205' AND (product->>'revenue')::numeric=2410,'Untracked sales truncated or tied to stock movements';
 ASSERT product->>'tracked'='false' AND (product->>'quantity')::numeric=10,'Untracked sales deducted stock';
 r=sarayamenu.hos_inventory('inventory-test-session','fixture-a','{"mode":"movements"}');
 ASSERT jsonb_array_length(r->'rows')=2,'Stock movement read mismatch';
 BEGIN PERFORM sarayamenu.hos_inventory('inventory-test-session','fixture-b');EXCEPTION WHEN insufficient_privilege THEN rejected=true;END;
 ASSERT rejected,'Cross venue stock read allowed';
END $$;
SELECT 'inventory assertions passed; rolling back fixtures' AS result;
ROLLBACK;
