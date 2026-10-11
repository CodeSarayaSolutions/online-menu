-- Apply with the server action routes, not before an old client deployment.
BEGIN;
CREATE OR REPLACE FUNCTION sarayamenu.hos_record_incident(p_id uuid,p_actor uuid,p_venue text,p_code text,p_context jsonb)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 INSERT INTO sarayamenu.incidents(id,actor_id,restaurant_id,code,context) VALUES(p_id,p_actor,p_venue,left(p_code,100),p_context)
$$;
REVOKE ALL ON FUNCTION sarayamenu.hos_record_incident(uuid,uuid,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION sarayamenu.hos_record_incident(uuid,uuid,text,text,jsonb) TO service_role;

-- Resolve account visibility without recursive users/access policy evaluation.
CREATE OR REPLACE FUNCTION sarayamenu.hos_visible_user(p_target uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT (SELECT sarayamenu.current_app_user_id()) IS NOT NULL AND (
 p_target=(SELECT sarayamenu.current_app_user_id()) OR (SELECT sarayamenu.is_platform_admin()) OR
 EXISTS(SELECT 1 FROM sarayamenu.restaurant_access a JOIN sarayamenu.restaurant_access b ON a.restaurant_id=b.restaurant_id
 WHERE a.user_id=(SELECT sarayamenu.current_app_user_id()) AND b.user_id=p_target))
$$;
REVOKE ALL ON FUNCTION sarayamenu.hos_visible_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION sarayamenu.hos_visible_user(uuid) TO anon,authenticated,service_role;

DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT policyname FROM pg_policies WHERE schemaname='sarayamenu' AND tablename='users' LOOP
  EXECUTE format('DROP POLICY %I ON sarayamenu.users',p.policyname);
 END LOOP;
END $$;
CREATE POLICY hos_profile_read ON sarayamenu.users FOR SELECT TO anon,authenticated USING(sarayamenu.hos_visible_user(id));
-- Column grants are the boundary: RLS filters rows, it cannot hide PIN hashes or protect platform_role.
REVOKE ALL ON sarayamenu.users FROM anon,authenticated;
GRANT SELECT(id,name,email,avatar,platform_role,created_at,first_name,last_name,phone) ON sarayamenu.users TO anon,authenticated;
GRANT UPDATE(name,avatar,first_name,last_name,phone) ON sarayamenu.users TO anon,authenticated;
CREATE POLICY hos_profile_update ON sarayamenu.users FOR UPDATE TO anon,authenticated
 USING(id=(SELECT sarayamenu.current_app_user_id())) WITH CHECK(id=(SELECT sarayamenu.current_app_user_id()));

-- Money, responsibility, inventory and access changes must go through checked transactions.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON sarayamenu.table_tabs,sarayamenu.tab_items,sarayamenu.inventory,sarayamenu.inventory_movements,sarayamenu.restaurant_access,sarayamenu.sessions FROM anon,authenticated;
REVOKE SELECT ON sarayamenu.sessions FROM anon,authenticated;

-- Anonymous counts should short-circuit before evaluating venue/parent-table membership per row.
DO $$ DECLARE p record; BEGIN
 FOR p IN SELECT * FROM pg_policies WHERE schemaname='sarayamenu'
 AND tablename IN ('table_tabs','tab_items','inventory','inventory_movements','restaurant_tables','orders','order_items')
 AND cmd IN ('SELECT','ALL') AND roles<>ARRAY['service_role']::name[] LOOP
  EXECUTE format('ALTER POLICY %I ON sarayamenu.%I USING ((SELECT sarayamenu.current_app_user_id()) IS NOT NULL AND (%s))',p.policyname,p.tablename,p.qual);
 END LOOP;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
