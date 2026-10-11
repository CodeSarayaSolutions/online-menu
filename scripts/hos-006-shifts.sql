BEGIN;
ALTER TABLE sarayamenu.roster_snapshots ADD COLUMN IF NOT EXISTS is_closed boolean NOT NULL DEFAULT false;
ALTER TABLE sarayamenu.roster_snapshots ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Sarajevo';
CREATE OR REPLACE FUNCTION sarayamenu.hos_roster(p_venue text,p_date date) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE snapshot sarayamenu.roster_snapshots; saved boolean; segments jsonb; closed boolean; dow integer=extract(isodow from p_date);
BEGIN
 SELECT * INTO snapshot FROM sarayamenu.roster_snapshots WHERE restaurant_id=p_venue AND roster_date=p_date;
 IF FOUND THEN segments=snapshot.segments;closed=snapshot.is_closed;saved=true;
 ELSE
  saved=EXISTS(SELECT 1 FROM sarayamenu.shift_daily_roster WHERE restaurant_id=p_venue AND roster_date=p_date);
  SELECT is_closed INTO closed FROM sarayamenu.restaurant_day_hours WHERE restaurant_id=p_venue AND day_of_week=dow;
  SELECT coalesce(jsonb_agg(jsonb_build_object('segmentId',s.id,'label',s.label,'startsAt',to_char(s.starts_at,'HH24:MI'),'endsAt',to_char(s.ends_at,'HH24:MI'),'hasSavedRoster',saved,
   'assigneeIds',coalesce(a.ids,'[]'),'assignments',coalesce(a.people,'[]')) ORDER BY s.sort_order),'[]') INTO segments
  FROM sarayamenu.day_shift_segments s LEFT JOIN LATERAL(
   SELECT jsonb_agg(x.user_id) AS ids,jsonb_agg(jsonb_build_object('id',x.id,'userId',x.user_id,'userName',u.name,'userEmail',u.email,'restaurantRole',x.restaurant_role)) AS people
   FROM (SELECT id,user_id,restaurant_role FROM sarayamenu.shift_date_assignments WHERE restaurant_id=p_venue AND roster_date=p_date AND segment_id=s.id AND saved
    UNION ALL SELECT id,user_id,restaurant_role FROM sarayamenu.day_shift_segment_assignments WHERE segment_id=s.id AND NOT saved) x JOIN sarayamenu.users u ON u.id=x.user_id
  )a ON true WHERE s.restaurant_id=p_venue AND s.day_of_week=dow;
 END IF;
 RETURN jsonb_build_object('date',p_date,'dayOfWeek',dow,'dayLabel',(ARRAY['Ponedjeljak','Utorak','Srijeda','Četvrtak','Petak','Subota','Nedjelja'])[dow],'isClosed',coalesce(closed,false),'hasSavedRoster',saved,'segments',segments);
END $$;
-- Freeze existing saved schedules before any future template edits can erase history.
INSERT INTO sarayamenu.roster_snapshots(restaurant_id,roster_date,segments,is_closed,timezone,saved_at)
SELECT d.restaurant_id,d.roster_date,sarayamenu.hos_roster(d.restaurant_id,d.roster_date)->'segments',coalesce((sarayamenu.hos_roster(d.restaurant_id,d.roster_date)->>'isClosed')::boolean,false),r.timezone,d.saved_at
FROM sarayamenu.shift_daily_roster d JOIN sarayamenu.restaurants r ON r.id=d.restaurant_id ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION sarayamenu.hos_shift_save(p_actor uuid,p_venue text,p_action text,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE role_name text; day_num int; seg jsonb; chosen jsonb; segment_id uuid; keep_ids uuid[]='{}'; v_date date; snapshot jsonb; result jsonb; person record; people jsonb; zone text; closed boolean; start_time time; end_time time; last_end time; saved_segment jsonb; segment_position int;
BEGIN
 role_name=sarayamenu.hos_role(p_actor,p_venue);
 IF role_name IS NULL OR role_name NOT IN ('admin','owner','manager') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('shifts:'||p_venue,0));
 PERFORM set_config('hos.actor_id',p_actor::text,true);PERFORM set_config('hos.action','shift.'||p_action,true);
 SELECT timezone INTO zone FROM sarayamenu.restaurants WHERE id=p_venue;
 IF p_action='schedule' THEN
  day_num=(p_data->>'dayOfWeek')::int;closed=(p_data->>'isClosed')::boolean;
  IF day_num IS NULL OR day_num NOT BETWEEN 1 AND 7 OR closed IS NULL THEN RAISE EXCEPTION 'Invalid day';END IF;
  IF NOT closed AND (p_data->>'closesAt')::time<=(p_data->>'opensAt')::time THEN RAISE EXCEPTION 'Invalid hours';END IF;
  FOR seg IN SELECT value FROM jsonb_array_elements(p_data->'segments') ORDER BY value->>'startsAt' LOOP
   IF seg->>'id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM sarayamenu.day_shift_segments WHERE id=(seg->>'id')::uuid AND restaurant_id=p_venue AND day_of_week=day_num) THEN RAISE EXCEPTION 'Foreign segment' USING ERRCODE='42501';END IF;
   start_time=(seg->>'startsAt')::time;end_time=(seg->>'endsAt')::time;
   IF NOT closed AND (start_time IS NULL OR end_time IS NULL OR start_time>=end_time OR start_time<(p_data->>'opensAt')::time OR end_time>(p_data->>'closesAt')::time OR start_time<last_end) THEN RAISE EXCEPTION 'Invalid shift bounds';END IF;
   last_end=end_time;
  END LOOP;
  INSERT INTO sarayamenu.restaurant_day_hours(restaurant_id,day_of_week,opens_at,closes_at,is_closed) VALUES(p_venue,day_num,(p_data->>'opensAt')::time,(p_data->>'closesAt')::time,closed)
  ON CONFLICT(restaurant_id,day_of_week) DO UPDATE SET opens_at=excluded.opens_at,closes_at=excluded.closes_at,is_closed=excluded.is_closed,updated_at=now();
  IF NOT closed THEN
   FOR seg IN SELECT value FROM jsonb_array_elements(p_data->'segments') LOOP
    segment_id=coalesce((seg->>'id')::uuid,gen_random_uuid());
    INSERT INTO sarayamenu.day_shift_segments(id,restaurant_id,day_of_week,label,starts_at,ends_at,sort_order) VALUES(segment_id,p_venue,day_num,coalesce(nullif(trim(seg->>'label'),''),'Smjena '||(cardinality(keep_ids)+1)),(seg->>'startsAt')::time,(seg->>'endsAt')::time,cardinality(keep_ids))
    ON CONFLICT(id) DO UPDATE SET label=excluded.label,starts_at=excluded.starts_at,ends_at=excluded.ends_at,sort_order=excluded.sort_order;
    keep_ids=array_append(keep_ids,segment_id);
   END LOOP;
  END IF;
  DELETE FROM sarayamenu.day_shift_segments WHERE restaurant_id=p_venue AND day_of_week=day_num AND NOT id=ANY(keep_ids);
  result=jsonb_build_object('ok',true);
 ELSIF p_action='roster' THEN
  v_date=(p_data->>'date')::date;day_num=extract(isodow from v_date);
  IF v_date IS NULL THEN RAISE EXCEPTION 'Date required';END IF;
  snapshot=sarayamenu.hos_roster(p_venue,v_date);
  IF (snapshot->>'isClosed')::boolean THEN RAISE EXCEPTION 'Venue closed';END IF;
  IF jsonb_array_length(p_data->'segments')<>jsonb_array_length(snapshot->'segments') THEN RAISE EXCEPTION 'Schedule changed' USING ERRCODE='40001';END IF;
  FOR seg IN SELECT value FROM jsonb_array_elements(p_data->'segments') LOOP
   segment_id=(seg->>'segmentId')::uuid;
   SELECT value INTO saved_segment FROM jsonb_array_elements(snapshot->'segments') WHERE value->>'segmentId'=segment_id::text;
   IF saved_segment IS NULL OR segment_id=ANY(keep_ids) THEN RAISE EXCEPTION 'Foreign or duplicate segment' USING ERRCODE='42501';END IF;
   keep_ids=array_append(keep_ids,segment_id);
   people='[]';
   FOR chosen IN SELECT DISTINCT value FROM jsonb_array_elements(seg->'assigneeIds') LOOP
    SELECT u.id,u.name,u.email,a.role INTO person FROM sarayamenu.users u JOIN sarayamenu.restaurant_access a ON a.user_id=u.id JOIN sarayamenu.restaurants r ON r.id=a.restaurant_id
    WHERE u.id=(chosen#>>'{}')::uuid AND a.restaurant_id=p_venue AND a.role IN ('employee','manager','bar','kitchen') AND (a.role<>'kitchen' OR r.kitchen_enabled);
    IF NOT FOUND THEN RAISE EXCEPTION 'Staff unavailable' USING ERRCODE='42501';END IF;
    people=people||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'userId',person.id,'userName',person.name,'userEmail',person.email,'restaurantRole',person.role));
   END LOOP;
   IF (v_date+(saved_segment->>'endsAt')::time) AT TIME ZONE zone<=now() AND NOT ((saved_segment->'assigneeIds') @> (seg->'assigneeIds') AND (saved_segment->'assigneeIds') <@ (seg->'assigneeIds')) THEN RAISE EXCEPTION 'Finished shift is read only' USING ERRCODE='42501';END IF;
   IF (v_date+(saved_segment->>'endsAt')::time) AT TIME ZONE zone<=now() THEN CONTINUE;END IF;
    SELECT ordinality::int-1 INTO segment_position FROM jsonb_array_elements(snapshot->'segments') WITH ORDINALITY WHERE value->>'segmentId'=segment_id::text;
    snapshot=jsonb_set(snapshot,ARRAY['segments',segment_position::text],saved_segment||jsonb_build_object('assigneeIds',coalesce(seg->'assigneeIds','[]'),'assignments',people,'hasSavedRoster',true));
  END LOOP;
  INSERT INTO sarayamenu.roster_snapshots(restaurant_id,roster_date,segments,is_closed,timezone) VALUES(p_venue,v_date,snapshot->'segments',false,zone)
  ON CONFLICT(restaurant_id,roster_date) DO UPDATE SET segments=excluded.segments,saved_at=now();
  INSERT INTO sarayamenu.shift_daily_roster(restaurant_id,roster_date) VALUES(p_venue,v_date) ON CONFLICT(restaurant_id,roster_date) DO UPDATE SET saved_at=now();
  result=sarayamenu.hos_roster(p_venue,v_date);
 ELSE RAISE EXCEPTION 'Unknown shift action'; END IF;
 RETURN result;
END $$;
DROP TRIGGER IF EXISTS hos_audit_change ON sarayamenu.roster_snapshots;
CREATE TRIGGER hos_audit_change AFTER INSERT OR UPDATE OR DELETE ON sarayamenu.roster_snapshots FOR EACH ROW EXECUTE FUNCTION sarayamenu.hos_audit();
REVOKE INSERT,UPDATE,DELETE ON sarayamenu.restaurant_day_hours,sarayamenu.day_shift_segments,sarayamenu.day_shift_segment_assignments,sarayamenu.shift_date_assignments,sarayamenu.shift_daily_roster FROM anon,authenticated;
REVOKE ALL ON FUNCTION sarayamenu.hos_roster(text,date),sarayamenu.hos_shift_save(uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION sarayamenu.hos_roster(text,date),sarayamenu.hos_shift_save(uuid,text,text,jsonb) TO service_role;
CREATE OR REPLACE FUNCTION sarayamenu.hos_shift_summary(p_actor uuid,p_venue text,p_date date,p_segment uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE role_name text; roster jsonb; seg jsonb; zone text; starts timestamptz; ends timestamptz; summary jsonb;
BEGIN
 role_name=sarayamenu.hos_role(p_actor,p_venue);
 IF role_name IS NULL OR role_name NOT IN ('admin','owner','manager') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';END IF;
 roster=sarayamenu.hos_roster(p_venue,p_date);
 SELECT value INTO seg FROM jsonb_array_elements(roster->'segments') WHERE value->>'segmentId'=p_segment::text;
 IF seg IS NULL THEN RAISE EXCEPTION 'Foreign segment' USING ERRCODE='42501';END IF;
 SELECT coalesce((SELECT timezone FROM sarayamenu.roster_snapshots WHERE restaurant_id=p_venue AND roster_date=p_date),timezone) INTO zone FROM sarayamenu.restaurants WHERE id=p_venue;
 starts=(p_date+(seg->>'startsAt')::time) AT TIME ZONE zone;ends=(p_date+(seg->>'endsAt')::time) AT TIME ZONE zone;
 IF ends<=starts THEN ends=ends+interval '1 day';END IF;
 IF ends>now() THEN RAISE EXCEPTION 'Shift has not ended' USING ERRCODE='42501';END IF;
 WITH tabs AS MATERIALIZED (SELECT t.*,coalesce(u.name,'—') AS waiter_name,coalesce(rt.label,'—') AS table_label FROM sarayamenu.table_tabs t LEFT JOIN sarayamenu.users u ON u.id=t.waiter_id LEFT JOIN sarayamenu.restaurant_tables rt ON rt.id=t.table_id WHERE t.restaurant_id=p_venue AND t.status='closed' AND t.closed_at>=starts AND t.closed_at<ends),
 lines AS MATERIALIZED (SELECT i.* FROM sarayamenu.tab_items i JOIN tabs t ON t.id=i.tab_id),
 waiter_totals AS (SELECT waiter_id AS "waiterId",max(waiter_name) AS "waiterName",count(*) AS "closedTabs",sum(total) AS revenue,coalesce(sum(total) FILTER(WHERE payment_method='cash'),0) AS "cashTotal",coalesce(sum(total) FILTER(WHERE payment_method='card'),0) AS "cardTotal",array_agg(DISTINCT table_label) AS tables,coalesce(sum((SELECT sum(quantity) FROM lines l WHERE l.tab_id=t.id)),0) AS "itemsSold" FROM tabs t GROUP BY waiter_id),
 table_totals AS (SELECT table_label AS "tableLabel",count(*) AS "closedTabs",sum(total) AS revenue,array_agg(DISTINCT waiter_name) AS waiters FROM tabs GROUP BY table_label),
 top_products AS (SELECT min(product_name) AS name,sum(quantity) AS quantity,sum(total_price) AS revenue FROM lines GROUP BY product_id ORDER BY sum(quantity) DESC LIMIT 15),
 tab_page AS (SELECT id,table_label AS "tableLabel",waiter_id AS "waiterId",waiter_name AS "waiterName",total,payment_method AS "paymentMethod",created_at AS "openedAt",closed_at AS "closedAt",'[]'::jsonb AS items FROM tabs ORDER BY closed_at DESC,id DESC LIMIT 50)
 SELECT jsonb_build_object('date',p_date,'dayLabel',roster->>'dayLabel','timezone',zone,'segment',seg||jsonb_build_object('id',p_segment,'dayOfWeek',roster->'dayOfWeek','sortOrder',0),
 'window',jsonb_build_object('from',starts,'to',ends),
 'totals',jsonb_build_object('revenue',coalesce(sum(total),0),'closedTabsCount',count(*),'qrOrdersCount',count(*) FILTER(WHERE origin='guest'),'itemsSold',coalesce((SELECT sum(quantity) FROM lines),0),'cashTotal',coalesce(sum(total) FILTER(WHERE payment_method='cash'),0),'cardTotal',coalesce(sum(total) FILTER(WHERE payment_method='card'),0)),
 'byWaiter',coalesce((SELECT jsonb_agg(to_jsonb(w) ORDER BY revenue DESC) FROM waiter_totals w),'[]'),
 'byTable',coalesce((SELECT jsonb_agg(to_jsonb(t) ORDER BY revenue DESC) FROM table_totals t),'[]'),
 'topProducts',coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM top_products p),'[]'),
 'closedTabs',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM tab_page t),'[]'),'qrOrders','[]'::jsonb) INTO summary FROM tabs;
 RETURN summary;
END $$;
REVOKE ALL ON FUNCTION sarayamenu.hos_shift_summary(uuid,text,date,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION sarayamenu.hos_shift_summary(uuid,text,date,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
