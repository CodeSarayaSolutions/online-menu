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
DO $$
DECLARE a uuid='00000000-0000-4000-a000-000000000002'; b uuid='00000000-0000-4000-a000-000000000003'; m uuid='00000000-0000-4000-a000-000000000004'; bar uuid='00000000-0000-4000-a000-000000000005'; t uuid; x jsonb; l uuid; rejected boolean=false; audit_count int;
BEGIN
 x=sarayamenu.hos_action(a,'tab.open','fixture-a','{"tableId":"00000000-0000-4000-b000-000000000001","requestKey":"open-1"}'); t=(x->>'id')::uuid;
 BEGIN PERFORM sarayamenu.hos_action(b,'tab.add','fixture-a',jsonb_build_object('tabId',t,'productId','fixture-coffee','quantity',1)); EXCEPTION WHEN insufficient_privilege THEN rejected=true; END;
 ASSERT rejected,'Another waiter edited assigned table';
 rejected=false;
 BEGIN PERFORM sarayamenu.hos_action(m,'tab.enter','fixture-a',jsonb_build_object('tabId',t)); EXCEPTION WHEN insufficient_privilege THEN rejected=true; END;
 ASSERT rejected,'Manager bypassed intervention acknowledgement';
 PERFORM sarayamenu.hos_action(m,'tab.enter','fixture-a',jsonb_build_object('tabId',t,'intervention',true));
 ASSERT (SELECT waiter_id=a FROM sarayamenu.table_tabs WHERE id=t),'Intervention transferred responsibility';
 x=sarayamenu.hos_action(a,'tab.add','fixture-a',jsonb_build_object('tabId',t,'productId','fixture-coffee','quantity',1,'requestKey','round-1')); l=(x->>'id')::uuid;
 ASSERT x->>'station'='bar','Disabled kitchen did not route to bar';
 UPDATE sarayamenu.products SET price=3 WHERE id='fixture-coffee';
 PERFORM sarayamenu.hos_action(a,'tab.add','fixture-a',jsonb_build_object('tabId',t,'productId','fixture-coffee','quantity',1,'requestKey','round-2'));
 ASSERT (SELECT total=5 FROM sarayamenu.table_tabs WHERE id=t),'Second round lost its current price';
 ASSERT (SELECT count(*)=2 FROM sarayamenu.tab_items WHERE tab_id=t),'Rounds merged unexpectedly';
 PERFORM sarayamenu.hos_action(bar,'station.done','fixture-a',jsonb_build_object('tabId',t,'station','bar','lines',jsonb_build_array(jsonb_build_object('id',l,'quantity',1))));
 ASSERT (SELECT total=5 AND status='open' FROM sarayamenu.table_tabs WHERE id=t),'Preparation changed money or settlement';
 ASSERT (SELECT count(*)=1 FROM sarayamenu.tab_items WHERE tab_id=t AND bar_done_quantity<quantity),'Acknowledgement hid unseen round';
 x=jsonb_build_object('tabId',t,'paymentMethod','cash','requestKey','settle-1');
 PERFORM sarayamenu.hos_action(a,'tab.close','fixture-a',x);
 PERFORM sarayamenu.hos_action(a,'tab.close','fixture-a',x);
 ASSERT (SELECT quantity=8 FROM sarayamenu.inventory WHERE product_id='fixture-coffee'),'Retry deducted twice';
 ASSERT (SELECT count(*)=1 FROM sarayamenu.inventory_movements WHERE tab_id=t),'Movement duplicated';
 ASSERT (SELECT waiter_id=a AND settled_by=a AND total=5 FROM sarayamenu.table_tabs WHERE id=t),'Settlement attribution or total wrong';
 rejected=false;
 BEGIN PERFORM sarayamenu.hos_action(a,'tab.add','fixture-a',jsonb_build_object('tabId',t,'productId','fixture-coffee','quantity',1)); EXCEPTION WHEN unique_violation THEN rejected=true; END;
 ASSERT rejected,'Settled bill accepted mutation';
 rejected=false;
 BEGIN UPDATE sarayamenu.audit_events SET action='tampered'; EXCEPTION WHEN insufficient_privilege THEN rejected=true; END;
 ASSERT rejected,'Audit updated';
 ASSERT EXISTS(SELECT 1 FROM sarayamenu.audit_events WHERE actor_id=m AND action='tab.enter' AND responsible_waiter_id=a),'Intervention missing actual actor and responsibility';
END $$;

-- Profile/RLS checks use the real anonymous PostgREST role and custom session header.
INSERT INTO sarayamenu.sessions(user_id,token_hash,expires_at) VALUES('00000000-0000-4000-a000-000000000002',encode(sha256('fixture-session'::bytea),'hex'),now()+interval '1 hour');
SET LOCAL ROLE anon;
SELECT set_config('request.headers','{}',true);
DO $$ DECLARE rejected boolean=false; BEGIN
 ASSERT (SELECT count(*)=0 FROM sarayamenu.table_tabs),'Anonymous tab visibility';
 ASSERT (SELECT count(*)=0 FROM sarayamenu.inventory_movements),'Anonymous movement visibility';
 BEGIN PERFORM * FROM sarayamenu.audit_events; EXCEPTION WHEN insufficient_privilege THEN rejected=true; END;
 ASSERT rejected,'Audit readable by anonymous role';
END $$;
SELECT set_config('request.headers','{"x-sarayamenu-session":"fixture-session"}',true);
DO $$ DECLARE rejected boolean=false; BEGIN
 ASSERT (SELECT count(*)>0 FROM sarayamenu.users),'Staff names not visible';
 BEGIN UPDATE sarayamenu.users SET platform_role='admin' WHERE id='00000000-0000-4000-a000-000000000002'; EXCEPTION WHEN insufficient_privilege THEN rejected=true; END;
 ASSERT rejected,'Profile self-elevation possible';
 rejected=false;
 BEGIN PERFORM pin_hash FROM sarayamenu.users; EXCEPTION WHEN insufficient_privilege THEN rejected=true; END;
 ASSERT rejected,'Credential hash exposed';
 rejected=false;
 BEGIN UPDATE sarayamenu.table_tabs SET total=0; EXCEPTION WHEN insufficient_privilege THEN rejected=true; END;
 ASSERT rejected,'Direct financial mutation possible';
 rejected=false;
 BEGIN PERFORM sarayamenu.hos_action('00000000-0000-4000-a000-000000000001','tab.open','fixture-a','{}'); EXCEPTION WHEN insufficient_privilege THEN rejected=true; END;
 ASSERT rejected,'Browser can impersonate service RPC actor';
END $$;
RESET ROLE;
DO $$ DECLARE x jsonb; uid uuid; rejected boolean=false; BEGIN
 x=sarayamenu.hos_action('00000000-0000-4000-a000-000000000004','staff.create','fixture-a','{"firstName":"New","lastName":"Staff","email":"new@onm.invalid","phone":"123456","role":"employee","pinHash":"fixture-hash"}');
 uid=(x->>'id')::uuid;
 ASSERT (SELECT onboarding_required FROM sarayamenu.users WHERE id=uid),'New staff bypassed onboarding';
 x=sarayamenu.hos_action(NULL,'auth.session','',jsonb_build_object('userId',uid,'version',0,'tokenHash',encode(sha256('fixture-challenge'::bytea),'hex')));
 ASSERT (x->>'onboarding')::boolean,'Temporary PIN gave full session';
 PERFORM set_config('request.headers','{"x-sarayamenu-session":"fixture-challenge"}',true);
 ASSERT sarayamenu.current_app_user_id() IS NULL,'Onboarding challenge authorized RLS';
 x=sarayamenu.hos_action(NULL,'auth.onboard','',jsonb_build_object('tokenHash',encode(sha256('fixture-challenge'::bytea),'hex'),'newTokenHash',encode(sha256('fixture-full'::bytea),'hex'),'pinHash','new-fixture-hash'));
 ASSERT NOT EXISTS(SELECT 1 FROM sarayamenu.sessions WHERE token_hash=encode(sha256('fixture-challenge'::bytea),'hex')),'Challenge reusable';
 PERFORM set_config('request.headers','{"x-sarayamenu-session":"fixture-full"}',true);
 ASSERT sarayamenu.current_app_user_id()=uid,'Completed onboarding has no full session';
 BEGIN PERFORM sarayamenu.hos_action('00000000-0000-4000-a000-000000000004','staff.role','fixture-a',jsonb_build_object('userId',uid,'role','owner')); EXCEPTION WHEN insufficient_privilege THEN rejected=true; END;
 ASSERT rejected,'Manager created owner';
 rejected=false;
 BEGIN PERFORM sarayamenu.hos_action('00000000-0000-4000-a000-000000000004','staff.role','fixture-a',jsonb_build_object('userId',uid,'role','kitchen')); EXCEPTION WHEN raise_exception THEN rejected=true; END;
 ASSERT rejected,'Kitchen role assigned at disabled venue';
 PERFORM sarayamenu.hos_action('00000000-0000-4000-a000-000000000004','staff.temporary-pin','fixture-a',jsonb_build_object('userId',uid,'pinHash','reset-fixture-hash'));
 ASSERT sarayamenu.current_app_user_id() IS NULL,'Reset failed to invalidate old session';
END $$;
DO $$ DECLARE rejected boolean=false; target uuid='00000000-0000-4000-a000-000000000003'; admin_id uuid='00000000-0000-4000-a000-000000000001'; BEGIN
 PERFORM sarayamenu.hos_action(admin_id,'staff.platform-role','fixture-a',jsonb_build_object('userId',target,'role','admin'));
 ASSERT (SELECT platform_role='admin' FROM sarayamenu.users WHERE id=target),'Platform role not persisted';
 BEGIN PERFORM sarayamenu.hos_action('00000000-0000-4000-a000-000000000004','staff.platform-role','fixture-a',jsonb_build_object('userId',target,'role','user'));EXCEPTION WHEN insufficient_privilege THEN rejected=true;END;
 ASSERT rejected,'Manager changed platform role';
 PERFORM sarayamenu.hos_action(admin_id,'staff.platform-role','fixture-a',jsonb_build_object('userId',target,'role','user'));
 ASSERT (SELECT platform_role='user' FROM sarayamenu.users WHERE id=target),'Platform demotion not persisted';
 rejected=false;BEGIN DELETE FROM sarayamenu.audit_events;EXCEPTION WHEN insufficient_privilege THEN rejected=true;END;ASSERT rejected,'Audit deletion permitted';
 rejected=false;BEGIN TRUNCATE sarayamenu.audit_events;EXCEPTION WHEN insufficient_privilege THEN rejected=true;END;ASSERT rejected,'Audit truncation permitted';
END $$;
SELECT 'PASS: ownership, intervention, price snapshots, preparation, settlement, audit, actual anon-role grants, staff creation and mandatory PIN onboarding' AS result;
ROLLBACK;
