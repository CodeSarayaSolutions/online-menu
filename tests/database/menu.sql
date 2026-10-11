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

DO $$ DECLARE actor uuid='00000000-0000-4000-a000-000000000004'; result jsonb; rejected boolean=false; before_audit bigint;
BEGIN
 result=sarayamenu.hos_menu_save(actor,'fixture-a',0,'{"categoriesUpsert":[{"id":"fixture-drinks","label":"Drinks"}],"productsUpsert":[{"id":"fixture-coffee","name":"Coffee","price":3,"categoryId":"fixture-drinks","station":"kitchen","addons":[{"id":"fixture-sugar","name":"Sugar","price":0.5}],"variations":[{"id":"fixture-size","name":"Size","required":true,"options":[{"id":"fixture-large","label":"Large","priceAdjustment":1}]}]}]}','menu-1');
 ASSERT result->>'revision'='1','Revision did not advance';
 ASSERT (SELECT station='bar' AND category_id='fixture-drinks' FROM sarayamenu.products WHERE id='fixture-coffee'),'Category/routing wrong';
 result=sarayamenu.hos_menu_save(actor,'fixture-a',1,'{"productsUpsert":[{"id":"fixture-coffee","name":"Coffee","price":4,"categoryId":"fixture-drinks","station":"bar"}]}','menu-2');
 ASSERT (SELECT count(*)=1 FROM sarayamenu.addons WHERE product_id='fixture-coffee'),'Unchanged addons overwritten';
 ASSERT (SELECT count(*)=1 FROM sarayamenu.variation_options WHERE variation_id='fixture-size'),'Unchanged options overwritten';
 ASSERT (SELECT quantity=10 FROM sarayamenu.inventory WHERE product_id='fixture-coffee'),'Product save changed stock';
 BEGIN PERFORM sarayamenu.hos_menu_save(actor,'fixture-a',1,'{"pageContent":{"bad":"stale"}}','menu-stale'); EXCEPTION WHEN serialization_failure THEN rejected=true; END;
 ASSERT rejected,'Stale concurrent save was accepted';
 rejected=false;
 BEGIN
  PERFORM sarayamenu.hos_menu_save(actor,'fixture-a',2,'{"productsUpsert":[{"id":"fixture-coffee","name":"Broken","price":99,"categoryId":"fixture-drinks","station":"bar","addons":[{"id":"duplicate","name":"First","price":1},{"id":"duplicate","name":"Second","price":2}]}]}','menu-fail');
 EXCEPTION WHEN unique_violation THEN rejected=true; END;
 ASSERT rejected,'Failure injection did not fail';
 ASSERT (SELECT price=4 AND name='Coffee' FROM sarayamenu.products WHERE id='fixture-coffee'),'Failed save left partial product';
 ASSERT (SELECT count(*)=1 FROM sarayamenu.addons WHERE id='fixture-sugar'),'Failed save lost original addon';
 ASSERT (SELECT revision=2 FROM sarayamenu.restaurants WHERE id='fixture-a'),'Failed save advanced revision';
 SELECT count(*) INTO before_audit FROM sarayamenu.audit_events WHERE entity_type='products';
 result=sarayamenu.hos_menu_save(actor,'fixture-a',2,'{"pageContent":{"welcomeTitle":"Hello"}}','menu-content');
 ASSERT (SELECT count(*)=before_audit FROM sarayamenu.audit_events WHERE entity_type='products'),'Content save rewrote products';
 result=sarayamenu.hos_menu_save(actor,'fixture-a',2,'{"pageContent":{"welcomeTitle":"Hello"}}','menu-content');
 ASSERT result->>'revision'='3','Lost-response retry did not recover result';
 rejected=false;
 BEGIN PERFORM sarayamenu.hos_menu_save('00000000-0000-4000-a000-000000000002','fixture-a',3,'{}','menu-employee'); EXCEPTION WHEN insufficient_privilege THEN rejected=true; END;
 ASSERT rejected,'Waiter can change menu';
 result=sarayamenu.hos_menu_save(actor,'fixture-a',3,'{"productsUpsert":[{"id":"fixture-stock","name":"Bottle","price":2,"categoryId":"fixture-drinks","initialInventory":{"quantity":24,"tracked":true}}]}','menu-stock');
 ASSERT (SELECT quantity=24 AND tracked FROM sarayamenu.inventory WHERE product_id='fixture-stock'),'Initial stock was not saved atomically';
 ASSERT (SELECT sum(quantity_delta)=24 FROM sarayamenu.inventory_movements WHERE product_id='fixture-stock'),'Initial stock has no movement';
 result=sarayamenu.hos_menu_save(actor,'fixture-a',4,'{"productsUpsert":[{"id":"fixture-stock","name":"Bottle","price":3,"categoryId":"fixture-drinks","initialInventory":{"quantity":99,"tracked":true}}]}','menu-no-reset');
 ASSERT (SELECT quantity=24 FROM sarayamenu.inventory WHERE product_id='fixture-stock'),'Editing product reset existing stock';

 rejected=false;
 BEGIN PERFORM sarayamenu.hos_support_feed(actor,'{}');EXCEPTION WHEN insufficient_privilege THEN rejected=true;END;
 ASSERT rejected,'Venue manager can read platform logs';
 result=sarayamenu.hos_support_feed('00000000-0000-4000-a000-000000000001','{}');
 ASSERT jsonb_array_length(result->'rows')>0,'Platform audit feed empty';
 rejected=false;
 BEGIN PERFORM sarayamenu.hos_action(actor,'venue.configure','fixture-a','{"language":"en","timezone":"UTC","kitchenEnabled":true}');EXCEPTION WHEN insufficient_privilege THEN rejected=true;END;
 ASSERT rejected,'Manager can enable kitchen';
 result=sarayamenu.hos_menu_save('00000000-0000-4000-a000-000000000001','fixture-new',null,'{"restaurant":{"name":"New venue"},"platformConfig":{"language":"en","timezone":"UTC","kitchenEnabled":true}}','new-venue');
 ASSERT (SELECT language='en' AND timezone='UTC' AND kitchen_enabled FROM sarayamenu.restaurants WHERE id='fixture-new'),'Creation locale missing';
 result=sarayamenu.hos_menu_save(actor,'fixture-a',5,'{"categoriesUpsert":[{"id":"fixture-takeaway","label":"Drinks"}],"productsUpsert":[{"id":"fixture-takeaway-coffee","name":"Coffee","price":1,"categoryId":"fixture-takeaway","station":"bar"}]}','duplicate-label');
 ASSERT (SELECT category_id='fixture-takeaway' FROM sarayamenu.products WHERE id='fixture-takeaway-coffee'),'Duplicate label changed explicit identity';
 ASSERT (SELECT category_id='fixture-drinks' FROM sarayamenu.products WHERE id='fixture-coffee'),'Duplicate label moved existing item';
 rejected=false;
 BEGIN PERFORM sarayamenu.hos_menu_save(actor,'fixture-a',6,'{"productsUpsert":[{"id":"fixture-ambiguous","name":"Coffee","price":1,"category":"Drinks","station":"bar"}]}','ambiguous-category');EXCEPTION WHEN raise_exception THEN rejected=true;END;
 ASSERT rejected,'Ambiguous legacy category silently selected';

END $$;
SELECT 'PASS: atomic menu/options rollback, scoped changed sections, optimistic concurrency, category identity, station rules, idempotent retry' AS result;
ROLLBACK;
