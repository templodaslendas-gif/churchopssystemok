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
      absences: {
        Row: {
          church_id: string
          created_at: string
          ends_on: string
          id: string
          reason: string | null
          starts_on: string
          volunteer_id: string
        }
        Insert: {
          church_id: string
          created_at?: string
          ends_on: string
          id?: string
          reason?: string | null
          starts_on: string
          volunteer_id: string
        }
        Update: {
          church_id?: string
          created_at?: string
          ends_on?: string
          id?: string
          reason?: string | null
          starts_on?: string
          volunteer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "absences_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "absences_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "volunteers"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          church_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          church_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          church_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      churches: {
        Row: {
          city: string | null
          created_at: string
          id: string
          name: string
          state: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          name: string
          state?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          name?: string
          state?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      confirmations: {
        Row: {
          assignment_id: string
          church_id: string
          created_at: string
          id: string
          message: string | null
          responded_at: string | null
          status: Database["public"]["Enums"]["confirmation_status"]
          updated_at: string
          volunteer_id: string
        }
        Insert: {
          assignment_id: string
          church_id: string
          created_at?: string
          id?: string
          message?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["confirmation_status"]
          updated_at?: string
          volunteer_id: string
        }
        Update: {
          assignment_id?: string
          church_id?: string
          created_at?: string
          id?: string
          message?: string | null
          responded_at?: string | null
          status?: Database["public"]["Enums"]["confirmation_status"]
          updated_at?: string
          volunteer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "confirmations_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "schedule_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confirmations_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confirmations_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "volunteers"
            referencedColumns: ["id"]
          },
        ]
      }
      conflict_rules: {
        Row: {
          block_same_time: boolean
          church_id: string
          created_at: string
          id: string
          max_assignments_per_month: number
          updated_at: string
          warn_frequency: boolean
          warn_same_day: boolean
        }
        Insert: {
          block_same_time?: boolean
          church_id: string
          created_at?: string
          id?: string
          max_assignments_per_month?: number
          updated_at?: string
          warn_frequency?: boolean
          warn_same_day?: boolean
        }
        Update: {
          block_same_time?: boolean
          church_id?: string
          created_at?: string
          id?: string
          max_assignments_per_month?: number
          updated_at?: string
          warn_frequency?: boolean
          warn_same_day?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "conflict_rules_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: true
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          church_id: string
          created_at: string
          created_by: string | null
          ends_at: string | null
          event_type: Database["public"]["Enums"]["event_type"]
          id: string
          location: string | null
          notes: string | null
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          location?: string | null
          notes?: string | null
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          event_type?: Database["public"]["Enums"]["event_type"]
          id?: string
          location?: string | null
          notes?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          church_id: string
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          ministry_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["invitation_status"]
          token: string
          volunteer_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          church_id: string
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          ministry_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
          volunteer_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          church_id?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          ministry_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["invitation_status"]
          token?: string
          volunteer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invitations_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "volunteers"
            referencedColumns: ["id"]
          },
        ]
      }
      ministries: {
        Row: {
          church_id: string
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          leader_id: string | null
          name: string
          updated_at: string
        }
        Insert: {
          church_id: string
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          leader_id?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          church_id?: string
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          leader_id?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ministries_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ministries_leader_id_profiles_fkey"
            columns: ["leader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ministry_roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          ministry_id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          ministry_id: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          ministry_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "ministry_roles_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          church_id: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          church_id?: string | null
          created_at?: string
          email: string
          full_name: string
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          church_id?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      schedule_assignments: {
        Row: {
          church_id: string
          created_at: string
          id: string
          ministry_role_id: string | null
          schedule_id: string
          volunteer_id: string
        }
        Insert: {
          church_id: string
          created_at?: string
          id?: string
          ministry_role_id?: string | null
          schedule_id: string
          volunteer_id: string
        }
        Update: {
          church_id?: string
          created_at?: string
          id?: string
          ministry_role_id?: string | null
          schedule_id?: string
          volunteer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedule_assignments_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_ministry_role_id_fkey"
            columns: ["ministry_role_id"]
            isOneToOne: false
            referencedRelation: "ministry_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedule_assignments_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "volunteers"
            referencedColumns: ["id"]
          },
        ]
      }
      schedules: {
        Row: {
          church_id: string
          created_at: string
          event_id: string
          id: string
          is_published: boolean
          ministry_id: string
          notes: string | null
          published_at: string | null
          updated_at: string
        }
        Insert: {
          church_id: string
          created_at?: string
          event_id: string
          id?: string
          is_published?: boolean
          ministry_id: string
          notes?: string | null
          published_at?: string | null
          updated_at?: string
        }
        Update: {
          church_id?: string
          created_at?: string
          event_id?: string
          id?: string
          is_published?: boolean
          ministry_id?: string
          notes?: string | null
          published_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
        ]
      }
      substitutions: {
        Row: {
          assignment_id: string
          church_id: string
          created_at: string
          id: string
          reason: string | null
          requested_by: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["substitution_status"]
          substitute_id: string | null
          updated_at: string
        }
        Insert: {
          assignment_id: string
          church_id: string
          created_at?: string
          id?: string
          reason?: string | null
          requested_by: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["substitution_status"]
          substitute_id?: string | null
          updated_at?: string
        }
        Update: {
          assignment_id?: string
          church_id?: string
          created_at?: string
          id?: string
          reason?: string | null
          requested_by?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["substitution_status"]
          substitute_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "substitutions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "schedule_assignments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "volunteers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "substitutions_substitute_id_fkey"
            columns: ["substitute_id"]
            isOneToOne: false
            referencedRelation: "volunteers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          church_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          church_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          church_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteer_ministries: {
        Row: {
          created_at: string
          id: string
          ministry_id: string
          ministry_role_id: string | null
          role: Database["public"]["Enums"]["ministry_member_role"]
          volunteer_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ministry_id: string
          ministry_role_id?: string | null
          role?: Database["public"]["Enums"]["ministry_member_role"]
          volunteer_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ministry_id?: string
          ministry_role_id?: string | null
          role?: Database["public"]["Enums"]["ministry_member_role"]
          volunteer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "volunteer_ministries_ministry_id_fkey"
            columns: ["ministry_id"]
            isOneToOne: false
            referencedRelation: "ministries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_ministries_ministry_role_id_fkey"
            columns: ["ministry_role_id"]
            isOneToOne: false
            referencedRelation: "ministry_roles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "volunteer_ministries_volunteer_id_fkey"
            columns: ["volunteer_id"]
            isOneToOne: false
            referencedRelation: "volunteers"
            referencedColumns: ["id"]
          },
        ]
      }
      volunteers: {
        Row: {
          church_id: string
          created_at: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          notes: string | null
          phone: string | null
          unavailable_weekdays: number[] | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          church_id: string
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          unavailable_weekdays?: number[] | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          church_id?: string
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string | null
          unavailable_weekdays?: number[] | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "volunteers_church_id_fkey"
            columns: ["church_id"]
            isOneToOne: false
            referencedRelation: "churches"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      count_volunteer_assignments_in_month: {
        Args: {
          p_month_end: string
          p_month_start: string
          p_volunteer_id: string
        }
        Returns: number
      }
      current_church_id: { Args: never; Returns: string }
      get_invitation_by_token: {
        Args: { _token: string }
        Returns: {
          church_id: string
          church_name: string
          email: string
          ministry_id: string
          ministry_name: string
          role: Database["public"]["Enums"]["app_role"]
          volunteer_id: string
          volunteer_name: string
        }[]
      }
      has_any_role: {
        Args: {
          _roles: Database["public"]["Enums"]["app_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_leader_of_ministry: {
        Args: { _ministry_id: string; _user_id: string }
        Returns: boolean
      }
      is_member_of_church: { Args: { _church_id: string }; Returns: boolean }
      is_ministry_leader: {
        Args: { _ministry_id: string; _user_id: string }
        Returns: boolean
      }
      respond_to_assignment: {
        Args: {
          _assignment_id: string
          _message?: string
          _status: Database["public"]["Enums"]["confirmation_status"]
        }
        Returns: {
          assignment_id: string
          church_id: string
          created_at: string
          id: string
          message: string | null
          responded_at: string | null
          status: Database["public"]["Enums"]["confirmation_status"]
          updated_at: string
          volunteer_id: string
        }
        SetofOptions: {
          from: "*"
          to: "confirmations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "super_admin" | "supervisor" | "ministry_leader" | "volunteer"
      confirmation_status:
        | "pending"
        | "confirmed"
        | "declined"
        | "substitution_requested"
      event_type: "culto" | "ensaio" | "evento_especial" | "reuniao"
      invitation_status: "pending" | "accepted" | "expired" | "cancelled"
      ministry_member_role: "leader" | "volunteer"
      substitution_status: "open" | "accepted" | "rejected" | "cancelled"
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
      app_role: ["super_admin", "supervisor", "ministry_leader", "volunteer"],
      confirmation_status: [
        "pending",
        "confirmed",
        "declined",
        "substitution_requested",
      ],
      event_type: ["culto", "ensaio", "evento_especial", "reuniao"],
      invitation_status: ["pending", "accepted", "expired", "cancelled"],
      ministry_member_role: ["leader", "volunteer"],
      substitution_status: ["open", "accepted", "rejected", "cancelled"],
    },
  },
} as const
