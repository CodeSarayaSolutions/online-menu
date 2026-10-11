-- Additive HOS foundation. Apply to the verification schema first.
BEGIN;
ALTER TABLE sarayamenu.restaurants
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'bs' CHECK (language IN ('bs','en')),
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Europe/Sarajevo',
  ADD COLUMN IF NOT EXISTS kitchen_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 0;
ALTER TABLE sarayamenu.users
  ADD COLUMN IF NOT EXISTS first_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS last_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS onboarding_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS temporary_pin_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS credential_version integer NOT NULL DEFAULT 0;
ALTER TABLE sarayamenu.sessions
  ADD COLUMN IF NOT EXISTS purpose text NOT NULL DEFAULT 'full' CHECK (purpose IN ('full','onboarding')),
  ADD COLUMN IF NOT EXISTS credential_version integer NOT NULL DEFAULT 0;
ALTER TABLE sarayamenu.products ADD COLUMN IF NOT EXISTS category_id text;
-- Only unambiguous category associations are migrated. Never guess duplicate labels.
-- This is a structural backfill, not a product edit. Preserve the original
-- modification timestamps while retaining the trigger's previous enable mode.
DO $category_backfill$
DECLARE trigger_mode "char";
BEGIN
SELECT tgenabled INTO trigger_mode FROM pg_trigger
 WHERE tgrelid='sarayamenu.products'::regclass AND tgname='trg_products_updated_at';
IF trigger_mode IS NOT NULL AND trigger_mode <> 'D' THEN
 ALTER TABLE sarayamenu.products DISABLE TRIGGER trg_products_updated_at;
END IF;
UPDATE sarayamenu.products p SET category_id = c.id
 FROM sarayamenu.categories c
 WHERE p.category_id IS NULL AND c.restaurant_id=p.restaurant_id AND c.id=p.category;
UPDATE sarayamenu.products p SET category_id = c.id
 FROM sarayamenu.categories c
 WHERE p.category_id IS NULL AND c.restaurant_id=p.restaurant_id AND c.label=p.category
 AND (SELECT count(*) FROM sarayamenu.categories c2 WHERE c2.restaurant_id=p.restaurant_id AND c2.label=p.category)=1;
IF trigger_mode = 'O' THEN
 ALTER TABLE sarayamenu.products ENABLE TRIGGER trg_products_updated_at;
ELSIF trigger_mode = 'A' THEN
 ALTER TABLE sarayamenu.products ENABLE ALWAYS TRIGGER trg_products_updated_at;
ELSIF trigger_mode = 'R' THEN
 ALTER TABLE sarayamenu.products ENABLE REPLICA TRIGGER trg_products_updated_at;
END IF;
END $category_backfill$;
CREATE UNIQUE INDEX IF NOT EXISTS categories_location_identity ON sarayamenu.categories(restaurant_id,id);
ALTER TABLE sarayamenu.table_tabs
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'waiter' CHECK (origin IN ('waiter','guest')),
  ADD COLUMN IF NOT EXISTS settled_by uuid,
  ADD COLUMN IF NOT EXISTS settlement_key text;
ALTER TABLE sarayamenu.table_tabs ALTER COLUMN waiter_id DROP NOT NULL;
ALTER TABLE sarayamenu.tab_items
  ADD COLUMN IF NOT EXISTS bar_done_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kitchen_done_quantity integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_order_id text,
  ADD COLUMN IF NOT EXISTS options jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE sarayamenu.orders
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS accepted_by uuid,
  ADD COLUMN IF NOT EXISTS estimated_minutes integer,
  ADD COLUMN IF NOT EXISTS linked_tab_id uuid;

CREATE TABLE IF NOT EXISTS sarayamenu.audit_events (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 restaurant_id text, actor_id uuid, actor_role text NOT NULL,
 action text NOT NULL, entity_type text NOT NULL, entity_id text,
 responsible_waiter_id uuid, request_id text,
 changes jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS audit_location_time ON sarayamenu.audit_events(restaurant_id,occurred_at DESC,id DESC);
CREATE TABLE IF NOT EXISTS sarayamenu.incidents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), occurred_at timestamptz NOT NULL DEFAULT now(),
 restaurant_id text, actor_id uuid, code text NOT NULL, context jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS sarayamenu.operation_receipts (
 actor_id uuid NOT NULL, restaurant_id text NOT NULL, request_key text NOT NULL,
 action text NOT NULL, fingerprint text NOT NULL, result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(actor_id,restaurant_id,request_key)
);
CREATE TABLE IF NOT EXISTS sarayamenu.guest_sessions (
 token_hash text PRIMARY KEY, restaurant_id text NOT NULL REFERENCES sarayamenu.restaurants(id),
 table_id uuid NOT NULL REFERENCES sarayamenu.restaurant_tables(id), expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sarayamenu.login_limits (
 key_hash text PRIMARY KEY, attempts integer NOT NULL DEFAULT 0,
 window_start timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sarayamenu.roster_snapshots (
 restaurant_id text NOT NULL REFERENCES sarayamenu.restaurants(id), roster_date date NOT NULL,
 segments jsonb NOT NULL, saved_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(restaurant_id,roster_date)
);
CREATE INDEX IF NOT EXISTS hos_closed_tab_page ON sarayamenu.table_tabs(restaurant_id,closed_at DESC,id DESC) WHERE status='closed';
CREATE INDEX IF NOT EXISTS hos_orders_page ON sarayamenu.orders(restaurant_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS hos_tab_lines ON sarayamenu.tab_items(tab_id);
CREATE INDEX IF NOT EXISTS hos_movements_period ON sarayamenu.inventory_movements(restaurant_id,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS hos_session_identity ON sarayamenu.sessions(token_hash,expires_at);

CREATE OR REPLACE FUNCTION sarayamenu.current_app_user_id() RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT s.user_id FROM sarayamenu.sessions s JOIN sarayamenu.users u ON u.id=s.user_id
 WHERE s.token_hash=sarayamenu.session_token_hash() AND s.expires_at>now()
 AND s.purpose='full' AND s.credential_version=u.credential_version AND NOT u.onboarding_required LIMIT 1
$$;

CREATE OR REPLACE FUNCTION sarayamenu.hos_role(p_actor uuid,p_venue text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT CASE WHEN u.platform_role='admin' THEN 'admin' ELSE
 (SELECT a.role FROM sarayamenu.restaurant_access a WHERE a.user_id=u.id AND a.restaurant_id=p_venue) END
 FROM sarayamenu.users u WHERE u.id=p_actor AND NOT u.onboarding_required
$$;

CREATE OR REPLACE FUNCTION sarayamenu.hos_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN RAISE EXCEPTION 'Append-only record' USING ERRCODE='42501'; END $$;
DROP TRIGGER IF EXISTS audit_append_only ON sarayamenu.audit_events;
CREATE TRIGGER audit_append_only BEFORE UPDATE OR DELETE OR TRUNCATE ON sarayamenu.audit_events
 FOR EACH STATEMENT EXECUTE FUNCTION sarayamenu.hos_immutable();

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

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['audit_events','incidents','operation_receipts','guest_sessions','login_limits','roster_snapshots'] LOOP
 EXECUTE format('ALTER TABLE sarayamenu.%I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('REVOKE ALL ON sarayamenu.%I FROM PUBLIC,anon,authenticated',t);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON sarayamenu.%I TO service_role',t);
 END LOOP;
 REVOKE UPDATE,DELETE,TRUNCATE ON sarayamenu.audit_events FROM service_role;
 GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA sarayamenu TO service_role;
 -- Audit existing entry paths too, including old clients, without attributing unknown service actors to a waiter.
 FOREACH t IN ARRAY ARRAY['restaurants','products','categories','users','restaurant_access','table_tabs','tab_items','inventory','inventory_movements','happy_hour_schedules','happy_hour_products','restaurant_day_hours','day_shift_segments','shift_date_assignments','page_content','component_styles','layout_config','theme_customizations'] LOOP
 EXECUTE format('DROP TRIGGER IF EXISTS hos_audit_change ON sarayamenu.%I',t);
 EXECUTE format('CREATE TRIGGER hos_audit_change AFTER INSERT OR UPDATE OR DELETE ON sarayamenu.%I FOR EACH ROW EXECUTE FUNCTION sarayamenu.hos_audit()',t);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION sarayamenu.hos_role(uuid,text),sarayamenu.hos_audit(),sarayamenu.hos_immutable() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION sarayamenu.hos_role(uuid,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
