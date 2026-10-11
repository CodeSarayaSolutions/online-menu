BEGIN;
CREATE TABLE IF NOT EXISTS sarayamenu.report_versions(restaurant_id text PRIMARY KEY REFERENCES sarayamenu.restaurants(id) ON DELETE CASCADE, version bigint NOT NULL DEFAULT 0);
ALTER TABLE sarayamenu.report_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON sarayamenu.report_versions FROM PUBLIC,anon,authenticated;
CREATE OR REPLACE FUNCTION sarayamenu.hos_report_changed() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v text; row_data jsonb;
BEGIN
 row_data=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 v=row_data->>'restaurant_id';
 IF TG_TABLE_NAME='tab_items' THEN SELECT restaurant_id INTO v FROM sarayamenu.table_tabs WHERE id=(row_data->>'tab_id')::uuid; END IF;
 IF v IS NOT NULL AND EXISTS(SELECT 1 FROM sarayamenu.restaurants WHERE id=v) THEN
  INSERT INTO sarayamenu.report_versions(restaurant_id,version) VALUES(v,1) ON CONFLICT(restaurant_id) DO UPDATE SET version=report_versions.version+1;
 END IF;
 RETURN NULL;
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['table_tabs','tab_items','orders'] LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS hos_report_change ON sarayamenu.%I',t);
 EXECUTE format('CREATE TRIGGER hos_report_change AFTER INSERT OR UPDATE OR DELETE ON sarayamenu.%I FOR EACH ROW EXECUTE FUNCTION sarayamenu.hos_report_changed()',t);
 END LOOP;
END $$;
CREATE INDEX IF NOT EXISTS hos_report_paid ON sarayamenu.table_tabs(restaurant_id,closed_at DESC,id DESC) INCLUDE(total,payment_method,waiter_id) WHERE status='closed';
CREATE INDEX IF NOT EXISTS hos_report_open ON sarayamenu.table_tabs(restaurant_id,created_at DESC,id DESC) WHERE status='open';
CREATE INDEX IF NOT EXISTS hos_report_lines ON sarayamenu.tab_items(tab_id);

CREATE OR REPLACE FUNCTION sarayamenu.hos_report(p_actor uuid,p_venue text,p_from timestamptz,p_to timestamptz,p_options jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE role_name text; version_now bigint; summary jsonb; headers jsonb; rankings jsonb; detail jsonb;
 cursor_at timestamptz; cursor_id uuid; as_of timestamptz; next_cursor jsonb; mode text; self_only boolean; result jsonb;
BEGIN
 role_name=sarayamenu.hos_role(p_actor,p_venue);
 IF role_name IS NULL OR role_name NOT IN ('admin','owner','manager','employee') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 self_only=role_name='employee';
 IF p_from IS NULL OR p_to IS NULL OR p_from>=p_to OR p_to-p_from>interval '367 days' THEN RAISE EXCEPTION 'Invalid period'; END IF;
 SELECT coalesce((SELECT version FROM sarayamenu.report_versions WHERE restaurant_id=p_venue),0) INTO version_now;
 IF p_options ? 'detail' THEN
  SELECT to_jsonb(t)||jsonb_build_object('table_label',rt.label,'waiter_name',u.name,'tab_items',coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.created_at,i.id) FROM sarayamenu.tab_items i WHERE i.tab_id=t.id),'[]')) INTO detail
  FROM sarayamenu.table_tabs t LEFT JOIN sarayamenu.restaurant_tables rt ON rt.id=t.table_id LEFT JOIN sarayamenu.users u ON u.id=t.waiter_id
  WHERE t.id=(p_options->>'detail')::uuid AND t.restaurant_id=p_venue AND (NOT self_only OR t.waiter_id=p_actor);
  IF detail IS NULL THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  RETURN jsonb_build_object('detail',detail,'version',version_now);
 END IF;
 IF p_options ? 'cursor' AND (p_options->>'version')::bigint IS DISTINCT FROM version_now THEN RAISE EXCEPTION 'Report changed' USING ERRCODE='40001'; END IF;
 IF p_options ? 'knownVersion' AND (p_options->>'knownVersion')::bigint=version_now THEN RETURN jsonb_build_object('unchanged',true,'version',version_now,'checkedAt',now()); END IF;
 mode=coalesce(p_options->>'mode','closed');
 IF mode NOT IN ('closed','open') THEN RAISE EXCEPTION 'Invalid mode'; END IF;
 as_of=coalesce((p_options->>'asOf')::timestamptz,now());
 cursor_at=(p_options->'cursor'->>'at')::timestamptz; cursor_id=(p_options->'cursor'->>'id')::uuid;
 IF p_options->>'section'='rankings' THEN
  WITH period_tabs AS (SELECT id,waiter_id,total FROM sarayamenu.table_tabs WHERE restaurant_id=p_venue AND status='closed' AND closed_at>=p_from AND closed_at<p_to AND closed_at<=as_of AND (NOT self_only OR waiter_id=p_actor)),
  top_products AS (SELECT i.product_id,min(i.product_name) AS name,sum(i.quantity) AS quantity,sum(i.total_price) AS total FROM sarayamenu.tab_items i JOIN period_tabs t ON t.id=i.tab_id GROUP BY i.product_id ORDER BY sum(i.quantity) DESC,i.product_id LIMIT 10),
  waiters AS (SELECT t.waiter_id,max(u.name) AS name,count(*) AS bills,sum(t.total) AS total FROM period_tabs t LEFT JOIN sarayamenu.users u ON u.id=t.waiter_id GROUP BY t.waiter_id ORDER BY sum(t.total) DESC)
  SELECT jsonb_build_object('products',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM top_products p),'[]'),'waiters',coalesce((SELECT jsonb_agg(to_jsonb(w)) FROM waiters w),'[]')) INTO rankings;
  RETURN jsonb_build_object('rankings',rankings,'version',version_now);
 END IF;
 IF NOT (p_options ? 'cursor') THEN
  SELECT jsonb_build_object('count',count(*),'total',coalesce(sum(total),0),'cash',coalesce(sum(total) FILTER(WHERE payment_method IN ('cash','gotovina')),0),'card',coalesce(sum(total) FILTER(WHERE payment_method IN ('card','kartica')),0)) INTO summary
  FROM sarayamenu.table_tabs WHERE restaurant_id=p_venue AND status='closed' AND closed_at>=p_from AND closed_at<p_to AND closed_at<=as_of AND (NOT self_only OR waiter_id=p_actor);
  summary=summary||jsonb_build_object('openCount',(SELECT count(*) FROM sarayamenu.table_tabs WHERE restaurant_id=p_venue AND status='open' AND (NOT self_only OR waiter_id=p_actor)),
   'legacyGuestCount',CASE WHEN self_only THEN 0 ELSE (SELECT count(*) FROM sarayamenu.orders WHERE restaurant_id=p_venue AND linked_tab_id IS NULL AND created_at>=p_from AND created_at<p_to) END);
 END IF;
 WITH candidates AS (
  SELECT t.id,t.created_at,t.closed_at,t.total,t.payment_method,t.waiter_id,t.origin,t.status,rt.label AS table_label,u.name AS waiter_name,
   CASE WHEN mode='closed' THEN t.closed_at ELSE t.created_at END AS sort_at
  FROM sarayamenu.table_tabs t LEFT JOIN sarayamenu.restaurant_tables rt ON rt.id=t.table_id LEFT JOIN sarayamenu.users u ON u.id=t.waiter_id
  WHERE t.restaurant_id=p_venue AND t.status=mode AND (NOT self_only OR t.waiter_id=p_actor)
   AND (mode='open' OR (t.closed_at>=p_from AND t.closed_at<p_to AND t.closed_at<=as_of))
   AND (cursor_at IS NULL OR (CASE WHEN mode='closed' THEN t.closed_at ELSE t.created_at END,t.id)<(cursor_at,cursor_id))
  ORDER BY sort_at DESC,t.id DESC LIMIT 51
 ), page AS (SELECT * FROM candidates ORDER BY sort_at DESC,id DESC LIMIT 50)
 SELECT coalesce(jsonb_agg(to_jsonb(page)-'sort_at' ORDER BY sort_at DESC,id DESC),'[]'),
  CASE WHEN (SELECT count(*) FROM candidates)>50 THEN (SELECT jsonb_build_object('at',sort_at,'id',id) FROM page ORDER BY sort_at,id LIMIT 1) ELSE NULL END INTO headers,next_cursor FROM page;
 result=jsonb_build_object('rows',headers,'nextCursor',next_cursor,'summary',summary,'version',version_now,'asOf',as_of,'from',p_from,'to',p_to,'checkedAt',now());
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION sarayamenu.hos_report_changed(),sarayamenu.hos_report(uuid,text,timestamptz,timestamptz,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION sarayamenu.hos_report(uuid,text,timestamptz,timestamptz,jsonb) TO service_role;
-- Authenticate the custom session and run the report in one database round-trip.
CREATE OR REPLACE FUNCTION sarayamenu.hos_session_report(p_hash text,p_venue text,p_range text,p_from date DEFAULT NULL,p_to date DEFAULT NULL,p_options jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; zone text; lang text; first_date date; last_date date; result jsonb;
BEGIN
 SELECT u.id INTO actor FROM sarayamenu.sessions s JOIN sarayamenu.users u ON u.id=s.user_id WHERE s.token_hash=p_hash AND s.expires_at>now() AND s.purpose='full' AND s.credential_version=u.credential_version AND NOT u.onboarding_required;
 IF actor IS NULL THEN RAISE EXCEPTION 'Session unavailable' USING ERRCODE='28000';END IF;
 SELECT timezone,language INTO zone,lang FROM sarayamenu.restaurants WHERE id=p_venue;
 IF zone IS NULL THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';END IF;
 first_date=(now() AT TIME ZONE zone)::date;
 IF p_range='week' THEN first_date=first_date-(extract(isodow from first_date)::int-1);last_date=first_date+6;
 ELSIF p_range='today' THEN last_date=first_date;
 ELSIF p_range='custom' THEN first_date=p_from;last_date=p_to;
 ELSE RAISE EXCEPTION 'Invalid range';END IF;
 result=sarayamenu.hos_report(actor,p_venue,first_date::timestamp AT TIME ZONE zone,(last_date+1)::timestamp AT TIME ZONE zone,p_options);
 RETURN result||jsonb_build_object('timezone',zone,'language',lang);
END $$;
REVOKE ALL ON FUNCTION sarayamenu.hos_session_report(text,text,text,date,date,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION sarayamenu.hos_session_report(text,text,text,date,date,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
