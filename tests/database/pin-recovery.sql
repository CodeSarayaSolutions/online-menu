-- Isolated-schema regression; every fixture is rolled back.
BEGIN;
INSERT INTO sarayamenu.users(id,name,email,platform_role) VALUES
 ('00000000-0000-4000-a000-000000000001','Test Admin','admin@onm.invalid','admin'),
 ('00000000-0000-4000-a000-000000000002','Test Waiter','recovery@onm.invalid','user'),
 ('00000000-0000-4000-a000-000000000003','Other Waiter','other@onm.invalid','user'),
 ('00000000-0000-4000-a000-000000000004','Test Manager','manager@onm.invalid','user');
INSERT INTO sarayamenu.restaurants(id,name) VALUES('fixture-recovery','Recovery'),('fixture-other','Other');
INSERT INTO sarayamenu.restaurant_access(user_id,restaurant_id,role) VALUES
 ('00000000-0000-4000-a000-000000000002','fixture-recovery','employee'),
 ('00000000-0000-4000-a000-000000000003','fixture-other','employee'),
 ('00000000-0000-4000-a000-000000000004','fixture-recovery','manager');
DO $$
DECLARE a uuid='00000000-0000-4000-a000-000000000001';
 w uuid='00000000-0000-4000-a000-000000000002';
 other_user uuid='00000000-0000-4000-a000-000000000003';
 m uuid='00000000-0000-4000-a000-000000000004';
 bucket text=encode(sha256('login:recovery@onm.invalid'::bytea),'hex');
 other_bucket text=encode(sha256('login:other@onm.invalid'::bytea),'hex');
 result jsonb; i int; rejected boolean=false; version_before int;
BEGIN
 SELECT credential_version INTO version_before FROM sarayamenu.users WHERE id=w;
 PERFORM sarayamenu.hos_action(NULL,'auth.session','',jsonb_build_object('userId',w,'version',version_before,'tokenHash','fixture-old-session'));
 FOR i IN 1..6 LOOP result=sarayamenu.hos_action(NULL,'auth.attempt','',jsonb_build_object('key',bucket)); END LOOP;
 ASSERT NOT (result->>'allowed')::boolean,'Sixth attempt must be denied';
 INSERT INTO sarayamenu.login_limits(key_hash,attempts) VALUES(other_bucket,24);
 BEGIN
  PERFORM sarayamenu.hos_action(other_user,'staff.temporary-pin','fixture-recovery',jsonb_build_object('userId',w,'pinHash','fixture-new-hash'));
 EXCEPTION WHEN insufficient_privilege THEN rejected=true; END;
 ASSERT rejected,'Cross-venue reset allowed';
 ASSERT (SELECT attempts=6 FROM sarayamenu.login_limits WHERE key_hash=bucket),'Unauthorized recovery cleared lock';
 PERFORM sarayamenu.hos_action(m,'staff.temporary-pin','fixture-recovery',jsonb_build_object('userId',w,'pinHash','fixture-new-hash'));
 ASSERT NOT EXISTS(SELECT 1 FROM sarayamenu.login_limits WHERE key_hash=bucket),'Authorized reset left target locked';
 ASSERT (SELECT attempts=24 FROM sarayamenu.login_limits WHERE key_hash=other_bucket),'Reset unlocked another account';
 ASSERT NOT EXISTS(SELECT 1 FROM sarayamenu.sessions WHERE user_id=w),'Old session survived recovery';
 ASSERT (SELECT pin_hash='fixture-new-hash' AND onboarding_required AND credential_version=version_before+1 AND temporary_pin_expires_at>now() FROM sarayamenu.users WHERE id=w),'Credential recovery incomplete';
 result=sarayamenu.hos_action(NULL,'auth.attempt','',jsonb_build_object('key',bucket));
 ASSERT (result->>'allowed')::boolean,'First attempt after recovery denied';
 result=sarayamenu.hos_action(NULL,'auth.session','',jsonb_build_object('userId',w,'version',version_before+1,'tokenHash','fixture-new-session'));
 ASSERT (result->>'onboarding')::boolean,'Recovery did not require onboarding';
 ASSERT NOT EXISTS(SELECT 1 FROM sarayamenu.login_limits WHERE key_hash=bucket),'Success did not clear limiter';
 PERFORM sarayamenu.hos_action(a,'staff.temporary-pin','',jsonb_build_object('userId',other_user,'pinHash','fixture-other-hash'));
 ASSERT NOT EXISTS(SELECT 1 FROM sarayamenu.login_limits WHERE key_hash=other_bucket),'Platform reset did not unlock account';
 rejected=false;
 BEGIN
  PERFORM sarayamenu.hos_action(a,'staff.temporary-pin','',jsonb_build_object('userId','00000000-0000-4000-a000-000000000099','pinHash','fixture-missing'));
 EXCEPTION WHEN insufficient_privilege THEN rejected=true; END;
 ASSERT rejected,'Missing account reported successful reset';
END $$;
SELECT 'PIN recovery regression passed' AS result;
ROLLBACK;
