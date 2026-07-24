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
      academic_years: {
        Row: {
          active_period: string
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          active_period?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          active_period?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: []
      }
      grades: {
        Row: {
          comment: string | null
          document_score: number | null
          english_score: number | null
          id: string
          implementation_score: number | null
          is_locked: boolean | null
          lecturer_id: string | null
          period: string
          student_id: string | null
          submitted_at: string | null
          team_id: string | null
          updated_at: string | null
        }
        Insert: {
          comment?: string | null
          document_score?: number | null
          english_score?: number | null
          id?: string
          implementation_score?: number | null
          is_locked?: boolean | null
          lecturer_id?: string | null
          period?: string
          student_id?: string | null
          submitted_at?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Update: {
          comment?: string | null
          document_score?: number | null
          english_score?: number | null
          id?: string
          implementation_score?: number | null
          is_locked?: boolean | null
          lecturer_id?: string | null
          period?: string
          student_id?: string | null
          submitted_at?: string | null
          team_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "grades_lecturer_id_fkey"
            columns: ["lecturer_id"]
            isOneToOne: false
            referencedRelation: "lecturer_progress"
            referencedColumns: ["lecturer_id"]
          },
          {
            foreignKeyName: "grades_lecturer_id_fkey"
            columns: ["lecturer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "lecturer_progress"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "grades_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string | null
          id: string
          is_deleted: boolean | null
          kelas: string | null
          name: string
          nim: string
          prodi: string | null
          semester: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_deleted?: boolean | null
          kelas?: string | null
          name: string
          nim: string
          prodi?: string | null
          semester?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_deleted?: boolean | null
          kelas?: string | null
          name?: string
          nim?: string
          prodi?: string | null
          semester?: string | null
        }
        Relationships: []
      }
      team_lecturers: {
        Row: {
          lecturer_id: string
          reviewer_order: number | null
          role: string
          team_id: string
        }
        Insert: {
          lecturer_id: string
          reviewer_order?: number | null
          role?: string
          team_id: string
        }
        Update: {
          lecturer_id?: string
          reviewer_order?: number | null
          role?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_lecturers_lecturer_id_fkey"
            columns: ["lecturer_id"]
            isOneToOne: false
            referencedRelation: "lecturer_progress"
            referencedColumns: ["lecturer_id"]
          },
          {
            foreignKeyName: "team_lecturers_lecturer_id_fkey"
            columns: ["lecturer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_lecturers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "lecturer_progress"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "team_lecturers_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      team_students: {
        Row: {
          student_id: string
          team_id: string
        }
        Insert: {
          student_id: string
          team_id: string
        }
        Update: {
          student_id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_students_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "lecturer_progress"
            referencedColumns: ["team_id"]
          },
          {
            foreignKeyName: "team_students_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          academic_year_id: string | null
          bast: string | null
          created_at: string | null
          id: string
          is_deleted: boolean | null
          kelas: string | null
          laporan_akhir: string | null
          manual_book: string | null
          name: string
          poster: string | null
          rpp: string | null
          team_code: string | null
          video_demo: string | null
        }
        Insert: {
          academic_year_id?: string | null
          bast?: string | null
          created_at?: string | null
          id?: string
          is_deleted?: boolean | null
          kelas?: string | null
          laporan_akhir?: string | null
          manual_book?: string | null
          name: string
          poster?: string | null
          rpp?: string | null
          team_code?: string | null
          video_demo?: string | null
        }
        Update: {
          academic_year_id?: string | null
          bast?: string | null
          created_at?: string | null
          id?: string
          is_deleted?: boolean | null
          kelas?: string | null
          laporan_akhir?: string | null
          manual_book?: string | null
          name?: string
          poster?: string | null
          rpp?: string | null
          team_code?: string | null
          video_demo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_semester_id_fkey"
            columns: ["academic_year_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          id: string
          initials: string | null
          name: string
          password_hash: string | null
          role: string
          username: string | null
        }
        Insert: {
          id?: string
          initials?: string | null
          name: string
          password_hash?: string | null
          role: string
          username?: string | null
        }
        Update: {
          id?: string
          initials?: string | null
          name?: string
          password_hash?: string | null
          role?: string
          username?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      lecturer_progress: {
        Row: {
          finalized_students: number | null
          graded_students: number | null
          lecturer_id: string | null
          lecturer_name: string | null
          semester_id: string | null
          status: string | null
          team_id: string | null
          team_name: string | null
          total_students: number | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "academic_years"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      set_active_semester: { Args: { target_id: string }; Returns: undefined }
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
