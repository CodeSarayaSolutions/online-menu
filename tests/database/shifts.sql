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


DO $$ DECLARE actor uuid='00000000-0000-4000-a000-000000000004'; future_date date=current_date+14; local_date date=(now() AT TIME ZONE 'Europe/Sarajevo')::date; r jsonb; before_roster jsonb; seg_id uuid; other_id uuid; summary jsonb; rejected boolean=false;
BEGIN
 r=sarayamenu.hos_shift_save(actor,'fixture-a','schedule',jsonb_build_object('dayOfWeek',extract(isodow from future_date),'opensAt','00:00','closesAt','23:59','isClosed',false,'segments',jsonb_build_array(jsonb_build_object('label','First','startsAt','00:00','endsAt','00:01'),jsonb_build_object('label','Second','startsAt','00:01','endsAt','23:59'))));
 r=sarayamenu.hos_roster('fixture-a',future_date);seg_id=(r->'segments'->0->>'segmentId')::uuid;other_id=(r->'segments'->1->>'segmentId')::uuid;
 r=sarayamenu.hos_shift_save(actor,'fixture-a','roster',jsonb_build_object('date',future_date,'segments',jsonb_build_array(jsonb_build_object('segmentId',seg_id,'assigneeIds',jsonb_build_array(actor,'00000000-0000-4000-a000-000000000002')),jsonb_build_object('segmentId',other_id,'assigneeIds','[]'::jsonb))));
 ASSERT r->'segments'->0->'assigneeIds' @> to_jsonb(actor),'Manager could not be assigned';
 ASSERT jsonb_array_length(r->'segments'->0->'assignments')=2,'Multiple staff not saved';
 before_roster=r;
 BEGIN PERFORM sarayamenu.hos_shift_save(actor,'fixture-a','roster',jsonb_build_object('date',future_date,'segments',jsonb_build_array(jsonb_build_object('segmentId',seg_id,'assigneeIds',jsonb_build_array('00000000-0000-4000-a000-000000000001')),jsonb_build_object('segmentId',other_id,'assigneeIds','[]'::jsonb))));EXCEPTION WHEN insufficient_privilege THEN rejected=true;END;
 ASSERT rejected,'Non-member assignment allowed';
 ASSERT sarayamenu.hos_roster('fixture-a',future_date)=before_roster,'Failed roster partially saved';
 INSERT INTO sarayamenu.day_shift_segments(id,restaurant_id,day_of_week,label,starts_at,ends_at,sort_order) VALUES('00000000-0000-4000-c000-000000000001','fixture-b',extract(isodow from future_date),'Foreign','08:00','09:00',0);
 rejected=false;
 BEGIN PERFORM sarayamenu.hos_shift_save(actor,'fixture-a','schedule',jsonb_build_object('dayOfWeek',extract(isodow from future_date),'opensAt','00:00','closesAt','23:59','isClosed',false,'segments',jsonb_build_array(jsonb_build_object('id','00000000-0000-4000-c000-000000000001','startsAt','08:00','endsAt','09:00'))));EXCEPTION WHEN insufficient_privilege THEN rejected=true;END;
 ASSERT rejected,'Foreign template ID accepted';
 r=sarayamenu.hos_shift_save(actor,'fixture-a','schedule',jsonb_build_object('dayOfWeek',extract(isodow from future_date),'opensAt','08:00','closesAt','20:00','isClosed',false,'segments',jsonb_build_array(jsonb_build_object('startsAt','08:00','endsAt','20:00'))));
 ASSERT sarayamenu.hos_roster('fixture-a',future_date)=before_roster,'Template edit rewrote saved roster';
 -- Test snapshot of a just-completed shift on this venue-local day.
 INSERT INTO sarayamenu.roster_snapshots(restaurant_id,roster_date,segments,timezone) VALUES('fixture-a',local_date,before_roster->'segments','Europe/Sarajevo');
 INSERT INTO sarayamenu.table_tabs(restaurant_id,table_id,waiter_id,status,total,payment_method,closed_at) VALUES
 ('fixture-a','00000000-0000-4000-b000-000000000001',actor,'closed',3,'cash',(local_date+time '00:00') AT TIME ZONE 'Europe/Sarajevo'),
 ('fixture-a','00000000-0000-4000-b000-000000000001','00000000-0000-4000-a000-000000000002','closed',5,'card',(local_date+time '00:01') AT TIME ZONE 'Europe/Sarajevo');
 summary=sarayamenu.hos_shift_summary(actor,'fixture-a',local_date,seg_id);
 ASSERT (summary->'totals'->>'revenue')::numeric=3,'Same-day summary missing or boundary doubled';
 ASSERT (summary->'byWaiter'->0->>'revenue')::numeric=3 AND summary->'byWaiter'->0->>'waiterId'=actor::text,'Manager waiter attribution wrong';
 rejected=false;
 BEGIN PERFORM sarayamenu.hos_shift_summary(actor,'fixture-a',local_date,'00000000-0000-4000-c000-000000000001');EXCEPTION WHEN insufficient_privilege THEN rejected=true;END;
 ASSERT rejected,'Foreign segment summary allowed';
END $$;
SELECT 'PASS: manager and multiple-staff roster, invalid assignment rollback, foreign segment rejection, saved roster survives template replacement, same-day summary, half-open shifts, responsible staff revenue' AS result;
ROLLBACK;
