BEGIN;
CREATE OR REPLACE FUNCTION sarayamenu.hos_import_receipt(p_actor uuid,p_venue text,p_key text,p_hash text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE r sarayamenu.operation_receipts; role_name text;
BEGIN
 role_name=sarayamenu.hos_role(p_actor,p_venue);
 IF role_name IS NULL OR role_name NOT IN ('admin','owner','manager') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM sarayamenu.operation_receipts WHERE actor_id=p_actor AND restaurant_id=p_venue AND request_key=p_key;
 IF NOT FOUND THEN RETURN NULL;END IF;
 IF r.action<>'menu.save' OR r.result->'importMetadata'->>'hash' IS DISTINCT FROM p_hash THEN RAISE EXCEPTION 'Conflicting retry' USING ERRCODE='23505';END IF;
 RETURN r.result;
END $$;
REVOKE ALL ON FUNCTION sarayamenu.hos_import_receipt(uuid,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION sarayamenu.hos_import_receipt(uuid,text,text,text) TO service_role;
NOTIFY pgrst,'reload schema';COMMIT;
