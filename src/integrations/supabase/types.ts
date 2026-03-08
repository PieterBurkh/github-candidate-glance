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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      longlist_candidates: {
        Row: {
          candidate_repos: Json
          created_at: string
          discard_reason: string | null
          hydration: Json
          id: string
          login: string
          longlist_run_id: string
          pre_confidence: number
          pre_score: number
          repo_signals: Json
          selection_tier: string | null
          stage: string
          updated_at: string
        }
        Insert: {
          candidate_repos?: Json
          created_at?: string
          discard_reason?: string | null
          hydration?: Json
          id?: string
          login: string
          longlist_run_id: string
          pre_confidence?: number
          pre_score?: number
          repo_signals?: Json
          selection_tier?: string | null
          stage?: string
          updated_at?: string
        }
        Update: {
          candidate_repos?: Json
          created_at?: string
          discard_reason?: string | null
          hydration?: Json
          id?: string
          login?: string
          longlist_run_id?: string
          pre_confidence?: number
          pre_score?: number
          repo_signals?: Json
          selection_tier?: string | null
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "longlist_candidates_longlist_run_id_fkey"
            columns: ["longlist_run_id"]
            isOneToOne: false
            referencedRelation: "longlist_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      longlist_runs: {
        Row: {
          created_at: string
          id: string
          progress: Json
          source_run_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          progress?: Json
          source_run_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          progress?: Json
          source_run_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "longlist_runs_source_run_id_fkey"
            columns: ["source_run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      people: {
        Row: {
          created_at: string
          id: string
          login: string
          overall_score: number
          profile: Json
          review_status: string
          shortlist_status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          login: string
          overall_score?: number
          profile?: Json
          review_status?: string
          shortlist_status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          login?: string
          overall_score?: number
          profile?: Json
          review_status?: string
          shortlist_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      person_evidence: {
        Row: {
          created_at: string
          criterion: string
          evidence: Json
          id: string
          person_id: string
          repo_id: string | null
          score: number
        }
        Insert: {
          created_at?: string
          criterion: string
          evidence?: Json
          id?: string
          person_id: string
          repo_id?: string | null
          score?: number
        }
        Update: {
          created_at?: string
          criterion?: string
          evidence?: Json
          id?: string
          person_id?: string
          repo_id?: string | null
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "person_evidence_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_evidence_repo_id_fkey"
            columns: ["repo_id"]
            isOneToOne: false
            referencedRelation: "repos"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_runs: {
        Row: {
          config: Json
          created_at: string
          error: string | null
          id: string
          longlist_run_id: string | null
          run_id: string | null
          shortlist_run_id: string | null
          stage: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          error?: string | null
          id?: string
          longlist_run_id?: string | null
          run_id?: string | null
          shortlist_run_id?: string | null
          stage?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          error?: string | null
          id?: string
          longlist_run_id?: string | null
          run_id?: string | null
          shortlist_run_id?: string | null
          stage?: string
          updated_at?: string
        }
        Relationships: []
      }
      repo_signals: {
        Row: {
          confidence: number
          created_at: string
          criterion: string
          evidence: Json
          id: string
          notes: string | null
          repo_id: string
          signal_value: number
        }
        Insert: {
          confidence?: number
          created_at?: string
          criterion: string
          evidence?: Json
          id?: string
          notes?: string | null
          repo_id: string
          signal_value?: number
        }
        Update: {
          confidence?: number
          created_at?: string
          criterion?: string
          evidence?: Json
          id?: string
          notes?: string | null
          repo_id?: string
          signal_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "repo_signals_repo_id_fkey"
            columns: ["repo_id"]
            isOneToOne: false
            referencedRelation: "repos"
            referencedColumns: ["id"]
          },
        ]
      }
      repos: {
        Row: {
          created_at: string
          full_name: string
          id: string
          metadata: Json
          owner_login: string
          run_id: string
        }
        Insert: {
          created_at?: string
          full_name: string
          id?: string
          metadata?: Json
          owner_login: string
          run_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          metadata?: Json
          owner_login?: string
          run_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repos_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "runs"
            referencedColumns: ["id"]
          },
        ]
      }
      runs: {
        Row: {
          created_at: string
          id: string
          search_params: Json
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          search_params?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          search_params?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      shortlist_runs: {
        Row: {
          created_at: string
          id: string
          progress: Json
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          progress?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          progress?: Json
          status?: string
          updated_at?: string
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
