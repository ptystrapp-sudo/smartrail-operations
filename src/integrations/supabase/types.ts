export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action_type: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          new_value: Json | null
          previous_value: Json | null
        }
        Insert: {
          action_type: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
        }
        Update: {
          action_type?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          new_value?: Json | null
          previous_value?: Json | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active_status: boolean
          created_at: string
          email: string
          full_name: string
          id: string
          phone_number: string | null
          station_assignment: string | null
          updated_at: string
        }
        Insert: {
          active_status?: boolean
          created_at?: string
          email: string
          full_name?: string
          id: string
          phone_number?: string | null
          station_assignment?: string | null
          updated_at?: string
        }
        Update: {
          active_status?: boolean
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone_number?: string | null
          station_assignment?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      routes: {
        Row: {
          created_at: string
          destination_station: string
          estimated_duration: number
          fare: number
          id: string
          origin_station: string
          route_status: Database["public"]["Enums"]["route_status"]
        }
        Insert: {
          created_at?: string
          destination_station: string
          estimated_duration: number
          fare: number
          id?: string
          origin_station: string
          route_status?: Database["public"]["Enums"]["route_status"]
        }
        Update: {
          created_at?: string
          destination_station?: string
          estimated_duration?: number
          fare?: number
          id?: string
          origin_station?: string
          route_status?: Database["public"]["Enums"]["route_status"]
        }
        Relationships: [
          {
            foreignKeyName: "routes_destination_station_fkey"
            columns: ["destination_station"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "routes_origin_station_fkey"
            columns: ["origin_station"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      stations: {
        Row: {
          active_status: boolean
          created_at: string
          daily_capacity: number
          id: string
          region: string
          station_name: string
        }
        Insert: {
          active_status?: boolean
          created_at?: string
          daily_capacity?: number
          id?: string
          region: string
          station_name: string
        }
        Update: {
          active_status?: boolean
          created_at?: string
          daily_capacity?: number
          id?: string
          region?: string
          station_name?: string
        }
        Relationships: []
      }
      tickets: {
        Row: {
          activation_timestamp: string | null
          created_at: string
          expiry_timestamp: string
          fare_paid: number
          id: string
          max_validations: number
          payment_status: Database["public"]["Enums"]["payment_status"]
          purchase_timestamp: string
          qr_token: string
          route_id: string
          ticket_status: Database["public"]["Enums"]["ticket_status"]
          ticket_type: Database["public"]["Enums"]["ticket_type"]
          user_id: string
          validation_count: number
        }
        Insert: {
          activation_timestamp?: string | null
          created_at?: string
          expiry_timestamp: string
          fare_paid: number
          id?: string
          max_validations?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          purchase_timestamp?: string
          qr_token?: string
          route_id: string
          ticket_status?: Database["public"]["Enums"]["ticket_status"]
          ticket_type?: Database["public"]["Enums"]["ticket_type"]
          user_id: string
          validation_count?: number
        }
        Update: {
          activation_timestamp?: string | null
          created_at?: string
          expiry_timestamp?: string
          fare_paid?: number
          id?: string
          max_validations?: number
          payment_status?: Database["public"]["Enums"]["payment_status"]
          purchase_timestamp?: string
          qr_token?: string
          route_id?: string
          ticket_status?: Database["public"]["Enums"]["ticket_status"]
          ticket_type?: Database["public"]["Enums"]["ticket_type"]
          user_id?: string
          validation_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "tickets_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_method: string
          payment_reference: string
          ticket_id: string | null
          transaction_status: Database["public"]["Enums"]["payment_status"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_method: string
          payment_reference?: string
          ticket_id?: string | null
          transaction_status?: Database["public"]["Enums"]["payment_status"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_method?: string
          payment_reference?: string
          ticket_id?: string | null
          transaction_status?: Database["public"]["Enums"]["payment_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      validation_logs: {
        Row: {
          failure_reason: string | null
          id: string
          override_reason: string | null
          override_used: boolean
          qr_token_attempted: string | null
          scan_timestamp: string
          scanned_by: string | null
          station_id: string | null
          ticket_id: string | null
          validation_result: Database["public"]["Enums"]["validation_result"]
        }
        Insert: {
          failure_reason?: string | null
          id?: string
          override_reason?: string | null
          override_used?: boolean
          qr_token_attempted?: string | null
          scan_timestamp?: string
          scanned_by?: string | null
          station_id?: string | null
          ticket_id?: string | null
          validation_result: Database["public"]["Enums"]["validation_result"]
        }
        Update: {
          failure_reason?: string | null
          id?: string
          override_reason?: string | null
          override_used?: boolean
          qr_token_attempted?: string | null
          scan_timestamp?: string
          scanned_by?: string | null
          station_id?: string | null
          ticket_id?: string | null
          validation_result?: Database["public"]["Enums"]["validation_result"]
        }
        Relationships: [
          {
            foreignKeyName: "validation_logs_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "validation_logs_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "commuter" | "station_staff" | "supervisor" | "admin"
      payment_status: "pending" | "completed" | "failed" | "refunded"
      route_status: "operational" | "suspended" | "maintenance"
      ticket_status: "active" | "used" | "expired" | "cancelled"
      ticket_type: "single" | "return" | "weekly" | "monthly"
      validation_result: "valid" | "invalid" | "overridden"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["commuter", "station_staff", "supervisor", "admin"],
      payment_status: ["pending", "completed", "failed", "refunded"],
      route_status: ["operational", "suspended", "maintenance"],
      ticket_status: ["active", "used", "expired", "cancelled"],
      ticket_type: ["single", "return", "weekly", "monthly"],
      validation_result: ["valid", "invalid", "overridden"],
    },
  },
} as const
