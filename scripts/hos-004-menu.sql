BEGIN;
CREATE OR REPLACE FUNCTION sarayamenu.hos_menu_save(p_actor uuid,p_venue text,p_revision bigint,p_patch jsonb,p_request_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r sarayamenu.restaurants; role_name text; part jsonb; v jsonb; o jsonb; c sarayamenu.categories;
 v_product_id text; previous_receipt sarayamenu.operation_receipts; fingerprint text; result jsonb; section text; initial_quantity numeric; inserted_stock uuid;
BEGIN
 role_name=sarayamenu.hos_role(p_actor,p_venue);
 IF role_name IS NULL OR role_name NOT IN ('admin','owner','manager') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF nullif(p_request_key,'') IS NULL THEN RAISE EXCEPTION 'Request key required'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('menu:'||p_venue,0));
 fingerprint=encode(sha256(p_patch::text::bytea),'hex');
 SELECT * INTO previous_receipt FROM sarayamenu.operation_receipts WHERE actor_id=p_actor AND restaurant_id=p_venue AND request_key=p_request_key;
 IF FOUND THEN
  IF previous_receipt.action<>'menu.save' OR previous_receipt.fingerprint<>fingerprint THEN RAISE EXCEPTION 'Conflicting retry' USING ERRCODE='23505'; END IF;
  RETURN previous_receipt.result;
 END IF;
 PERFORM set_config('hos.actor_id',p_actor::text,true); PERFORM set_config('hos.action','menu.save',true); PERFORM set_config('hos.request_id',p_request_key,true);
 SELECT * INTO r FROM sarayamenu.restaurants WHERE id=p_venue FOR UPDATE;
 IF NOT FOUND THEN
  IF role_name<>'admin' OR p_revision IS NOT NULL OR nullif(p_patch->'restaurant'->>'name','') IS NULL THEN RAISE EXCEPTION 'Venue unavailable' USING ERRCODE='42501'; END IF;
  INSERT INTO sarayamenu.restaurants(id,name) VALUES(p_venue,p_patch->'restaurant'->>'name') RETURNING * INTO r;
 ELSIF p_revision IS NULL OR r.revision<>p_revision THEN RAISE EXCEPTION 'Menu changed since it was loaded' USING ERRCODE='40001'; END IF;

 IF p_patch ? 'platformConfig' THEN
  part=p_patch->'platformConfig';
  IF role_name<>'admin' THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';END IF;
  IF coalesce(part->>'language','') NOT IN ('bs','en') OR NOT EXISTS(SELECT 1 FROM pg_timezone_names WHERE name=part->>'timezone') OR jsonb_typeof(part->'kitchenEnabled') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Invalid venue settings';END IF;
  UPDATE sarayamenu.restaurants SET language=part->>'language',timezone=part->>'timezone',kitchen_enabled=(part->>'kitchenEnabled')::boolean WHERE id=p_venue RETURNING * INTO r;
 END IF;
 IF p_patch ? 'restaurant' THEN
  part=p_patch->'restaurant';
  -- Platform-only settings have their own checked action and cannot be smuggled through CMS.
  UPDATE sarayamenu.restaurants SET name=part->>'name',name_bs=part->>'name_bs',tagline=coalesce(part->>'tagline',''),tagline_bs=part->>'tagline_bs',image=coalesce(part->>'image',''),logo=coalesce(part->>'logo',''),address=coalesce(part->>'address',''),address_bs=part->>'address_bs',open_hours=coalesce(part->>'open_hours',''),open_hours_bs=part->>'open_hours_bs',wifi=coalesce(part->>'wifi',''),phone=coalesce(part->>'phone',''),venue_type=coalesce(part->>'venue_type','restaurant') WHERE id=p_venue;
 END IF;
 FOR part IN SELECT value FROM jsonb_array_elements(coalesce(p_patch->'categoriesUpsert','[]')) LOOP
  IF nullif(part->>'id','') IS NULL OR nullif(trim(part->>'label'),'') IS NULL THEN RAISE EXCEPTION 'Category details required'; END IF;
  INSERT INTO sarayamenu.categories(id,restaurant_id,label,label_bs,icon,color,sort_order) VALUES(part->>'id',p_venue,part->>'label',part->>'label_bs',coalesce(part->>'icon',''),coalesce(part->>'color',''),coalesce((part->>'sort_order')::int,0))
  ON CONFLICT(restaurant_id,id) DO UPDATE SET label=excluded.label,label_bs=excluded.label_bs,icon=excluded.icon,color=excluded.color,sort_order=excluded.sort_order;
  -- Legacy label remains a compatibility display value; category_id carries identity.
  UPDATE sarayamenu.products SET category=part->>'label' WHERE restaurant_id=p_venue AND category_id=part->>'id' AND category IS DISTINCT FROM part->>'label';
 END LOOP;
 FOR part IN SELECT value FROM jsonb_array_elements(coalesce(p_patch->'productsUpsert','[]')) LOOP
  v_product_id=part->>'id';
  IF nullif(v_product_id,'') IS NULL OR nullif(trim(part->>'name'),'') IS NULL OR (part->>'price') IS NULL OR (part->>'price')::numeric<0 OR (part->>'price')::numeric::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid product'; END IF;
  IF EXISTS(SELECT 1 FROM sarayamenu.products p WHERE p.id=v_product_id AND p.restaurant_id<>p_venue) THEN RAISE EXCEPTION 'Foreign product' USING ERRCODE='42501'; END IF;
  SELECT * INTO c FROM sarayamenu.categories WHERE restaurant_id=p_venue AND id=coalesce(part->>'categoryId',part->>'category') LIMIT 1;
  IF NOT FOUND THEN
   IF (SELECT count(*) FROM sarayamenu.categories WHERE restaurant_id=p_venue AND label=part->>'category')<>1 THEN RAISE EXCEPTION 'Choose a category'; END IF;
   SELECT * INTO c FROM sarayamenu.categories WHERE restaurant_id=p_venue AND label=part->>'category';
  END IF;
  IF r.kitchen_enabled AND coalesce(part->>'station','') NOT IN ('bar','kitchen','both') THEN RAISE EXCEPTION 'Choose preparation station'; END IF;
  INSERT INTO sarayamenu.products(id,restaurant_id,name,name_bs,description,description_bs,price,image,category,category_id,station,popular,sort_order)
  VALUES(v_product_id,p_venue,part->>'name',part->>'name_bs',coalesce(part->>'description',''),part->>'description_bs',(part->>'price')::numeric,coalesce(part->>'image',''),c.label,c.id,CASE WHEN r.kitchen_enabled THEN part->>'station' ELSE 'bar' END,coalesce((part->>'popular')::boolean,false),coalesce((part->>'sortOrder')::int,0))
  ON CONFLICT(id) DO UPDATE SET name=excluded.name,name_bs=excluded.name_bs,description=excluded.description,description_bs=excluded.description_bs,price=excluded.price,image=excluded.image,category=excluded.category,category_id=excluded.category_id,station=excluded.station,popular=excluded.popular,sort_order=excluded.sort_order;
  IF part ? 'initialInventory' THEN
   initial_quantity=coalesce((part->'initialInventory'->>'quantity')::numeric,0);
   IF initial_quantity<0 OR initial_quantity::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid initial quantity'; END IF;
   inserted_stock=NULL;
   INSERT INTO sarayamenu.inventory(restaurant_id,product_id,product_name,quantity,unit,tracked)
   VALUES(p_venue,v_product_id,part->>'name',initial_quantity,'kom',coalesce((part->'initialInventory'->>'tracked')::boolean,false))
   ON CONFLICT(restaurant_id,product_id) DO NOTHING RETURNING id INTO inserted_stock;
   IF inserted_stock IS NOT NULL AND initial_quantity<>0 THEN
    INSERT INTO sarayamenu.inventory_movements(restaurant_id,product_id,product_name,quantity_delta,reason,waiter_id)
    VALUES(p_venue,v_product_id,part->>'name',initial_quantity,'init',p_actor);
   END IF;
  END IF;
  IF part ? 'addons' THEN
   DELETE FROM sarayamenu.addons a WHERE a.product_id=v_product_id;
   FOR v IN SELECT value FROM jsonb_array_elements(part->'addons') LOOP
    IF (v->>'price')::numeric<0 OR (v->>'price')::numeric::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid addon price'; END IF;
    INSERT INTO sarayamenu.addons(id,product_id,name,name_bs,price,group_id,group_label,min_select,max_select,depends_on_variation_id,depends_on_option_id)
    VALUES(v->>'id',v_product_id,v->>'name',v->>'name_bs',(v->>'price')::numeric,v->>'groupId',v->>'groupLabel',(v->>'minSelect')::int,(v->>'maxSelect')::int,v->'dependsOn'->>'variationId',v->'dependsOn'->>'optionId');
   END LOOP;
  END IF;
  IF part ? 'variations' THEN
   DELETE FROM sarayamenu.variation_options WHERE variation_id IN (SELECT id FROM sarayamenu.variations v WHERE v.product_id=v_product_id);
   DELETE FROM sarayamenu.variations v WHERE v.product_id=v_product_id;
   FOR v IN SELECT value FROM jsonb_array_elements(part->'variations') LOOP
    INSERT INTO sarayamenu.variations(id,product_id,name,name_bs,required,min_select,max_select) VALUES(v->>'id',v_product_id,v->>'name',v->>'name_bs',coalesce((v->>'required')::boolean,false),(v->>'minSelect')::int,(v->>'maxSelect')::int);
    FOR o IN SELECT value FROM jsonb_array_elements(v->'options') LOOP
     IF (o->>'priceAdjustment')::numeric::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Invalid option price'; END IF;
     INSERT INTO sarayamenu.variation_options(id,variation_id,label,label_bs,price_adjustment,depends_on_variation_id,depends_on_option_id) VALUES(o->>'id',v->>'id',o->>'label',o->>'label_bs',coalesce((o->>'priceAdjustment')::numeric,0),o->'dependsOn'->>'variationId',o->'dependsOn'->>'optionId');
    END LOOP;
   END LOOP;
  END IF;
 END LOOP;
 DELETE FROM sarayamenu.products WHERE restaurant_id=p_venue AND id IN (SELECT value FROM jsonb_array_elements_text(coalesce(p_patch->'productsDelete','[]')));
 IF EXISTS(SELECT 1 FROM sarayamenu.products WHERE restaurant_id=p_venue AND category_id IN (SELECT value FROM jsonb_array_elements_text(coalesce(p_patch->'categoriesDelete','[]')))) THEN RAISE EXCEPTION 'Category still contains products'; END IF;
 DELETE FROM sarayamenu.categories WHERE restaurant_id=p_venue AND id IN (SELECT value FROM jsonb_array_elements_text(coalesce(p_patch->'categoriesDelete','[]')));
 IF p_patch ? 'pageContent' THEN INSERT INTO sarayamenu.page_content(restaurant_id,content) VALUES(p_venue,p_patch->'pageContent') ON CONFLICT(restaurant_id) DO UPDATE SET content=excluded.content; END IF;
 IF p_patch ? 'componentStyles' THEN INSERT INTO sarayamenu.component_styles(restaurant_id,styles) VALUES(p_venue,p_patch->'componentStyles') ON CONFLICT(restaurant_id) DO UPDATE SET styles=excluded.styles; END IF;
 IF p_patch ? 'layoutConfig' THEN INSERT INTO sarayamenu.layout_config(restaurant_id,config) VALUES(p_venue,p_patch->'layoutConfig') ON CONFLICT(restaurant_id) DO UPDATE SET config=excluded.config; END IF;
 IF p_patch ? 'themeCustomizations' THEN
  FOR section,part IN SELECT * FROM jsonb_each(p_patch->'themeCustomizations') LOOP
   INSERT INTO sarayamenu.theme_customizations(restaurant_id,theme_id,page_content,component_styles,layout_config) VALUES(p_venue,section,coalesce(part->'pageContent','{}'),coalesce(part->'componentStyles','{}'),coalesce(part->'layoutConfig','{}')) ON CONFLICT(restaurant_id,theme_id) DO UPDATE SET page_content=excluded.page_content,component_styles=excluded.component_styles,layout_config=excluded.layout_config;
  END LOOP;
 END IF;
 UPDATE sarayamenu.restaurants SET revision=revision+1 WHERE id=p_venue RETURNING jsonb_build_object('revision',revision) INTO result;
 IF p_patch ? 'importMetadata' THEN result=result||jsonb_build_object('importMetadata',p_patch->'importMetadata');END IF;
 INSERT INTO sarayamenu.operation_receipts(actor_id,restaurant_id,request_key,action,fingerprint,result) VALUES(p_actor,p_venue,p_request_key,'menu.save',fingerprint,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION sarayamenu.hos_menu_save(uuid,text,bigint,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION sarayamenu.hos_menu_save(uuid,text,bigint,jsonb,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
