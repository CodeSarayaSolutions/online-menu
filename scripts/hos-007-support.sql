BEGIN;
CREATE INDEX IF NOT EXISTS hos_audit_recent ON sarayamenu.audit_events(occurred_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS hos_incident_recent ON sarayamenu.incidents(occurred_at DESC,id DESC);
CREATE OR REPLACE FUNCTION sarayamenu.hos_support_feed(p_actor uuid,p_options jsonb DEFAULT '{}') RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM sarayamenu.users WHERE id=p_actor AND platform_role='admin') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';END IF;
 IF p_options->>'kind'='incidents' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(row)),'[]') INTO result FROM (
   SELECT i.id::text,i.occurred_at,i.restaurant_id,i.actor_id,u.name AS actor_name,NULL::text AS actor_role,i.code AS action,'incident'::text AS entity_type,i.id::text AS entity_id,NULL::uuid AS responsible_waiter_id,i.context AS changes
   FROM sarayamenu.incidents i LEFT JOIN sarayamenu.users u ON u.id=i.actor_id
   WHERE (nullif(p_options->>'venue','') IS NULL OR i.restaurant_id=p_options->>'venue')
    AND (nullif(p_options->>'entity','') IS NULL OR i.id::text=p_options->>'entity')
    AND (NOT(p_options ? 'cursor') OR (i.occurred_at,i.id)<((p_options->'cursor'->>'at')::timestamptz,(p_options->'cursor'->>'id')::uuid)) ORDER BY i.occurred_at DESC,i.id DESC LIMIT 51
  )row;
 ELSE
  SELECT coalesce(jsonb_agg(to_jsonb(row)),'[]') INTO result FROM (
   SELECT a.id::text,a.occurred_at,a.restaurant_id,a.actor_id,u.name AS actor_name,a.actor_role,a.action,a.entity_type,a.entity_id,a.responsible_waiter_id,a.changes
   FROM sarayamenu.audit_events a LEFT JOIN sarayamenu.users u ON u.id=a.actor_id
   WHERE (nullif(p_options->>'venue','') IS NULL OR a.restaurant_id=p_options->>'venue')
    AND (nullif(p_options->>'entity','') IS NULL OR a.entity_id=p_options->>'entity' OR a.changes->'delta'->'tab_id' @> to_jsonb(p_options->>'entity'))
    AND (NOT(p_options ? 'cursor') OR (a.occurred_at,a.id)<((p_options->'cursor'->>'at')::timestamptz,(p_options->'cursor'->>'id')::bigint)) ORDER BY a.occurred_at DESC,a.id DESC LIMIT 51
  )row;
 END IF;
 RETURN jsonb_build_object('rows',(SELECT coalesce(jsonb_agg(value),'[]') FROM jsonb_array_elements(result) WITH ORDINALITY WHERE ordinality<=50),'nextCursor',CASE WHEN jsonb_array_length(result)>50 THEN jsonb_build_object('at',result->49->>'occurred_at','id',result->49->>'id') ELSE NULL END);
END $$;
REVOKE ALL ON FUNCTION sarayamenu.hos_support_feed(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION sarayamenu.hos_support_feed(uuid,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
