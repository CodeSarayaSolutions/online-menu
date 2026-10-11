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


INSERT INTO sarayamenu.table_tabs(id,restaurant_id,table_id,waiter_id,status,total,payment_method,created_at,closed_at)
SELECT md5('onm-report-'||n::text)::uuid,'fixture-a','00000000-0000-4000-b000-000000000001','00000000-0000-4000-a000-000000000002','closed',2,CASE WHEN n%2=0 THEN 'card' ELSE 'cash' END,'2026-10-09T08:00:00Z','2026-10-09T10:00:00Z'::timestamptz+(n%10)*interval '1 minute' FROM generate_series(1,1205)n;
INSERT INTO sarayamenu.tab_items(tab_id,product_id,product_name,quantity,unit_price,total_price,station)
SELECT id,'fixture-coffee','Coffee',1,2,2,'bar' FROM sarayamenu.table_tabs WHERE restaurant_id='fixture-a';
DO $$ DECLARE r jsonb; page jsonb; ranks jsonb; seen uuid[]='{}'; id_text text; rejected boolean=false; started timestamptz=clock_timestamp();
BEGIN
 r=sarayamenu.hos_report('00000000-0000-4000-a000-000000000004','fixture-a','2026-10-08T22:00:00Z','2026-10-09T22:00:00Z','{}');
 ASSERT (r->'summary'->>'count')::int=1205,'Report truncated by row cap';
 ASSERT (r->'summary'->>'total')::numeric=2410,'Totals incomplete';
 ASSERT (r->'summary'->>'cash')::numeric=1206 AND (r->'summary'->>'card')::numeric=1204,'Payment split wrong';
 ASSERT jsonb_array_length(r->'rows')=50,'First page not bounded';
 ASSERT NOT ((r->'rows'->0) ? 'tab_items'),'Headers downloaded all line items';
 page=r;
 LOOP
  FOR id_text IN SELECT value->>'id' FROM jsonb_array_elements(page->'rows') LOOP
   ASSERT NOT id_text::uuid=ANY(seen),'Duplicate across keyset pages';seen=array_append(seen,id_text::uuid);
  END LOOP;
  EXIT WHEN page->'nextCursor'='null'::jsonb;
  page=sarayamenu.hos_report('00000000-0000-4000-a000-000000000004','fixture-a','2026-10-08T22:00:00Z','2026-10-09T22:00:00Z',jsonb_build_object('cursor',page->'nextCursor','version',r->'version','asOf',r->'asOf'));
 END LOOP;
 ASSERT cardinality(seen)=1205,'Keyset paging missed records with tied timestamps';
 ranks=sarayamenu.hos_report('00000000-0000-4000-a000-000000000004','fixture-a','2026-10-08T22:00:00Z','2026-10-09T22:00:00Z','{"section":"rankings"}');
 ASSERT (ranks->'rankings'->'products'->0->>'quantity')::int=1205,'Item aggregate truncated';
 page=sarayamenu.hos_report('00000000-0000-4000-a000-000000000004','fixture-a','2026-10-08T22:00:00Z','2026-10-09T22:00:00Z',jsonb_build_object('knownVersion',r->'version'));
 ASSERT (page->>'unchanged')::boolean,'Freshness check failed';
 page=sarayamenu.hos_report('00000000-0000-4000-a000-000000000003','fixture-a','2026-10-08T22:00:00Z','2026-10-09T22:00:00Z','{}');
 ASSERT (page->'summary'->>'count')::int=0,'Waiter can see other waiter report';
 BEGIN PERFORM sarayamenu.hos_report('00000000-0000-4000-a000-000000000004','fixture-b','2026-10-08T22:00:00Z','2026-10-09T22:00:00Z','{}');EXCEPTION WHEN insufficient_privilege THEN rejected=true; END;
 ASSERT rejected,'Cross-venue report allowed';rejected=false;
 UPDATE sarayamenu.table_tabs SET total=3 WHERE id=seen[1];
 BEGIN PERFORM sarayamenu.hos_report('00000000-0000-4000-a000-000000000004','fixture-a','2026-10-08T22:00:00Z','2026-10-09T22:00:00Z',jsonb_build_object('cursor',r->'nextCursor','version',r->'version','asOf',r->'asOf'));EXCEPTION WHEN serialization_failure THEN rejected=true;END;
 ASSERT rejected,'Mixed-version pagination accepted';
 -- Half-open adjacent windows do not count midnight twice.
 page=sarayamenu.hos_report('00000000-0000-4000-a000-000000000004','fixture-a','2026-10-09T10:00:00Z','2026-10-09T10:01:00Z','{}');
 ASSERT (page->'summary'->>'count')::int=120,'Exclusive end boundary wrong';
END $$;
SELECT 'PASS: 1205 bills and line items, full aggregates beyond REST cap, 50 headers only, tied-time keyset coverage, version cache, stale page rejection, actor/venue scoping, exclusive end' AS result;
ROLLBACK;
