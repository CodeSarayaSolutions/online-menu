BEGIN;
ALTER TABLE sarayamenu.happy_hour_schedules DROP CONSTRAINT IF EXISTS happy_hour_schedules_valid_time;
ALTER TABLE sarayamenu.happy_hour_schedules ADD CONSTRAINT happy_hour_schedules_valid_time CHECK(start_time<>end_time);
CREATE OR REPLACE FUNCTION sarayamenu.hos_audit() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b jsonb; a jsonb; delta jsonb; actor uuid; venue text; rid text; waiter uuid; fields text[];
BEGIN
 b=CASE WHEN TG_OP='INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
 a=CASE WHEN TG_OP='DELETE' THEN '{}'::jsonb ELSE to_jsonb(NEW) END;
 actor=coalesce(nullif(current_setting('hos.actor_id',true),'')::uuid,sarayamenu.current_app_user_id());
 venue=coalesce(a->>'restaurant_id',b->>'restaurant_id');
 rid=coalesce(a->>'id',b->>'id',a->>'restaurant_id',b->>'restaurant_id');
 IF TG_TABLE_NAME='restaurants' THEN venue=rid; END IF;
 IF TG_TABLE_NAME='table_tabs' THEN waiter=coalesce(a->>'waiter_id',b->>'waiter_id')::uuid; END IF;
 IF TG_TABLE_NAME='tab_items' THEN SELECT t.restaurant_id,t.waiter_id INTO venue,waiter FROM sarayamenu.table_tabs t WHERE t.id=coalesce(a->>'tab_id',b->>'tab_id')::uuid; END IF;
 IF TG_TABLE_NAME IN ('addons','variations') THEN SELECT p.restaurant_id INTO venue FROM sarayamenu.products p WHERE p.id=coalesce(a->>'product_id',b->>'product_id'); END IF;
 IF TG_TABLE_NAME='variation_options' THEN SELECT p.restaurant_id INTO venue FROM sarayamenu.products p JOIN sarayamenu.variations v ON v.product_id=p.id WHERE v.id=coalesce(a->>'variation_id',b->>'variation_id'); END IF;
 IF TG_TABLE_NAME='happy_hour_products' THEN SELECT h.restaurant_id INTO venue FROM sarayamenu.happy_hour_schedules h WHERE h.id=coalesce(a->>'schedule_id',b->>'schedule_id')::uuid; END IF;
 -- Never record hashes, passwords, tokens, OTPs, or redundant large presentation payloads.
 SELECT array_agg(key) INTO fields FROM jsonb_each(b||a) WHERE (b->key) IS DISTINCT FROM (a->key) AND key NOT IN ('updated_at','created_at');
 IF fields IS NULL THEN RETURN COALESCE(NEW,OLD); END IF;
 b=b-ARRAY['password_hash','pin_hash','invite_otp_hash','pin_reset_otp_hash','token_hash','guest_token_hash','request_fingerprint','items','content','styles','config','page_content','component_styles','layout_config'];
 a=a-ARRAY['password_hash','pin_hash','invite_otp_hash','pin_reset_otp_hash','token_hash','guest_token_hash','request_fingerprint','items','content','styles','config','page_content','component_styles','layout_config'];
 SELECT coalesce(jsonb_object_agg(k,jsonb_build_array(b->k,a->k)),'{}') INTO delta FROM unnest(fields) k WHERE b ? k OR a ? k;
 INSERT INTO sarayamenu.audit_events(restaurant_id,actor_id,actor_role,action,entity_type,entity_id,responsible_waiter_id,request_id,changes)
 VALUES(venue,actor,coalesce(sarayamenu.hos_role(actor,venue),'system'),coalesce(nullif(current_setting('hos.action',true),''),lower(TG_OP)),TG_TABLE_NAME,rid,waiter,nullif(current_setting('hos.request_id',true),''),jsonb_build_object('fields',fields,'delta',delta));
 RETURN COALESCE(NEW,OLD);
END $$;

-- All these writes now use scoped server transactions, including legacy-client attempts.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON sarayamenu.restaurants,sarayamenu.products,sarayamenu.categories,sarayamenu.addons,sarayamenu.variations,sarayamenu.variation_options,sarayamenu.page_content,sarayamenu.component_styles,sarayamenu.layout_config,sarayamenu.theme_customizations,sarayamenu.restaurant_tables,sarayamenu.happy_hour_schedules,sarayamenu.happy_hour_products FROM anon,authenticated;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['restaurant_tables','addons','variations','variation_options'] LOOP
  EXECUTE format('DROP TRIGGER IF EXISTS hos_audit_change ON sarayamenu.%I',t);
  EXECUTE format('CREATE TRIGGER hos_audit_change AFTER INSERT OR UPDATE OR DELETE ON sarayamenu.%I FOR EACH ROW EXECUTE FUNCTION sarayamenu.hos_audit()',t);
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';COMMIT;
