BEGIN;
CREATE INDEX IF NOT EXISTS hos_stock_history ON sarayamenu.inventory_movements(restaurant_id,created_at DESC,id DESC);
-- Sales are quantities on settled bills, independently of whether stock is counted.
-- Return one product page or one movement page; never transfer the ledger wholesale.
CREATE OR REPLACE FUNCTION sarayamenu.hos_inventory(p_hash text,p_venue text,p_options jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE actor uuid; role_name text; zone text; first_date date; last_date date; starts timestamptz; ends timestamptz;
 rows jsonb; next_page jsonb; as_of timestamptz=coalesce((p_options->>'asOf')::timestamptz,now());
BEGIN
 SELECT u.id INTO actor FROM sarayamenu.sessions s JOIN sarayamenu.users u ON u.id=s.user_id WHERE s.token_hash=p_hash AND s.expires_at>now() AND s.purpose='full' AND s.credential_version=u.credential_version AND NOT u.onboarding_required;
 IF actor IS NULL THEN RAISE EXCEPTION 'Session unavailable' USING ERRCODE='28000';END IF;
 role_name=sarayamenu.hos_role(actor,p_venue);
 IF role_name IS NULL OR role_name NOT IN ('admin','owner','manager') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';END IF;
 SELECT timezone INTO zone FROM sarayamenu.restaurants WHERE id=p_venue;
 first_date=coalesce((p_options->>'from')::date,(now() AT TIME ZONE zone)::date);
 last_date=coalesce((p_options->>'to')::date,first_date);
 IF last_date<first_date OR last_date-first_date>366 THEN RAISE EXCEPTION 'Invalid period';END IF;
 starts=first_date::timestamp AT TIME ZONE zone;ends=(last_date+1)::timestamp AT TIME ZONE zone;
 IF p_options->>'mode'='movements' THEN
  WITH page AS (
   SELECT m.* FROM sarayamenu.inventory_movements m WHERE restaurant_id=p_venue AND created_at>=starts AND created_at<ends AND created_at<=as_of
   AND (NOT (p_options ? 'cursor') OR (created_at,id)<((p_options->'cursor'->>'at')::timestamptz,(p_options->'cursor'->>'id')::uuid))
   ORDER BY created_at DESC,id DESC LIMIT 51
  ), shown AS (SELECT * FROM page ORDER BY created_at DESC,id DESC LIMIT 50)
  SELECT coalesce((SELECT jsonb_agg(to_jsonb(s) ORDER BY created_at DESC,id DESC) FROM shown s),'[]'),
   CASE WHEN (SELECT count(*) FROM page)>50 THEN (SELECT jsonb_build_object('at',created_at,'id',id) FROM shown ORDER BY created_at,id LIMIT 1) END INTO rows,next_page;
 ELSE
  WITH page AS (
   SELECT p.id,p.name,i.id AS inventory_id,i.quantity,i.unit,coalesce(i.tracked,false) AS tracked
   FROM sarayamenu.products p LEFT JOIN sarayamenu.inventory i ON i.restaurant_id=p.restaurant_id AND i.product_id=p.id
   WHERE p.restaurant_id=p_venue AND (NOT (p_options ? 'cursor') OR p.id>p_options->'cursor'->>'id')
    AND (coalesce(p_options->>'search','')='' OR strpos(lower(p.name),lower(p_options->>'search'))>0)
   ORDER BY p.id LIMIT 101
  ), shown AS (SELECT * FROM page ORDER BY id LIMIT 100), sales AS (
   SELECT i.product_id,sum(i.quantity) AS sold,sum(i.total_price) AS revenue FROM sarayamenu.tab_items i JOIN sarayamenu.table_tabs t ON t.id=i.tab_id
   WHERE t.restaurant_id=p_venue AND t.status='closed' AND t.closed_at>=starts AND t.closed_at<ends AND t.closed_at<=as_of AND i.product_id IN(SELECT id FROM shown) GROUP BY i.product_id
  )
  SELECT coalesce((SELECT jsonb_agg(to_jsonb(s)||jsonb_build_object('sold',coalesce(v.sold,0),'revenue',coalesce(v.revenue,0)) ORDER BY s.id) FROM shown s LEFT JOIN sales v ON v.product_id=s.id),'[]'),
   CASE WHEN (SELECT count(*) FROM page)>100 THEN (SELECT jsonb_build_object('id',id) FROM shown ORDER BY id DESC LIMIT 1) END INTO rows,next_page;
 END IF;
 RETURN jsonb_build_object('rows',rows,'next',next_page,'asOf',as_of,'timezone',zone,'from',first_date,'to',last_date);
END $$;
REVOKE ALL ON FUNCTION sarayamenu.hos_inventory(text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION sarayamenu.hos_inventory(text,text,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
