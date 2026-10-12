-- ONM-32: authorized PIN recovery clears the target account's login lockout.
-- Patch only this branch, preserving all later hos_action migrations.
BEGIN;
DO $migration$
DECLARE definition text; old_branch text=$old$  UPDATE sarayamenu.users SET pin_hash=p_data->>'pinHash',onboarding_required=true,temporary_pin_expires_at=now()+interval '7 days',credential_version=credential_version+1 WHERE id=target_id AND (platform_role<>'admin' OR role_name='admin');
$old$; new_branch text=$new$  UPDATE sarayamenu.users SET pin_hash=p_data->>'pinHash',onboarding_required=true,temporary_pin_expires_at=now()+interval '7 days',credential_version=credential_version+1 WHERE id=target_id AND (platform_role<>'admin' OR role_name='admin') RETURNING * INTO target_user;
  IF NOT FOUND THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  -- Authorized credential recovery must also clear the old account lockout.
  DELETE FROM sarayamenu.login_limits WHERE key_hash=encode(sha256(('login:'||lower(trim(target_user.email)))::bytea),'hex');
$new$;
BEGIN
 SELECT pg_get_functiondef('sarayamenu.hos_action(uuid,text,text,jsonb)'::regprocedure) INTO definition;
 IF position(new_branch IN definition)>0 THEN RETURN; END IF;
 IF position(old_branch IN definition)=0 THEN RAISE EXCEPTION 'Unexpected hos_action temporary PIN definition'; END IF;
 EXECUTE replace(definition,old_branch,new_branch);
END $migration$;
NOTIFY pgrst,'reload schema';
COMMIT;
