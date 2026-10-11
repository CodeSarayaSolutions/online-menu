// ─── Auto-generated Supabase Database Types ─────────────
// In production, regenerate this file with:
//   npx supabase gen types typescript --project-id YOUR_PROJECT_REF > src/types/supabase.ts
//
// This hand-written version matches our migration SQL and
// provides type safety until the CLI-generated version is ready.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  sarayamenu: {
    Tables: {
      guest_sessions: {
        Row: {token_hash:string;restaurant_id:string;table_id:string;expires_at:string;created_at:string};
        Insert: {token_hash:string;restaurant_id:string;table_id:string;expires_at:string;created_at?:string};
        Update: {expires_at?:string};
        Relationships: [];
      };
      users: {
        Row: {
          first_name: string;
          last_name: string;
          phone: string;
          onboarding_required: boolean;
          temporary_pin_expires_at: string | null;
          credential_version: number;
          id: string;
          name: string;
          email: string;
          password_hash: string | null;
          invite_otp_hash: string | null;
          invite_otp_expires_at: string | null;
          pin_hash: string | null;
          pin_reset_otp_hash: string | null;
          pin_reset_otp_expires_at: string | null;
          avatar: string | null;
          platform_role: 'admin' | 'user';
          created_at: string;
        };
        Insert: {
          first_name?: string;
          last_name?: string;
          phone?: string;
          onboarding_required?: boolean;
          temporary_pin_expires_at?: string | null;
          credential_version?: number;
          id?: string;
          name: string;
          email: string;
          password_hash?: string | null;
          invite_otp_hash?: string | null;
          invite_otp_expires_at?: string | null;
          pin_hash?: string | null;
          pin_reset_otp_hash?: string | null;
          pin_reset_otp_expires_at?: string | null;
          avatar?: string | null;
          platform_role?: 'admin' | 'user';
          created_at?: string;
        };
        Update: {
          first_name?: string;
          last_name?: string;
          phone?: string;
          onboarding_required?: boolean;
          temporary_pin_expires_at?: string | null;
          credential_version?: number;
          id?: string;
          name?: string;
          email?: string;
          password_hash?: string | null;
          invite_otp_hash?: string | null;
          invite_otp_expires_at?: string | null;
          pin_hash?: string | null;
          pin_reset_otp_hash?: string | null;
          pin_reset_otp_expires_at?: string | null;
          avatar?: string | null;
          platform_role?: 'admin' | 'user';
          created_at?: string;
        };
        Relationships: [];
      };

      sessions: {
        Row: {
          purpose: 'full' | 'onboarding';
          credential_version: number;
          id: string;
          user_id: string;
          token_hash: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          purpose?: 'full' | 'onboarding';
          credential_version?: number;
          id?: string;
          user_id: string;
          token_hash: string;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          purpose?: 'full' | 'onboarding';
          credential_version?: number;
          id?: string;
          user_id?: string;
          token_hash?: string;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };

      restaurants: {
        Row: {
          language: 'bs' | 'en';
          timezone: string;
          kitchen_enabled: boolean;
          revision: number;
          id: string;
          name: string;
          name_bs: string | null;
          tagline: string;
          tagline_bs: string | null;
          image: string;
          logo: string;
          address: string;
          address_bs: string | null;
          open_hours: string;
          open_hours_bs: string | null;
          wifi: string;
          phone: string;
          venue_type: 'restaurant' | 'cafe' | 'bar' | 'bakery' | 'food-truck' | 'pizzeria' | 'pub' | 'lounge';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          language?: 'bs' | 'en';
          timezone?: string;
          kitchen_enabled?: boolean;
          revision?: number;
          id: string;
          name: string;
          name_bs?: string | null;
          tagline?: string;
          tagline_bs?: string | null;
          image?: string;
          logo?: string;
          address?: string;
          address_bs?: string | null;
          open_hours?: string;
          open_hours_bs?: string | null;
          wifi?: string;
          phone?: string;
          venue_type?: 'restaurant' | 'cafe' | 'bar' | 'bakery' | 'food-truck' | 'pizzeria' | 'pub' | 'lounge';
          created_at?: string;
        };
        Update: {
          language?: 'bs' | 'en';
          timezone?: string;
          kitchen_enabled?: boolean;
          revision?: number;
          id?: string;
          name?: string;
          name_bs?: string | null;
          tagline?: string;
          tagline_bs?: string | null;
          image?: string;
          logo?: string;
          address?: string;
          address_bs?: string | null;
          open_hours?: string;
          open_hours_bs?: string | null;
          wifi?: string;
          phone?: string;
          venue_type?: 'restaurant' | 'cafe' | 'bar' | 'bakery' | 'food-truck' | 'pizzeria' | 'pub' | 'lounge';
        };
        Relationships: [];
      };

      restaurant_access: {
        Row: {
          id: string;
          user_id: string;
          restaurant_id: string;
          role: 'owner' | 'manager' | 'kitchen' | 'bar' | 'employee';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          restaurant_id: string;
          role?: 'owner' | 'manager' | 'kitchen' | 'bar' | 'employee';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          restaurant_id?: string;
          role?: 'owner' | 'manager' | 'kitchen' | 'bar' | 'employee';
        };
        Relationships: [
          {
            foreignKeyName: 'restaurant_access_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'restaurant_access_restaurant_id_fkey';
            columns: ['restaurant_id'];
            isOneToOne: false;
            referencedRelation: 'restaurants';
            referencedColumns: ['id'];
          },
        ];
      };

      categories: {
        Row: {
          id: string;
          restaurant_id: string;
          label: string;
          label_bs: string | null;
          icon: string;
          color: string;
          sort_order: number;
        };
        Insert: {
          id: string;
          restaurant_id: string;
          label: string;
          label_bs?: string | null;
          icon?: string;
          color?: string;
          sort_order?: number;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          label?: string;
          label_bs?: string | null;
          icon?: string;
          color?: string;
          sort_order?: number;
        };
        Relationships: [];
      };

      products: {
        Row: {
          category_id: string | null;
          id: string;
          restaurant_id: string;
          category: string;
          name: string;
          name_bs: string | null;
          description: string;
          description_bs: string | null;
          price: number;
          image: string;
          popular: boolean;
          sort_order: number;
          station: 'kitchen' | 'bar' | 'both';
          updated_at: string;
        };
        Insert: {
          category_id?: string | null;
          id: string;
          restaurant_id: string;
          category: string;
          name: string;
          name_bs?: string | null;
          description?: string;
          description_bs?: string | null;
          price?: number;
          image?: string;
          popular?: boolean;
          sort_order?: number;
          station?: 'kitchen' | 'bar' | 'both';
        };
        Update: {
          category_id?: string | null;
          id?: string;
          restaurant_id?: string;
          category?: string;
          name?: string;
          name_bs?: string | null;
          description?: string;
          description_bs?: string | null;
          price?: number;
          image?: string;
          popular?: boolean;
          sort_order?: number;
          station?: 'kitchen' | 'bar' | 'both';
        };
        Relationships: [];
      };

      addons: {
        Row: {
          id: string;
          product_id: string;
          name: string;
          name_bs: string | null;
          price: number;
          group_id: string | null;
          group_label: string | null;
          min_select: number | null;
          max_select: number | null;
          depends_on_variation_id: string | null;
          depends_on_option_id: string | null;
        };
        Insert: {
          id: string;
          product_id: string;
          name: string;
          name_bs?: string | null;
          price?: number;
          group_id?: string | null;
          group_label?: string | null;
          min_select?: number | null;
          max_select?: number | null;
          depends_on_variation_id?: string | null;
          depends_on_option_id?: string | null;
        };
        Update: {
          id?: string;
          product_id?: string;
          name?: string;
          name_bs?: string | null;
          price?: number;
          group_id?: string | null;
          group_label?: string | null;
          min_select?: number | null;
          max_select?: number | null;
          depends_on_variation_id?: string | null;
          depends_on_option_id?: string | null;
        };
        Relationships: [];
      };

      variations: {
        Row: {
          id: string;
          product_id: string;
          name: string;
          name_bs: string | null;
          required: boolean;
          min_select: number | null;
          max_select: number | null;
        };
        Insert: {
          id: string;
          product_id: string;
          name: string;
          name_bs?: string | null;
          required?: boolean;
          min_select?: number | null;
          max_select?: number | null;
        };
        Update: {
          id?: string;
          product_id?: string;
          name?: string;
          name_bs?: string | null;
          required?: boolean;
          min_select?: number | null;
          max_select?: number | null;
        };
        Relationships: [];
      };

      variation_options: {
        Row: {
          id: string;
          variation_id: string;
          label: string;
          label_bs: string | null;
          price_adjustment: number;
          depends_on_variation_id: string | null;
          depends_on_option_id: string | null;
        };
        Insert: {
          id: string;
          variation_id: string;
          label: string;
          label_bs?: string | null;
          price_adjustment?: number;
          depends_on_variation_id?: string | null;
          depends_on_option_id?: string | null;
        };
        Update: {
          id?: string;
          variation_id?: string;
          label?: string;
          label_bs?: string | null;
          price_adjustment?: number;
          depends_on_variation_id?: string | null;
          depends_on_option_id?: string | null;
        };
        Relationships: [];
      };

      page_content: {
        Row: {
          restaurant_id: string;
          content: Json;
          updated_at: string;
        };
        Insert: {
          restaurant_id: string;
          content?: Json;
        };
        Update: {
          restaurant_id?: string;
          content?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };

      component_styles: {
        Row: {
          restaurant_id: string;
          styles: Json;
          updated_at: string;
        };
        Insert: {
          restaurant_id: string;
          styles?: Json;
        };
        Update: {
          restaurant_id?: string;
          styles?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };

      layout_config: {
        Row: {
          restaurant_id: string;
          config: Json;
          updated_at: string;
        };
        Insert: {
          restaurant_id: string;
          config?: Json;
        };
        Update: {
          restaurant_id?: string;
          config?: Json;
          updated_at?: string;
        };
        Relationships: [];
      };

      theme_customizations: {
        Row: {
          id: string;
          restaurant_id: string;
          theme_id: string;
          component_styles: Json;
          layout_config: Json;
          page_content: Json;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          theme_id: string;
          component_styles?: Json;
          layout_config?: Json;
          page_content?: Json;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          theme_id?: string;
          component_styles?: Json;
          layout_config?: Json;
          page_content?: Json;
        };
        Relationships: [];
      };

      orders: {
        Row: {
          table_id: string | null;
          guest_token_hash: string | null;
          request_key: string | null;
          accepted_at: string | null;
          accepted_by: string | null;
          estimated_minutes: number | null;
          linked_tab_id: string | null;
          id: string;
          restaurant_id: string;
          items: Json;
          table_number: string;
          kitchen_note: string;
          total: number;
          item_count: number;
          status: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
          created_at: string;
          updated_at: string;
          payment_method: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          estimated_minutes?: number | null;
          linked_tab_id?: string | null;
          id: string;
          restaurant_id: string;
          items?: Json;
          table_number?: string;
          kitchen_note?: string;
          total?: number;
          item_count?: number;
          status?: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
          created_at?: string;
          payment_method?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          estimated_minutes?: number | null;
          linked_tab_id?: string | null;
          id?: string;
          restaurant_id?: string;
          items?: Json;
          table_number?: string;
          kitchen_note?: string;
          total?: number;
          item_count?: number;
          status?: 'pending' | 'preparing' | 'ready' | 'served' | 'cancelled';
          payment_method?: string;
        };
        Relationships: [];
      };

      restaurant_tables: {
        Row: {
          id: string;
          restaurant_id: string;
          label: string;
          capacity: number;
          position: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          label: string;
          capacity?: number;
          position?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          label?: string;
          capacity?: number;
          position?: number;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };

      table_tabs: {
        Row: {
          origin: 'waiter' | 'guest';
          settled_by: string | null;
          settlement_key: string | null;
          id: string;
          restaurant_id: string;
          table_id: string;
          waiter_id: string | null;
          status: 'open' | 'closed';
          payment_method: 'cash' | 'card' | null;
          total: number;
          closed_at: string | null;
          created_at: string;
        };
        Insert: {
          origin?: 'waiter' | 'guest';
          settled_by?: string | null;
          settlement_key?: string | null;
          id?: string;
          restaurant_id: string;
          table_id: string;
          waiter_id: string | null;
          status?: 'open' | 'closed';
          payment_method?: 'cash' | 'card' | null;
          total?: number;
          closed_at?: string | null;
          created_at?: string;
        };
        Update: {
          origin?: 'waiter' | 'guest';
          settled_by?: string | null;
          settlement_key?: string | null;
          id?: string;
          restaurant_id?: string;
          table_id?: string;
          waiter_id?: string | null;
          status?: 'open' | 'closed';
          payment_method?: 'cash' | 'card' | null;
          total?: number;
          closed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };

      tab_items: {
        Row: {
          bar_done_quantity: number;
          kitchen_done_quantity: number;
          source_order_id: string | null;
          options: Json;
          id: string;
          tab_id: string;
          product_id: string;
          product_name: string;
          quantity: number;
          unit_price: number;
          total_price: number;
          station: 'kitchen' | 'bar' | 'both';
          fire_status: 'backlog' | 'fired';
          fired_at: string | null;
          created_at: string;
        };
        Insert: {
          bar_done_quantity?: number;
          kitchen_done_quantity?: number;
          source_order_id?: string | null;
          options?: Json;
          id?: string;
          tab_id: string;
          product_id: string;
          product_name: string;
          quantity?: number;
          unit_price?: number;
          total_price?: number;
          station?: 'kitchen' | 'bar' | 'both';
          fire_status?: 'backlog' | 'fired';
          fired_at?: string | null;
          created_at?: string;
        };
        Update: {
          bar_done_quantity?: number;
          kitchen_done_quantity?: number;
          source_order_id?: string | null;
          options?: Json;
          id?: string;
          tab_id?: string;
          product_id?: string;
          product_name?: string;
          quantity?: number;
          unit_price?: number;
          total_price?: number;
          station?: 'kitchen' | 'bar' | 'both';
          fire_status?: 'backlog' | 'fired';
          fired_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };

      happy_hour_schedules: {
        Row: {
          id: string;
          restaurant_id: string;
          label: string | null;
          start_time: string;
          end_time: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          label?: string | null;
          start_time: string;
          end_time: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          label?: string | null;
          start_time?: string;
          end_time?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      happy_hour_products: {
        Row: {
          id: string;
          schedule_id: string;
          product_id: string;
          override_price: number;
        };
        Insert: {
          id?: string;
          schedule_id: string;
          product_id: string;
          override_price: number;
        };
        Update: {
          id?: string;
          schedule_id?: string;
          product_id?: string;
          override_price?: number;
        };
        Relationships: [];
      };

      inventory: {
        Row: {
          id: string;
          restaurant_id: string;
          product_id: string;
          product_name: string;
          quantity: number;
          unit: string;
          low_stock_threshold: number | null;
          tracked: boolean;
          updated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          product_id: string;
          product_name: string;
          quantity?: number;
          unit?: string;
          low_stock_threshold?: number | null;
          tracked?: boolean;
          updated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          product_id?: string;
          product_name?: string;
          quantity?: number;
          unit?: string;
          low_stock_threshold?: number | null;
          tracked?: boolean;
          updated_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };

      inventory_movements: {
        Row: {
          id: string;
          restaurant_id: string;
          product_id: string;
          product_name: string;
          quantity_delta: number;
          reason: string;
          tab_id: string | null;
          waiter_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          product_id: string;
          product_name: string;
          quantity_delta: number;
          reason?: string;
          tab_id?: string | null;
          waiter_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          product_id?: string;
          product_name?: string;
          quantity_delta?: number;
          reason?: string;
          tab_id?: string | null;
          waiter_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };

      inventory_audit_log: {
        Row: {
          id: string;
          restaurant_id: string | null;
          product_id: string | null;
          product_name: string | null;
          changed_by: string | null;
          changed_by_name: string | null;
          field_changed: string | null;
          old_value: string | null;
          new_value: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id?: string | null;
          product_id?: string | null;
          product_name?: string | null;
          changed_by?: string | null;
          changed_by_name?: string | null;
          field_changed?: string | null;
          old_value?: string | null;
          new_value?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string | null;
          product_id?: string | null;
          product_name?: string | null;
          changed_by?: string | null;
          changed_by_name?: string | null;
          field_changed?: string | null;
          old_value?: string | null;
          new_value?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };

      shifts: {
        Row: never;
        Insert: never;
        Update: never;
        Relationships: [];
      };

      shift_assignments: {
        Row: never;
        Insert: never;
        Update: never;
        Relationships: [];
      };

      restaurant_day_hours: {
        Row: {
          restaurant_id: string;
          day_of_week: number;
          opens_at: string;
          closes_at: string;
          is_closed: boolean;
          updated_at: string;
        };
        Insert: {
          restaurant_id: string;
          day_of_week: number;
          opens_at: string;
          closes_at: string;
          is_closed?: boolean;
          updated_at?: string;
        };
        Update: {
          restaurant_id?: string;
          day_of_week?: number;
          opens_at?: string;
          closes_at?: string;
          is_closed?: boolean;
          updated_at?: string;
        };
        Relationships: [];
      };

      day_shift_segments: {
        Row: {
          id: string;
          restaurant_id: string;
          day_of_week: number;
          label: string;
          starts_at: string;
          ends_at: string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          day_of_week: number;
          label?: string;
          starts_at: string;
          ends_at: string;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          day_of_week?: number;
          label?: string;
          starts_at?: string;
          ends_at?: string;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };

      day_shift_segment_assignments: {
        Row: {
          id: string;
          segment_id: string;
          user_id: string;
          restaurant_role: 'manager' | 'kitchen' | 'bar' | 'employee';
          assigned_at: string;
        };
        Insert: {
          id?: string;
          segment_id: string;
          user_id: string;
          restaurant_role: 'manager' | 'kitchen' | 'bar' | 'employee';
          assigned_at?: string;
        };
        Update: {
          id?: string;
          segment_id?: string;
          user_id?: string;
          restaurant_role?: 'manager' | 'kitchen' | 'bar' | 'employee';
          assigned_at?: string;
        };
        Relationships: [];
      };

      shift_date_assignments: {
        Row: {
          id: string;
          restaurant_id: string;
          roster_date: string;
          segment_id: string;
          user_id: string;
          restaurant_role: 'manager' | 'kitchen' | 'bar' | 'employee';
          created_at: string;
        };
        Insert: {
          id?: string;
          restaurant_id: string;
          roster_date: string;
          segment_id: string;
          user_id: string;
          restaurant_role: 'manager' | 'kitchen' | 'bar' | 'employee';
          created_at?: string;
        };
        Update: {
          id?: string;
          restaurant_id?: string;
          roster_date?: string;
          segment_id?: string;
          user_id?: string;
          restaurant_role?: 'manager' | 'kitchen' | 'bar' | 'employee';
          created_at?: string;
        };
        Relationships: [];
      };

      roster_snapshots: {
        Row: { restaurant_id: string; roster_date: string; segments: Json; saved_at: string; is_closed: boolean; timezone: string };
        Insert: { restaurant_id: string; roster_date: string; segments: Json; saved_at?: string; is_closed?: boolean; timezone?: string };
        Update: { segments?: Json; saved_at?: string; is_closed?: boolean; timezone?: string }; Relationships: [];
      };
      shift_daily_roster: {
        Row: {
          restaurant_id: string;
          roster_date: string;
          saved_at: string;
        };
        Insert: {
          restaurant_id: string;
          roster_date: string;
          saved_at?: string;
        };
        Update: {
          restaurant_id?: string;
          roster_date?: string;
          saved_at?: string;
        };
        Relationships: [];
      };
    };

    Views: Record<string, never>;

    Functions: {
      hos_import_receipt: {Args:{p_actor:string;p_venue:string;p_key:string;p_hash:string};Returns:Json};
      hos_guest_submit: { Args: {p_hash:string;p_venue:string;p_request:string;p_items:Json;p_note:string;p_table:string};Returns:Json };
      hos_guest_decide: { Args: {p_actor:string;p_venue:string;p_order:string;p_accept:boolean;p_minutes:number};Returns:Json };
      hos_inventory: { Args: { p_hash: string; p_venue: string; p_options?: Json }; Returns: Json };
      hos_support_feed: { Args: { p_actor: string; p_options?: Json }; Returns: Json };
      hos_roster: { Args: { p_venue: string; p_date: string }; Returns: Json };
      hos_shift_save: { Args: { p_actor: string; p_venue: string; p_action: string; p_data: Json }; Returns: Json };
      hos_shift_summary: { Args: { p_actor: string; p_venue: string; p_date: string; p_segment: string }; Returns: Json };
      hos_session_report: { Args: { p_hash: string; p_venue: string; p_range: string; p_from?: string | null; p_to?: string | null; p_options?: Json }; Returns: Json };
      hos_report: { Args: { p_actor: string; p_venue: string; p_from: string; p_to: string; p_options?: Json }; Returns: Json };
      hos_role: { Args: { p_actor: string; p_venue: string }; Returns: string | null };
      hos_menu_save: { Args: { p_actor: string; p_venue: string; p_revision: number | null; p_patch: Json; p_request_key: string }; Returns: Json };
      hos_record_incident: { Args: { p_id: string; p_actor: string | null; p_venue: string | null; p_code: string; p_context: Json }; Returns: undefined };
      hos_action: { Args: { p_actor_id: string | null; p_action: string; p_venue: string; p_data?: Json }; Returns: Json };
      current_app_user_id: {
        Args: Record<string, never>;
        Returns: string;
      };
      is_platform_admin: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      has_restaurant_role: {
        Args: { p_restaurant_id: string; p_role?: string | null };
        Returns: boolean;
      };
    };
  };
}

// ─── Convenience type aliases ────────────────────────────
export type Tables<T extends keyof Database['sarayamenu']['Tables']> =
  Database['sarayamenu']['Tables'][T]['Row'];
export type InsertDto<T extends keyof Database['sarayamenu']['Tables']> =
  Database['sarayamenu']['Tables'][T]['Insert'];
export type UpdateDto<T extends keyof Database['sarayamenu']['Tables']> =
  Database['sarayamenu']['Tables'][T]['Update'];
