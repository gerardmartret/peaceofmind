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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      cpz_zones: {
        Row: {
          borough: string
          center_lat: number
          center_lng: number
          charge_info: string | null
          created_at: string | null
          geometry: Json
          id: number
          operating_days: string
          operating_hours: string
          restrictions: string | null
          updated_at: string | null
          zone_code: string
          zone_name: string
        }
        Insert: {
          borough: string
          center_lat: number
          center_lng: number
          charge_info?: string | null
          created_at?: string | null
          geometry: Json
          id?: number
          operating_days: string
          operating_hours: string
          restrictions?: string | null
          updated_at?: string | null
          zone_code: string
          zone_name: string
        }
        Update: {
          borough?: string
          center_lat?: number
          center_lng?: number
          charge_info?: string | null
          created_at?: string | null
          geometry?: Json
          id?: number
          operating_days?: string
          operating_hours?: string
          restrictions?: string | null
          updated_at?: string | null
          zone_code?: string
          zone_name?: string
        }
        Relationships: []
      }
      drivers: {
        Row: {
          destination: string
          full_name: string
          id: string
          imageUrl: string | null
        level_of_service: string | null
          vehicle_type: Database["public"]["Enums"]["drivers_vehicle_type"]
        }
        Insert: {
          destination: string
          full_name: string
          id?: string
          imageUrl?: string | null
        level_of_service?: string | null
          vehicle_type: Database["public"]["Enums"]["drivers_vehicle_type"]
        }
        Update: {
          destination?: string
          full_name?: string
          id?: string
          imageUrl?: string | null
        level_of_service?: string | null
          vehicle_type?: Database["public"]["Enums"]["drivers_vehicle_type"]
        }
        Relationships: []
      }
      driver_tokens: {
        Row: {
          created_at: string | null
          driver_email: string
          expires_at: string
          id: string
          invalidated_at: string | null
          invalidation_reason: string | null
          token: string
          trip_id: string
          used: boolean | null
          used_at: string | null
        }
        Insert: {
          created_at?: string | null
          driver_email: string
          expires_at: string
          id?: string
          invalidated_at?: string | null
          invalidation_reason?: string | null
          token: string
          trip_id: string
          used?: boolean | null
          used_at?: string | null
        }
        Update: {
          created_at?: string | null
          driver_email?: string
          expires_at?: string
          id?: string
          invalidated_at?: string | null
          invalidation_reason?: string | null
          token?: string
          trip_id?: string
          used?: boolean | null
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_tokens_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string | null
          currency: string
          email: string
          id: string
          price: number
          trip_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          currency: string
          email: string
          id?: string
          price: number
          trip_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          currency?: string
          email?: string
          id?: string
          price?: number
          trip_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          created_at: string | null
          driver: string | null
          executive_report: Json | null
          generation_quality_breakdown: Json | null
          generation_quality_score: number | null
          id: string
          latest_changes: Json | null
          lead_passenger_name: string | null
          locations: Json
          passenger_count: number | null
          password: string | null
          quality_evaluated_at: string | null
          quality_evaluation_error: string | null
          quality_missed_opportunities: string[] | null
          quality_strengths: string[] | null
          quality_weaknesses: string[] | null
          status: string
          traffic_predictions: Json | null
          trip_date: string
          trip_destination: string | null
          trip_notes: string | null
          trip_results: Json
          updated_at: string | null
          user_email: string
          user_id: string | null
          vehicle: string | null
          version: number | null
        }
        Insert: {
          created_at?: string | null
          driver?: string | null
          executive_report?: Json | null
          generation_quality_breakdown?: Json | null
          generation_quality_score?: number | null
          id?: string
          latest_changes?: Json | null
          lead_passenger_name?: string | null
          locations: Json
          passenger_count?: number | null
          password?: string | null
          quality_evaluated_at?: string | null
          quality_evaluation_error?: string | null
          quality_missed_opportunities?: string[] | null
          quality_strengths?: string[] | null
          quality_weaknesses?: string[] | null
          status?: string
          traffic_predictions?: Json | null
          trip_date: string
          trip_destination?: string | null
          trip_notes?: string | null
          trip_results: Json
          updated_at?: string | null
          user_email: string
          user_id?: string | null
          vehicle?: string | null
          version?: number | null
        }
        Update: {
          created_at?: string | null
          driver?: string | null
          executive_report?: Json | null
          generation_quality_breakdown?: Json | null
          generation_quality_score?: number | null
          id?: string
          latest_changes?: Json | null
          lead_passenger_name?: string | null
          locations?: Json
          passenger_count?: number | null
          password?: string | null
          quality_evaluated_at?: string | null
          quality_evaluation_error?: string | null
          quality_missed_opportunities?: string[] | null
          quality_strengths?: string[] | null
          quality_weaknesses?: string[] | null
          status?: string
          traffic_predictions?: Json | null
          trip_date?: string
          trip_destination?: string | null
          trip_notes?: string | null
          trip_results?: Json
          updated_at?: string | null
          user_email?: string
          user_id?: string | null
          vehicle?: string | null
          version?: number | null
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          email: string
          marketing_consent: boolean | null
          unsubscribed: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          marketing_consent?: boolean | null
          unsubscribed?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          marketing_consent?: boolean | null
          unsubscribed?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      drivers_vehicle_type:
        | "sedan business"
        | "sedan business premium"
        | "suv business"
        | "suv business premium"
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
      drivers_vehicle_type: [
        "sedan business",
        "sedan business premium",
        "suv business",
        "suv business premium",
      ],
    },
  },
} as const
