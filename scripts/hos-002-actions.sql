-- Server-only transactional actions. Identity comes from the app's custom session.
BEGIN;
CREATE OR REPLACE FUNCTION sarayamenu.hos_action(p_actor_id uuid,p_action text,p_venue text,p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 role_name text; tab sarayamenu.table_tabs; product sarayamenu.products;
 line sarayamenu.tab_items; stock sarayamenu.inventory; venue sarayamenu.restaurants;
 result jsonb; row_data jsonb; previous jsonb; receipt sarayamenu.operation_receipts;
 target_id uuid; line_id uuid; qty integer; price numeric; count_value integer;
 v_request_key text; fingerprint text; dest text; fire text; rec record;
 target_user sarayamenu.users; segment jsonb; normalized jsonb; group_rows jsonb;
BEGIN
 p_data=coalesce(p_data,'{}');
 -- Distributed rate limiting is shared across processes; no credential values stored.
 IF p_action='auth.attempt' THEN
  INSERT INTO sarayamenu.login_limits(key_hash,attempts) VALUES(p_data->>'key',1)
  ON CONFLICT(key_hash) DO UPDATE SET
   attempts=CASE WHEN login_limits.window_start<now()-interval '15 minutes' THEN 1 ELSE login_limits.attempts+1 END,
   window_start=CASE WHEN login_limits.window_start<now()-interval '15 minutes' THEN now() ELSE login_limits.window_start END
  RETURNING attempts INTO count_value;
  RETURN jsonb_build_object('allowed',count_value<=5);
 ELSIF p_action='auth.session' THEN
  SELECT * INTO target_user FROM sarayamenu.users WHERE id=(p_data->>'userId')::uuid FOR UPDATE;
  IF NOT FOUND OR target_user.credential_version<>(p_data->>'version')::int THEN RAISE EXCEPTION 'Credentials changed' USING ERRCODE='28000'; END IF;
  IF target_user.onboarding_required AND (target_user.temporary_pin_expires_at IS NULL OR target_user.temporary_pin_expires_at<=now()) THEN RAISE EXCEPTION 'Temporary PIN expired' USING ERRCODE='28000'; END IF;
  INSERT INTO sarayamenu.sessions(user_id,token_hash,expires_at,purpose,credential_version)
  VALUES(target_user.id,p_data->>'tokenHash',now()+CASE WHEN target_user.onboarding_required THEN interval '10 minutes' ELSE interval '7 days' END,CASE WHEN target_user.onboarding_required THEN 'onboarding' ELSE 'full' END,target_user.credential_version);
  DELETE FROM sarayamenu.login_limits WHERE key_hash=encode(sha256(('login:'||target_user.email)::bytea),'hex');
  INSERT INTO sarayamenu.audit_events(actor_id,actor_role,action,entity_type,entity_id) VALUES(target_user.id,target_user.platform_role,'auth.login','users',target_user.id::text);
  RETURN jsonb_build_object('onboarding',target_user.onboarding_required);
 ELSIF p_action='auth.onboard' THEN
  SELECT u.* INTO target_user FROM sarayamenu.users u JOIN sarayamenu.sessions s ON s.user_id=u.id
  WHERE s.token_hash=p_data->>'tokenHash' AND s.expires_at>now() AND s.purpose='onboarding' AND s.credential_version=u.credential_version AND u.onboarding_required FOR UPDATE OF u;
  IF NOT FOUND THEN RAISE EXCEPTION 'Onboarding expired' USING ERRCODE='28000'; END IF;
  PERFORM set_config('hos.actor_id',target_user.id::text,true); PERFORM set_config('hos.action',p_action,true);
  UPDATE sarayamenu.users SET pin_hash=p_data->>'pinHash',password_hash=NULL,onboarding_required=false,temporary_pin_expires_at=NULL,credential_version=credential_version+1 WHERE id=target_user.id;
  DELETE FROM sarayamenu.sessions WHERE user_id=target_user.id;
  INSERT INTO sarayamenu.sessions(user_id,token_hash,expires_at,purpose,credential_version) VALUES(target_user.id,p_data->>'newTokenHash',now()+interval '7 days','full',target_user.credential_version+1);
  RETURN jsonb_build_object('userId',target_user.id);
 END IF;

 role_name=sarayamenu.hos_role(p_actor_id,p_venue);
 IF role_name IS NULL THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO venue FROM sarayamenu.restaurants WHERE id=p_venue;
 PERFORM set_config('hos.actor_id',p_actor_id::text,true);
 PERFORM set_config('hos.action',p_action,true);
 PERFORM set_config('hos.request_id',coalesce(p_data->>'requestKey',''),true);

 v_request_key=nullif(p_data->>'requestKey','');
 fingerprint=encode(sha256((p_action||p_data::text)::bytea),'hex');
 IF v_request_key IS NOT NULL THEN
  -- Same idempotency key is serialized even before a receipt exists.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_actor_id::text||p_venue||v_request_key,0));
  SELECT * INTO receipt FROM sarayamenu.operation_receipts WHERE actor_id=p_actor_id AND restaurant_id=p_venue AND operation_receipts.request_key=v_request_key;
  IF FOUND THEN
   IF receipt.action<>p_action OR receipt.fingerprint<>fingerprint THEN RAISE EXCEPTION 'Conflicting retry' USING ERRCODE='23505'; END IF;
   RETURN receipt.result;
  END IF;
 END IF;

 IF p_action LIKE 'table.%' THEN
  IF role_name NOT IN ('admin','owner','manager') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('tables:'||p_venue,0));
  target_id=coalesce((p_data->>'id')::uuid,gen_random_uuid());
  IF p_action<>'table.create' THEN
   PERFORM 1 FROM sarayamenu.restaurant_tables WHERE id=target_id AND restaurant_id=p_venue FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';END IF;
  END IF;
  IF p_action='table.retire' THEN
   IF EXISTS(SELECT 1 FROM sarayamenu.table_tabs WHERE table_id=target_id AND status='open') OR EXISTS(SELECT 1 FROM sarayamenu.orders WHERE table_id=target_id AND status='pending') THEN RAISE EXCEPTION 'Table still in service' USING ERRCODE='23505';END IF;
   UPDATE sarayamenu.restaurant_tables SET is_active=false WHERE id=target_id RETURNING to_jsonb(restaurant_tables.*) INTO result;
  ELSIF p_action IN ('table.create','table.update') THEN
   IF nullif(trim(p_data->>'label'),'') IS NULL OR (p_data->>'capacity')::int NOT BETWEEN 1 AND 100 OR (p_data->>'capacity') IS NULL THEN RAISE EXCEPTION 'Invalid table';END IF;
   IF EXISTS(SELECT 1 FROM sarayamenu.restaurant_tables WHERE restaurant_id=p_venue AND is_active AND lower(trim(label))=lower(trim(p_data->>'label')) AND id<>target_id) THEN RAISE EXCEPTION 'Table label exists' USING ERRCODE='23505';END IF;
   IF p_action='table.create' THEN
    INSERT INTO sarayamenu.restaurant_tables(id,restaurant_id,label,capacity,position,is_active) VALUES(target_id,p_venue,trim(p_data->>'label'),(p_data->>'capacity')::int,coalesce((p_data->>'position')::int,0),true) RETURNING to_jsonb(restaurant_tables.*) INTO result;
   ELSE UPDATE sarayamenu.restaurant_tables SET label=trim(p_data->>'label'),capacity=(p_data->>'capacity')::int,position=coalesce((p_data->>'position')::int,position) WHERE id=target_id RETURNING to_jsonb(restaurant_tables.*) INTO result;END IF;
  ELSE RAISE EXCEPTION 'Unknown table action';END IF;
 ELSIF p_action LIKE 'happyhour.%' THEN
  IF role_name NOT IN ('admin','owner','manager') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('happyhour:'||p_venue,0));
  target_id=coalesce((p_data->>'id')::uuid,gen_random_uuid());
  IF EXISTS(SELECT 1 FROM sarayamenu.happy_hour_schedules WHERE id=target_id AND restaurant_id<>p_venue) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';END IF;
  IF p_action='happyhour.delete' THEN
   DELETE FROM sarayamenu.happy_hour_schedules WHERE id=target_id AND restaurant_id=p_venue;result=jsonb_build_object('ok',true);
  ELSIF p_action='happyhour.save' THEN
   IF p_data->>'startTime' IS NULL OR p_data->>'endTime' IS NULL OR (p_data->>'startTime')::time=(p_data->>'endTime')::time OR jsonb_typeof(p_data->'active') IS DISTINCT FROM 'boolean' OR jsonb_typeof(p_data->'products') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Invalid happy hour';END IF;
   FOR row_data IN SELECT value FROM jsonb_array_elements(p_data->'products') LOOP
    price=(row_data->>'overridePrice')::numeric;
    IF price IS NULL OR price<=0 OR price::text IN ('NaN','Infinity','-Infinity') OR NOT EXISTS(SELECT 1 FROM sarayamenu.products WHERE id=row_data->>'productId' AND restaurant_id=p_venue) THEN RAISE EXCEPTION 'Invalid happy hour product';END IF;
   END LOOP;
   INSERT INTO sarayamenu.happy_hour_schedules(id,restaurant_id,label,start_time,end_time,active) VALUES(target_id,p_venue,left(p_data->>'label',200),(p_data->>'startTime')::time,(p_data->>'endTime')::time,(p_data->>'active')::boolean)
   ON CONFLICT(id) DO UPDATE SET label=excluded.label,start_time=excluded.start_time,end_time=excluded.end_time,active=excluded.active,updated_at=now();
   DELETE FROM sarayamenu.happy_hour_products WHERE schedule_id=target_id;
   INSERT INTO sarayamenu.happy_hour_products(schedule_id,product_id,override_price) SELECT target_id,value->>'productId',(value->>'overridePrice')::numeric FROM jsonb_array_elements(p_data->'products');
   SELECT to_jsonb(h)||jsonb_build_object('products',coalesce((SELECT jsonb_agg(to_jsonb(hp)) FROM sarayamenu.happy_hour_products hp WHERE schedule_id=target_id),'[]')) INTO result FROM sarayamenu.happy_hour_schedules h WHERE id=target_id;
  ELSE RAISE EXCEPTION 'Unknown happy hour action';END IF;
 ELSIF p_action='venue.delete' THEN
  IF role_name<>'admin' THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';END IF;
  PERFORM 1 FROM sarayamenu.restaurants WHERE id=p_venue FOR UPDATE;
  IF EXISTS(SELECT 1 FROM sarayamenu.table_tabs WHERE restaurant_id=p_venue) OR EXISTS(SELECT 1 FROM sarayamenu.orders WHERE restaurant_id=p_venue) OR EXISTS(SELECT 1 FROM sarayamenu.inventory_movements WHERE restaurant_id=p_venue) THEN RAISE EXCEPTION 'Venue has operational history' USING ERRCODE='23505';END IF;
  DELETE FROM sarayamenu.restaurants WHERE id=p_venue;result=jsonb_build_object('ok',true);
 ELSIF p_action='media.upload' THEN
  IF role_name NOT IN ('admin','owner','manager') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';END IF;
  INSERT INTO sarayamenu.audit_events(restaurant_id,actor_id,actor_role,action,entity_type,entity_id,changes) VALUES(p_venue,p_actor_id,role_name,'media.upload','storage',p_data->>'path',jsonb_build_object('bytes',p_data->'bytes','placement',p_data->'placement'));
  result=jsonb_build_object('ok',true);
 ELSIF p_action='venue.configure' THEN
  IF role_name<>'admin' THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=p_data->>'timezone') OR coalesce(p_data->>'language','') NOT IN ('bs','en') OR jsonb_typeof(p_data->'kitchenEnabled') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Invalid locale'; END IF;
  UPDATE sarayamenu.restaurants SET revision=revision+1,timezone=p_data->>'timezone',language=p_data->>'language',kitchen_enabled=(p_data->>'kitchenEnabled')::boolean WHERE id=p_venue RETURNING to_jsonb(restaurants.*) INTO result;
 ELSIF p_action='staff.create' THEN
  IF role_name NOT IN ('admin','owner','manager') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  dest=p_data->>'role';
  IF dest IS NULL OR dest NOT IN ('employee','bar','kitchen','manager','owner') OR (role_name='manager' AND dest NOT IN ('employee','bar','kitchen')) OR (role_name='owner' AND dest='owner') OR (dest='kitchen' AND NOT venue.kitchen_enabled) THEN RAISE EXCEPTION 'Role not allowed' USING ERRCODE='42501'; END IF;
  IF nullif(trim(p_data->>'firstName'),'') IS NULL OR nullif(trim(p_data->>'lastName'),'') IS NULL OR nullif(trim(p_data->>'phone'),'') IS NULL OR coalesce(p_data->>'email','') NOT LIKE '%@%' THEN RAISE EXCEPTION 'Missing staff details'; END IF;
  IF EXISTS(SELECT 1 FROM sarayamenu.users WHERE lower(email)=lower(trim(p_data->>'email'))) THEN RAISE EXCEPTION 'Account already exists; add access without resetting credentials' USING ERRCODE='23505'; END IF;
  INSERT INTO sarayamenu.users(name,first_name,last_name,email,phone,pin_hash,onboarding_required,temporary_pin_expires_at,platform_role)
  VALUES(trim(p_data->>'firstName')||' '||trim(p_data->>'lastName'),trim(p_data->>'firstName'),trim(p_data->>'lastName'),lower(trim(p_data->>'email')),trim(p_data->>'phone'),p_data->>'pinHash',true,now()+interval '7 days',CASE WHEN role_name='admin' AND p_data->>'platformRole'='admin' THEN 'admin' ELSE 'user' END) RETURNING id INTO target_id;
  IF p_venue<>'' THEN INSERT INTO sarayamenu.restaurant_access(user_id,restaurant_id,role) VALUES(target_id,p_venue,dest); END IF;
  result=jsonb_build_object('id',target_id);
 ELSIF p_action='staff.role' THEN
  IF role_name NOT IN ('admin','owner','manager') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  target_id=(p_data->>'userId')::uuid; dest=p_data->>'role';
  SELECT * INTO target_user FROM sarayamenu.users WHERE id=target_id;
  IF NOT FOUND OR (target_user.platform_role='admin' AND role_name<>'admin') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF dest IS NULL OR dest NOT IN ('employee','bar','kitchen','manager','owner') OR (dest='kitchen' AND NOT venue.kitchen_enabled) THEN RAISE EXCEPTION 'Role not allowed'; END IF;
  IF role_name='manager' AND (dest NOT IN ('employee','bar','kitchen') OR EXISTS(SELECT 1 FROM sarayamenu.restaurant_access WHERE user_id=target_id AND restaurant_id=p_venue AND role IN ('owner','manager'))) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF role_name='owner' AND (dest='owner' OR EXISTS(SELECT 1 FROM sarayamenu.restaurant_access WHERE user_id=target_id AND restaurant_id=p_venue AND role='owner')) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  INSERT INTO sarayamenu.restaurant_access(user_id,restaurant_id,role) VALUES(target_id,p_venue,dest) ON CONFLICT(user_id,restaurant_id) DO UPDATE SET role=excluded.role;
  result=jsonb_build_object('ok',true);
 ELSIF p_action='staff.remove' THEN
  target_id=(p_data->>'userId')::uuid;
  SELECT role INTO dest FROM sarayamenu.restaurant_access WHERE user_id=target_id AND restaurant_id=p_venue;
  IF role_name NOT IN ('admin','owner','manager') OR (role_name='manager' AND dest NOT IN ('employee','bar','kitchen')) OR (role_name='owner' AND dest='owner') OR target_id=p_actor_id THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  DELETE FROM sarayamenu.restaurant_access WHERE user_id=target_id AND restaurant_id=p_venue;
  result=jsonb_build_object('ok',true);
 ELSIF p_action='staff.platform-role' THEN
  IF role_name<>'admin' OR (p_data->>'role') NOT IN ('user','admin') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  target_id=(p_data->>'userId')::uuid;
  IF target_id=p_actor_id AND p_data->>'role'<>'admin' THEN RAISE EXCEPTION 'Cannot remove your own platform access'; END IF;
  UPDATE sarayamenu.users SET platform_role=p_data->>'role' WHERE id=target_id;
  result=jsonb_build_object('ok',true);
 ELSIF p_action='staff.temporary-pin' THEN
  target_id=(p_data->>'userId')::uuid;
  IF role_name NOT IN ('admin','owner','manager') OR (role_name<>'admin' AND NOT EXISTS(SELECT 1 FROM sarayamenu.restaurant_access WHERE user_id=target_id AND restaurant_id=p_venue AND (role IN ('employee','bar','kitchen') OR (role_name='owner' AND role='manager')))) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  UPDATE sarayamenu.users SET pin_hash=p_data->>'pinHash',onboarding_required=true,temporary_pin_expires_at=now()+interval '7 days',credential_version=credential_version+1 WHERE id=target_id AND (platform_role<>'admin' OR role_name='admin');
  DELETE FROM sarayamenu.sessions WHERE user_id=target_id;
  result=jsonb_build_object('ok',true);
 ELSIF p_action='tab.open' THEN
  IF role_name NOT IN ('admin','owner','manager','employee') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  target_id=(p_data->>'tableId')::uuid;
  PERFORM 1 FROM sarayamenu.restaurant_tables WHERE id=target_id AND restaurant_id=p_venue AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Table not available'; END IF;
  IF EXISTS(SELECT 1 FROM sarayamenu.table_tabs WHERE table_id=target_id AND status='open') THEN RAISE EXCEPTION 'Table already occupied' USING ERRCODE='23505'; END IF;
  INSERT INTO sarayamenu.table_tabs(restaurant_id,table_id,waiter_id) VALUES(p_venue,target_id,p_actor_id) RETURNING to_jsonb(table_tabs.*) INTO result;
 ELSIF p_action LIKE 'tab.%' THEN
  SELECT * INTO tab FROM sarayamenu.table_tabs WHERE id=(p_data->>'tabId')::uuid AND restaurant_id=p_venue FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tab not found' USING ERRCODE='P0002'; END IF;
  IF role_name NOT IN ('admin','owner','manager','employee') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF tab.waiter_id IS NULL AND p_action='tab.claim' AND tab.status='open' THEN
   UPDATE sarayamenu.table_tabs SET waiter_id=p_actor_id WHERE id=tab.id;
   result=jsonb_build_object('ok',true);
  ELSE
   IF tab.waiter_id IS NULL THEN RAISE EXCEPTION 'Claim responsibility first' USING ERRCODE='42501';END IF;
   IF tab.waiter_id IS DISTINCT FROM p_actor_id THEN
    IF role_name NOT IN ('admin','owner','manager') OR coalesce((p_data->>'intervention')::boolean,false)=false THEN RAISE EXCEPTION 'Intervention acknowledgement required' USING ERRCODE='42501'; END IF;
   END IF;
   IF tab.status<>'open' THEN
    IF p_action='tab.close' AND tab.payment_method=p_data->>'paymentMethod' THEN RETURN to_jsonb(tab); END IF;
    RAISE EXCEPTION 'Tab already settled' USING ERRCODE='23505';
   END IF;
   IF p_action='tab.enter' THEN
    INSERT INTO sarayamenu.audit_events(restaurant_id,actor_id,actor_role,action,entity_type,entity_id,responsible_waiter_id,changes)
    VALUES(p_venue,p_actor_id,role_name,'tab.enter','table_tabs',tab.id::text,tab.waiter_id,jsonb_build_object('intervention',tab.waiter_id IS DISTINCT FROM p_actor_id));
    result=to_jsonb(tab);
   ELSIF p_action='tab.add' THEN
    SELECT * INTO product FROM sarayamenu.products WHERE id=p_data->>'productId' AND restaurant_id=p_venue;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
    qty=(p_data->>'quantity')::int;
    IF qty IS NULL OR qty<1 OR qty>100 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    fire=coalesce(p_data->>'fireStatus','fired'); IF fire NOT IN ('fired','backlog') THEN RAISE EXCEPTION 'Invalid preparation state'; END IF;
    price=product.price;
    SELECT hp.override_price INTO price FROM sarayamenu.happy_hour_products hp JOIN sarayamenu.happy_hour_schedules h ON h.id=hp.schedule_id
    WHERE hp.product_id=product.id AND h.restaurant_id=p_venue AND h.active AND CASE WHEN h.start_time<h.end_time THEN (now() AT TIME ZONE venue.timezone)::time>=h.start_time AND (now() AT TIME ZONE venue.timezone)::time<h.end_time ELSE (now() AT TIME ZONE venue.timezone)::time>=h.start_time OR (now() AT TIME ZONE venue.timezone)::time<h.end_time END ORDER BY h.start_time DESC,h.id DESC LIMIT 1;
    price=coalesce(price,product.price); dest=CASE WHEN venue.kitchen_enabled THEN product.station ELSE 'bar' END;
    -- Every round is a separate price snapshot. Preparation acknowledgements never hide later rounds.
    INSERT INTO sarayamenu.tab_items(tab_id,product_id,product_name,quantity,unit_price,total_price,station,fire_status,fired_at)
    VALUES(tab.id,product.id,product.name,qty,price,price*qty,dest,fire,CASE WHEN fire='fired' THEN now() END) RETURNING to_jsonb(tab_items.*) INTO result;
    UPDATE sarayamenu.table_tabs SET total=(SELECT coalesce(sum(total_price),0) FROM sarayamenu.tab_items WHERE tab_id=tab.id) WHERE id=tab.id;
   ELSIF p_action='tab.remove' THEN
    DELETE FROM sarayamenu.tab_items WHERE id=(p_data->>'itemId')::uuid AND tab_id=tab.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;
    UPDATE sarayamenu.table_tabs SET total=(SELECT coalesce(sum(total_price),0) FROM sarayamenu.tab_items WHERE tab_id=tab.id) WHERE id=tab.id;
    result=jsonb_build_object('ok',true);
   ELSIF p_action='tab.fire' THEN
    IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(p_data->'itemIds') i WHERE NOT EXISTS(SELECT 1 FROM sarayamenu.tab_items x WHERE x.id=i::uuid AND x.tab_id=tab.id)) THEN RAISE EXCEPTION 'Foreign item'; END IF;
    UPDATE sarayamenu.tab_items SET fire_status='fired',fired_at=now() WHERE tab_id=tab.id AND fire_status='backlog' AND id IN (SELECT value::uuid FROM jsonb_array_elements_text(p_data->'itemIds'));
    result=jsonb_build_object('ok',true);
   ELSIF p_action='tab.discard' THEN
    IF EXISTS(SELECT 1 FROM sarayamenu.tab_items WHERE tab_id=tab.id) THEN RAISE EXCEPTION 'Tab is not empty'; END IF;
    DELETE FROM sarayamenu.table_tabs WHERE id=tab.id; result=jsonb_build_object('ok',true);
   ELSIF p_action='tab.close' THEN
    IF p_data->>'paymentMethod' IS NULL OR (p_data->>'paymentMethod') NOT IN ('cash','card') THEN RAISE EXCEPTION 'Invalid method'; END IF;
    -- Deterministic stock order prevents deadlocks when two bills contain the same products.
    FOR rec IN SELECT product_id,max(product_name) AS name,sum(quantity) AS quantity FROM sarayamenu.tab_items WHERE tab_id=tab.id GROUP BY product_id ORDER BY product_id LOOP
     SELECT * INTO stock FROM sarayamenu.inventory WHERE restaurant_id=p_venue AND product_id=rec.product_id FOR UPDATE;
     IF FOUND AND stock.tracked THEN
      UPDATE sarayamenu.inventory SET quantity=quantity-rec.quantity,updated_at=now() WHERE id=stock.id;
      INSERT INTO sarayamenu.inventory_movements(restaurant_id,product_id,product_name,quantity_delta,reason,tab_id,waiter_id)
      VALUES(p_venue,rec.product_id,rec.name,-rec.quantity,'order',tab.id,tab.waiter_id);
     END IF;
    END LOOP;
    UPDATE sarayamenu.table_tabs SET status='closed',payment_method=p_data->>'paymentMethod',closed_at=now(),settled_by=p_actor_id,settlement_key=v_request_key,total=(SELECT coalesce(sum(total_price),0) FROM sarayamenu.tab_items WHERE tab_id=tab.id) WHERE id=tab.id RETURNING to_jsonb(table_tabs.*) INTO result;
   ELSE RAISE EXCEPTION 'Unknown tab action'; END IF;
  END IF;
 ELSIF p_action='inventory.initialize' THEN
  IF role_name NOT IN ('admin','owner','manager') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO product FROM sarayamenu.products WHERE id=p_data->>'productId' AND restaurant_id=p_venue;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
  price=coalesce((p_data->>'quantity')::numeric,0);
  IF price<0 OR price::text IN ('NaN','Infinity','-Infinity') OR length(coalesce(p_data->>'unit','kom')) NOT BETWEEN 1 AND 30 THEN RAISE EXCEPTION 'Invalid initial stock';END IF;
  INSERT INTO sarayamenu.inventory(restaurant_id,product_id,product_name,quantity,unit,tracked) VALUES(p_venue,product.id,product.name,price,coalesce(p_data->>'unit','kom'),coalesce((p_data->>'tracked')::boolean,true)) RETURNING to_jsonb(inventory.*) INTO result;
  IF price<>0 THEN INSERT INTO sarayamenu.inventory_movements(restaurant_id,product_id,product_name,quantity_delta,reason,waiter_id) VALUES(p_venue,product.id,product.name,price,'init',p_actor_id);END IF;
 ELSIF p_action='inventory.tracked' THEN
  IF role_name NOT IN ('admin','owner','manager') OR jsonb_typeof(p_data->'tracked') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO product FROM sarayamenu.products WHERE id=p_data->>'productId' AND restaurant_id=p_venue;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
  INSERT INTO sarayamenu.inventory(restaurant_id,product_id,product_name,quantity,unit,tracked) VALUES(p_venue,product.id,product.name,0,'kom',(p_data->>'tracked')::boolean)
  ON CONFLICT(restaurant_id,product_id) DO UPDATE SET tracked=excluded.tracked,updated_at=now() RETURNING to_jsonb(inventory.*) INTO result;
 ELSIF p_action='inventory.adjust' THEN
  IF role_name NOT IN ('admin','owner','manager') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO product FROM sarayamenu.products WHERE id=p_data->>'productId' AND restaurant_id=p_venue;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
  price=(p_data->>'delta')::numeric;
  IF price IS NULL OR price=0 OR price::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid adjustment'; END IF;
  INSERT INTO sarayamenu.inventory(restaurant_id,product_id,product_name,quantity,unit,tracked) VALUES(p_venue,product.id,product.name,0,'kom',coalesce((p_data->>'tracked')::boolean,true)) ON CONFLICT(restaurant_id,product_id) DO NOTHING;
  UPDATE sarayamenu.inventory SET quantity=quantity+price,updated_at=now() WHERE restaurant_id=p_venue AND product_id=product.id RETURNING to_jsonb(inventory.*) INTO result;
  INSERT INTO sarayamenu.inventory_movements(restaurant_id,product_id,product_name,quantity_delta,reason,waiter_id) VALUES(p_venue,product.id,product.name,price,'manual',p_actor_id);
 ELSIF p_action='station.done' THEN
  dest=p_data->>'station';
  IF dest IS NULL OR (dest='bar' AND role_name NOT IN ('admin','owner','bar')) OR (dest='kitchen' AND (role_name NOT IN ('admin','kitchen') OR NOT venue.kitchen_enabled)) OR dest NOT IN ('bar','kitchen') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO tab FROM sarayamenu.table_tabs WHERE id=(p_data->>'tabId')::uuid AND restaurant_id=p_venue FOR UPDATE;
  IF NOT FOUND OR tab.status<>'open' THEN RAISE EXCEPTION 'Tab not found'; END IF;
  -- Acknowledge only the lines and quantities actually displayed, never unseen new work.
  FOR row_data IN SELECT value FROM jsonb_array_elements(p_data->'lines') LOOP
   SELECT * INTO line FROM sarayamenu.tab_items WHERE id=(row_data->>'id')::uuid AND tab_id=tab.id FOR UPDATE;
   IF NOT FOUND OR line.fire_status<>'fired' OR (dest='kitchen' AND line.station NOT IN ('kitchen','both')) THEN RAISE EXCEPTION 'Invalid preparation line'; END IF;
   qty=least(line.quantity,greatest(0,(row_data->>'quantity')::int));
   IF dest='bar' THEN UPDATE sarayamenu.tab_items SET bar_done_quantity=greatest(bar_done_quantity,qty) WHERE id=line.id;
   ELSE UPDATE sarayamenu.tab_items SET kitchen_done_quantity=greatest(kitchen_done_quantity,qty) WHERE id=line.id; END IF;
  END LOOP;
  UPDATE sarayamenu.orders o SET status='ready',updated_at=now() WHERE linked_tab_id=tab.id AND status='preparing'
   AND NOT EXISTS(SELECT 1 FROM sarayamenu.tab_items i WHERE i.source_order_id=o.id AND (i.bar_done_quantity<i.quantity OR (i.station IN ('kitchen','both') AND i.kitchen_done_quantity<i.quantity)));
  result=jsonb_build_object('ok',true);
 ELSE RAISE EXCEPTION 'Unknown action'; END IF;

 IF v_request_key IS NOT NULL THEN INSERT INTO sarayamenu.operation_receipts(actor_id,restaurant_id,request_key,action,fingerprint,result) VALUES(p_actor_id,p_venue,v_request_key,p_action,fingerprint,coalesce(result,'{}')); END IF;
 RETURN coalesce(result,'{}');
END $$;
REVOKE ALL ON FUNCTION sarayamenu.hos_action(uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION sarayamenu.hos_action(uuid,text,text,jsonb) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
