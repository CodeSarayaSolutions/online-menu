BEGIN;
ALTER TABLE sarayamenu.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE sarayamenu.orders ADD CONSTRAINT orders_payment_method_check CHECK(payment_method IN ('cash','card','online','unpaid'));
ALTER TABLE sarayamenu.orders ADD COLUMN IF NOT EXISTS table_id uuid REFERENCES sarayamenu.restaurant_tables(id), ADD COLUMN IF NOT EXISTS guest_token_hash text, ADD COLUMN IF NOT EXISTS request_key text, ADD COLUMN IF NOT EXISTS request_fingerprint text;
CREATE UNIQUE INDEX IF NOT EXISTS hos_guest_retry ON sarayamenu.orders(guest_token_hash,request_key) WHERE guest_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS hos_pending_guest ON sarayamenu.orders(restaurant_id,created_at,id) WHERE status='pending';
REVOKE INSERT,UPDATE,DELETE ON sarayamenu.orders FROM anon,authenticated;
DROP TRIGGER IF EXISTS hos_audit_change ON sarayamenu.orders;
CREATE TRIGGER hos_audit_change AFTER INSERT OR UPDATE OR DELETE ON sarayamenu.orders FOR EACH ROW EXECUTE FUNCTION sarayamenu.hos_audit();

CREATE OR REPLACE FUNCTION sarayamenu.hos_guest_submit(p_hash text,p_venue text,p_request text,p_items jsonb,p_note text,p_table uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE session_row sarayamenu.guest_sessions; venue sarayamenu.restaurants; product sarayamenu.products; saved sarayamenu.orders;
 item jsonb; choice jsonb; option_row record; addon_row sarayamenu.addons; v record; group_row record;
 selections jsonb; extras jsonb; normalized jsonb='[]'; chosen_options text[]; chosen_variations text[]; chosen_addons text[];
 qty int; addon_qty int; price numeric; grand_total numeric=0; items_count int=0; fingerprint text; dest text;
BEGIN
 IF length(p_request) NOT BETWEEN 10 AND 100 OR jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 50 OR length(coalesce(p_note,''))>1000 THEN RAISE EXCEPTION 'Invalid order';END IF;
 SELECT * INTO session_row FROM sarayamenu.guest_sessions WHERE token_hash=p_hash AND restaurant_id=p_venue AND table_id=p_table FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Session unavailable' USING ERRCODE='28000';END IF;
 fingerprint=encode(sha256((p_items::text||coalesce(p_note,''))::bytea),'hex');
 SELECT * INTO saved FROM sarayamenu.orders WHERE guest_token_hash=p_hash AND request_key=p_request;
 IF FOUND THEN
  IF saved.request_fingerprint<>fingerprint THEN RAISE EXCEPTION 'Conflicting retry' USING ERRCODE='23505';END IF;
  RETURN jsonb_build_object('id',saved.id,'total',saved.total,'status',saved.status);
 END IF;
 IF session_row.expires_at<=now() THEN RAISE EXCEPTION 'Session expired' USING ERRCODE='28000';END IF;
 SELECT * INTO venue FROM sarayamenu.restaurants WHERE id=p_venue;
 IF coalesce((SELECT (styles->>'viewOnlyMode')::boolean FROM sarayamenu.component_styles WHERE restaurant_id=p_venue),true) THEN RAISE EXCEPTION 'Ordering unavailable' USING ERRCODE='42501';END IF;
 PERFORM 1 FROM sarayamenu.restaurant_tables WHERE id=p_table AND restaurant_id=p_venue AND is_active FOR UPDATE;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM sarayamenu.table_tabs WHERE table_id=p_table AND closed_at>session_row.created_at) THEN RAISE EXCEPTION 'Seating changed' USING ERRCODE='23505';END IF;
 IF (SELECT count(*) FROM sarayamenu.orders WHERE guest_token_hash=p_hash)>=10 THEN RAISE EXCEPTION 'Order limit';END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
  SELECT * INTO product FROM sarayamenu.products WHERE id=item->>'id' AND restaurant_id=p_venue;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product unavailable';END IF;
  qty=(item->>'quantity')::int;IF qty IS NULL OR qty NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid quantity';END IF;
  SELECT hp.override_price INTO price FROM sarayamenu.happy_hour_products hp JOIN sarayamenu.happy_hour_schedules h ON h.id=hp.schedule_id WHERE hp.product_id=product.id AND h.restaurant_id=p_venue AND h.active AND CASE WHEN h.start_time<h.end_time THEN (now() AT TIME ZONE venue.timezone)::time>=h.start_time AND (now() AT TIME ZONE venue.timezone)::time<h.end_time ELSE (now() AT TIME ZONE venue.timezone)::time>=h.start_time OR (now() AT TIME ZONE venue.timezone)::time<h.end_time END ORDER BY h.start_time DESC,h.id DESC LIMIT 1;
  price=coalesce(price,product.price);selections='[]';extras='[]';chosen_options='{}';chosen_variations='{}';chosen_addons='{}';
  FOR choice IN SELECT value FROM jsonb_array_elements(coalesce(item->'selectedVariations','[]')) LOOP
   SELECT o.*,pv.name AS variation_name INTO option_row FROM sarayamenu.variation_options o JOIN sarayamenu.variations pv ON pv.id=o.variation_id WHERE o.id=choice->>'optionId' AND pv.product_id=product.id AND pv.id=choice->>'variationId';
   IF NOT FOUND OR option_row.id=ANY(chosen_options) THEN RAISE EXCEPTION 'Invalid option';END IF;
   chosen_options=array_append(chosen_options,option_row.id);chosen_variations=array_append(chosen_variations,option_row.variation_id);price=price+option_row.price_adjustment;
   selections=selections||jsonb_build_array(jsonb_build_object('variationId',option_row.variation_id,'optionId',option_row.id,'variationName',option_row.variation_name,'optionLabel',option_row.label,'priceAdjustment',option_row.price_adjustment));
  END LOOP;
  FOR v IN SELECT * FROM sarayamenu.variations WHERE product_id=product.id LOOP
   SELECT count(*) INTO addon_qty FROM unnest(chosen_variations) AS selected(id) WHERE id=v.id;
   IF addon_qty<greatest(coalesce(v.min_select,0),CASE WHEN v.required THEN 1 ELSE 0 END) OR addon_qty>coalesce(v.max_select,1) THEN RAISE EXCEPTION 'Variation selection invalid';END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM sarayamenu.variation_options WHERE id=ANY(chosen_options) AND depends_on_option_id IS NOT NULL AND NOT(depends_on_option_id=ANY(chosen_options))) THEN RAISE EXCEPTION 'Option dependency missing';END IF;
  FOR choice IN SELECT value FROM jsonb_array_elements(coalesce(item->'selectedAddons','[]')) LOOP
   SELECT * INTO addon_row FROM sarayamenu.addons WHERE id=choice->>'id' AND product_id=product.id;
   addon_qty=(choice->>'quantity')::int;
   IF NOT FOUND OR addon_row.id=ANY(chosen_addons) OR addon_qty IS NULL OR addon_qty NOT BETWEEN 1 AND 20 OR (addon_row.depends_on_option_id IS NOT NULL AND NOT(addon_row.depends_on_option_id=ANY(chosen_options))) THEN RAISE EXCEPTION 'Invalid addon';END IF;
   chosen_addons=array_append(chosen_addons,addon_row.id);price=price+addon_qty*addon_row.price;
   extras=extras||jsonb_build_array(jsonb_build_object('id',addon_row.id,'name',addon_row.name,'quantity',addon_qty,'price',addon_row.price,'groupId',addon_row.group_id));
  END LOOP;
  FOR group_row IN SELECT group_id,max(coalesce(min_select,0)) AS minimum,max(max_select) AS maximum FROM sarayamenu.addons WHERE product_id=product.id AND group_id IS NOT NULL AND (depends_on_option_id IS NULL OR depends_on_option_id=ANY(chosen_options)) GROUP BY group_id LOOP
   SELECT coalesce(sum((value->>'quantity')::int),0) INTO addon_qty FROM jsonb_array_elements(extras) WHERE value->>'groupId'=group_row.group_id;
   IF addon_qty<group_row.minimum OR (group_row.maximum IS NOT NULL AND addon_qty>group_row.maximum) THEN RAISE EXCEPTION 'Addon group selection invalid';END IF;
  END LOOP;
  IF price<0 OR price::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid menu price';END IF;
  dest=CASE WHEN venue.kitchen_enabled THEN product.station ELSE 'bar' END;
  normalized=normalized||jsonb_build_array(jsonb_build_object('id',product.id,'cartKey',gen_random_uuid(),'name',product.name,'price',price,'quantity',qty,'station',dest,'selectedVariations',selections,'selectedAddons',extras));
  grand_total=grand_total+price*qty;items_count=items_count+qty;
 END LOOP;
 PERFORM set_config('hos.action','guest.submit',true);
 INSERT INTO sarayamenu.orders(id,restaurant_id,table_id,table_number,items,kitchen_note,total,item_count,payment_method,status,guest_token_hash,request_key,request_fingerprint)
 VALUES('ORD-'||upper(gen_random_uuid()::text),p_venue,p_table,(SELECT label FROM sarayamenu.restaurant_tables WHERE id=p_table),normalized,coalesce(p_note,''),grand_total,items_count,'unpaid','pending',p_hash,p_request,fingerprint) RETURNING * INTO saved;
 RETURN jsonb_build_object('id',saved.id,'total',saved.total,'status',saved.status);
END $$;

CREATE OR REPLACE FUNCTION sarayamenu.hos_guest_decide(p_actor uuid,p_venue text,p_order text,p_accept boolean,p_minutes int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE role_name text; order_row sarayamenu.orders; tab sarayamenu.table_tabs; item jsonb;
BEGIN
 role_name=sarayamenu.hos_role(p_actor,p_venue);
 IF role_name IS NULL OR role_name NOT IN ('admin','owner','bar') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';END IF;
 SELECT * INTO order_row FROM sarayamenu.orders WHERE id=p_order AND restaurant_id=p_venue FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order unavailable';END IF;
 IF p_accept AND order_row.linked_tab_id IS NOT NULL THEN RETURN jsonb_build_object('tabId',order_row.linked_tab_id);END IF;
 IF order_row.status='cancelled' AND NOT p_accept THEN RETURN jsonb_build_object('ok',true);END IF;
 IF order_row.status<>'pending' THEN RAISE EXCEPTION 'Already decided' USING ERRCODE='23505';END IF;
 PERFORM set_config('hos.actor_id',p_actor::text,true);PERFORM set_config('hos.action',CASE WHEN p_accept THEN 'guest.accept' ELSE 'guest.reject' END,true);
 IF NOT p_accept THEN UPDATE sarayamenu.orders SET status='cancelled',updated_at=now() WHERE id=p_order;RETURN jsonb_build_object('ok',true);END IF;
 IF order_row.guest_token_hash IS NULL OR order_row.table_id IS NULL OR p_minutes IS NULL OR p_minutes NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Order cannot be accepted';END IF;
 PERFORM 1 FROM sarayamenu.restaurant_tables WHERE id=order_row.table_id AND restaurant_id=p_venue AND is_active FOR UPDATE;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM sarayamenu.table_tabs WHERE table_id=order_row.table_id AND closed_at>order_row.created_at) THEN RAISE EXCEPTION 'Seating changed' USING ERRCODE='23505';END IF;
 SELECT * INTO tab FROM sarayamenu.table_tabs WHERE table_id=order_row.table_id AND status='open' FOR UPDATE;
 IF NOT FOUND THEN INSERT INTO sarayamenu.table_tabs(restaurant_id,table_id,waiter_id,origin) VALUES(p_venue,order_row.table_id,NULL,'guest') RETURNING * INTO tab;END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(order_row.items) LOOP
  INSERT INTO sarayamenu.tab_items(tab_id,product_id,product_name,quantity,unit_price,total_price,station,fire_status,fired_at,source_order_id,options)
  VALUES(tab.id,item->>'id',item->>'name',(item->>'quantity')::int,(item->>'price')::numeric,(item->>'price')::numeric*(item->>'quantity')::int,CASE WHEN (SELECT kitchen_enabled FROM sarayamenu.restaurants WHERE id=p_venue) THEN item->>'station' ELSE 'bar' END,'fired',now(),order_row.id,jsonb_build_object('variations',item->'selectedVariations','addons',item->'selectedAddons','note',order_row.kitchen_note));
 END LOOP;
 UPDATE sarayamenu.table_tabs SET origin='guest',total=(SELECT sum(total_price) FROM sarayamenu.tab_items WHERE tab_id=tab.id) WHERE id=tab.id;
 UPDATE sarayamenu.orders SET status='preparing',accepted_at=now(),accepted_by=p_actor,estimated_minutes=p_minutes,linked_tab_id=tab.id,updated_at=now() WHERE id=p_order;
 RETURN jsonb_build_object('tabId',tab.id);
END $$;
REVOKE ALL ON FUNCTION sarayamenu.hos_guest_submit(text,text,text,jsonb,text,uuid),sarayamenu.hos_guest_decide(uuid,text,text,boolean,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION sarayamenu.hos_guest_submit(text,text,text,jsonb,text,uuid),sarayamenu.hos_guest_decide(uuid,text,text,boolean,integer) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
