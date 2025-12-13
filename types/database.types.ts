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
      badges: {
        Row: {
          code: string
          created_at: string
          description: string | null
          emoji: string | null
          levels: Database["public"]["Enums"]["badge_level"][] | null
          rule: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          emoji?: string | null
          levels?: Database["public"]["Enums"]["badge_level"][] | null
          rule?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          emoji?: string | null
          levels?: Database["public"]["Enums"]["badge_level"][] | null
          rule?: Json | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      curricula: {
        Row: {
          exam: string
          id: string
          notes: string[] | null
          score_type: string[] | null
          tag: string | null
          version: string
        }
        Insert: {
          exam: string
          id?: string
          notes?: string[] | null
          score_type?: string[] | null
          tag?: string | null
          version: string
        }
        Update: {
          exam?: string
          id?: string
          notes?: string[] | null
          score_type?: string[] | null
          tag?: string | null
          version?: string
        }
        Relationships: []
      }
      curriculum_json: {
        Row: {
          id: string
          payload: Json
        }
        Insert: {
          id: string
          payload: Json
        }
        Update: {
          id?: string
          payload?: Json
        }
        Relationships: []
      }
      curriculum_lessons: {
        Row: {
          code: string
          id: number
          name: string
          section_id: number
        }
        Insert: {
          code: string
          id?: number
          name: string
          section_id: number
        }
        Update: {
          code?: string
          id?: number
          name?: string
          section_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_lessons_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "curriculum_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_sections: {
        Row: {
          code: string
          curriculum_id: string
          id: number
          name: string
        }
        Insert: {
          code: string
          curriculum_id: string
          id?: number
          name: string
        }
        Update: {
          code?: string
          curriculum_id?: string
          id?: number
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_sections_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curricula"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_topics: {
        Row: {
          lesson_id: number
          new_id: string
          sort_order: number | null
          title: string
        }
        Insert: {
          lesson_id: number
          new_id: string
          sort_order?: number | null
          title: string
        }
        Update: {
          lesson_id?: number
          new_id?: string
          sort_order?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_topics_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "curriculum_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_result_general: {
        Row: {
          created_at: string
          curriculum_id: string
          detail: Json | null
          duration_minutes: number
          finished_at: string
          id: string
          name: string
          planned_duration_minutes: number
          question_count: number
          started_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          curriculum_id: string
          detail?: Json | null
          duration_minutes?: number
          finished_at: string
          id?: string
          name: string
          planned_duration_minutes?: number
          question_count?: number
          started_at: string
          user_id: string
        }
        Update: {
          created_at?: string
          curriculum_id?: string
          detail?: Json | null
          duration_minutes?: number
          finished_at?: string
          id?: string
          name?: string
          planned_duration_minutes?: number
          question_count?: number
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exam_result_general_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curricula"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_result_general_detail: {
        Row: {
          blank_count: number
          correct_count: number
          created_at: string
          exam_result_general_id: string
          id: string
          lesson_id: number | null
          lesson_name: string
          net_score: number
          wrong_count: number
        }
        Insert: {
          blank_count?: number
          correct_count?: number
          created_at?: string
          exam_result_general_id: string
          id?: string
          lesson_id?: number | null
          lesson_name: string
          net_score?: number
          wrong_count?: number
        }
        Update: {
          blank_count?: number
          correct_count?: number
          created_at?: string
          exam_result_general_id?: string
          id?: string
          lesson_id?: number | null
          lesson_name?: string
          net_score?: number
          wrong_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "exam_result_general_detail_exam_result_general_id_fkey"
            columns: ["exam_result_general_id"]
            isOneToOne: false
            referencedRelation: "exam_result_general"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_result_general_detail_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "curriculum_lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      exam_results_topic: {
        Row: {
          blank_count: number | null
          correct_count: number | null
          created_at: string
          curriculum_id: string
          duration_minutes: number | null
          finished_at: string | null
          id: string
          lesson_id: number | null
          lesson_name: string | null
          net_score: number | null
          planned_duration_minutes: number | null
          question_count: number | null
          section_id: number | null
          section_name: string | null
          started_at: string | null
          topic_title: string | null
          topic_uuid: string
          updated_at: string
          user_id: string
          wrong_count: number | null
        }
        Insert: {
          blank_count?: number | null
          correct_count?: number | null
          created_at?: string
          curriculum_id: string
          duration_minutes?: number | null
          finished_at?: string | null
          id?: string
          lesson_id?: number | null
          lesson_name?: string | null
          net_score?: number | null
          planned_duration_minutes?: number | null
          question_count?: number | null
          section_id?: number | null
          section_name?: string | null
          started_at?: string | null
          topic_title?: string | null
          topic_uuid: string
          updated_at?: string
          user_id: string
          wrong_count?: number | null
        }
        Update: {
          blank_count?: number | null
          correct_count?: number | null
          created_at?: string
          curriculum_id?: string
          duration_minutes?: number | null
          finished_at?: string | null
          id?: string
          lesson_id?: number | null
          lesson_name?: string | null
          net_score?: number | null
          planned_duration_minutes?: number | null
          question_count?: number | null
          section_id?: number | null
          section_name?: string | null
          started_at?: string | null
          topic_title?: string | null
          topic_uuid?: string
          updated_at?: string
          user_id?: string
          wrong_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "exam_results_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "curriculum_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "curriculum_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_topic_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curricula"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exam_results_topic_topic_uuid_fkey"
            columns: ["topic_uuid"]
            isOneToOne: false
            referencedRelation: "curriculum_topics"
            referencedColumns: ["new_id"]
          },
        ]
      }
      leaderboard_entries: {
        Row: {
          id: number
          period: Database["public"]["Enums"]["period_type"]
          period_start: string
          rank: number | null
          total_min: number
          user_id: string
        }
        Insert: {
          id?: number
          period: Database["public"]["Enums"]["period_type"]
          period_start: string
          rank?: number | null
          total_min?: number
          user_id: string
        }
        Update: {
          id?: number
          period?: Database["public"]["Enums"]["period_type"]
          period_start?: string
          rank?: number | null
          total_min?: number
          user_id?: string
        }
        Relationships: []
      }
      leaderboard_summaries: {
        Row: {
          id: number
          period: Database["public"]["Enums"]["period_type"]
          period_start: string
          total_min: number | null
          updated_at: string
          winner_user_id: string | null
        }
        Insert: {
          id?: number
          period: Database["public"]["Enums"]["period_type"]
          period_start: string
          total_min?: number | null
          updated_at?: string
          winner_user_id?: string | null
        }
        Update: {
          id?: number
          period?: Database["public"]["Enums"]["period_type"]
          period_start?: string
          total_min?: number | null
          updated_at?: string
          winner_user_id?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          body: string | null
          conversation_id: string | null
          created_at: string
          id: string
          is_broadcast: boolean
          level: string
          read_at: string | null
          seen_at: string | null
          sender_id: string | null
          status: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          body?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          is_broadcast?: boolean
          level?: string
          read_at?: string | null
          seen_at?: string | null
          sender_id?: string | null
          status?: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          body?: string | null
          conversation_id?: string | null
          created_at?: string
          id?: string
          is_broadcast?: boolean
          level?: string
          read_at?: string | null
          seen_at?: string | null
          sender_id?: string | null
          status?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          currency: string
          esmm_send: boolean | null
          id: string
          invoice_id: string | null
          iyzico_payment_id: string
          paid_at: string
          plan_code: string | null
          premium_days: number | null
          raw_payload: Json | null
          status: string
          token_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          currency?: string
          esmm_send?: boolean | null
          id?: string
          invoice_id?: string | null
          iyzico_payment_id: string
          paid_at?: string
          plan_code?: string | null
          premium_days?: number | null
          raw_payload?: Json | null
          status: string
          token_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          currency?: string
          esmm_send?: boolean | null
          id?: string
          invoice_id?: string | null
          iyzico_payment_id?: string
          paid_at?: string
          plan_code?: string | null
          premium_days?: number | null
          raw_payload?: Json | null
          status?: string
          token_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      playlist_videos: {
        Row: {
          duration_minutes: number | null
          playlist_id: string
          sort_order: number | null
          title: string | null
          topic_uuid: string | null
          url: string | null
          video_id: string
        }
        Insert: {
          duration_minutes?: number | null
          playlist_id: string
          sort_order?: number | null
          title?: string | null
          topic_uuid?: string | null
          url?: string | null
          video_id: string
        }
        Update: {
          duration_minutes?: number | null
          playlist_id?: string
          sort_order?: number | null
          title?: string | null
          topic_uuid?: string | null
          url?: string | null
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_videos_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_videos_topic_uuid_fkey"
            columns: ["topic_uuid"]
            isOneToOne: false
            referencedRelation: "curriculum_topics"
            referencedColumns: ["new_id"]
          },
        ]
      }
      playlists: {
        Row: {
          curriculum_id: string | null
          id: string
          lesson_id: number | null
          section_id: number | null
          teacher: string | null
        }
        Insert: {
          curriculum_id?: string | null
          id: string
          lesson_id?: number | null
          section_id?: number | null
          teacher?: string | null
        }
        Update: {
          curriculum_id?: string | null
          id?: string
          lesson_id?: number | null
          section_id?: number | null
          teacher?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playlists_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curricula"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlists_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "curriculum_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlists_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "curriculum_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ai_belgesel_mode: boolean | null
          ai_character: Database["public"]["Enums"]["ai_character_enum"] | null
          ai_creativity:
            | Database["public"]["Enums"]["ai_creativity_enum"]
            | null
          ai_daily_plan_enabled: boolean | null
          ai_inspiration:
            | Database["public"]["Enums"]["ai_inspiration_enum"]
            | null
          ai_mode: Database["public"]["Enums"]["ai_mode_enum"] | null
          ai_prediction_enabled: boolean | null
          ai_reward_mode: Database["public"]["Enums"]["ai_reward_enum"] | null
          ai_weekly_report_enabled: boolean | null
          created_at: string
          customer_address: string | null
          customer_city: string | null
          customer_country: string | null
          customer_district: string | null
          customer_tax_number: string | null
          email: string | null
          fullname: string | null
          preferred_curriculum_id: string | null
          premium_ends_at: string | null
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_belgesel_mode?: boolean | null
          ai_character?: Database["public"]["Enums"]["ai_character_enum"] | null
          ai_creativity?:
            | Database["public"]["Enums"]["ai_creativity_enum"]
            | null
          ai_daily_plan_enabled?: boolean | null
          ai_inspiration?:
            | Database["public"]["Enums"]["ai_inspiration_enum"]
            | null
          ai_mode?: Database["public"]["Enums"]["ai_mode_enum"] | null
          ai_prediction_enabled?: boolean | null
          ai_reward_mode?: Database["public"]["Enums"]["ai_reward_enum"] | null
          ai_weekly_report_enabled?: boolean | null
          created_at?: string
          customer_address?: string | null
          customer_city?: string | null
          customer_country?: string | null
          customer_district?: string | null
          customer_tax_number?: string | null
          email?: string | null
          fullname?: string | null
          preferred_curriculum_id?: string | null
          premium_ends_at?: string | null
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_belgesel_mode?: boolean | null
          ai_character?: Database["public"]["Enums"]["ai_character_enum"] | null
          ai_creativity?:
            | Database["public"]["Enums"]["ai_creativity_enum"]
            | null
          ai_daily_plan_enabled?: boolean | null
          ai_inspiration?:
            | Database["public"]["Enums"]["ai_inspiration_enum"]
            | null
          ai_mode?: Database["public"]["Enums"]["ai_mode_enum"] | null
          ai_prediction_enabled?: boolean | null
          ai_reward_mode?: Database["public"]["Enums"]["ai_reward_enum"] | null
          ai_weekly_report_enabled?: boolean | null
          created_at?: string
          customer_address?: string | null
          customer_city?: string | null
          customer_country?: string | null
          customer_district?: string | null
          customer_tax_number?: string | null
          email?: string | null
          fullname?: string | null
          preferred_curriculum_id?: string | null
          premium_ends_at?: string | null
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_preferred_curriculum_id_fkey"
            columns: ["preferred_curriculum_id"]
            isOneToOne: false
            referencedRelation: "curricula"
            referencedColumns: ["id"]
          },
        ]
      }
      sprints: {
        Row: {
          cadence: Json
          created_at: string
          id: string
          scope: Json
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cadence?: Json
          created_at?: string
          id?: string
          scope?: Json
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cadence?: Json
          created_at?: string
          id?: string
          scope?: Json
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_plan_daily_stats: {
        Row: {
          completed: number
          day: Database["public"]["Enums"]["day_key"]
          plan_id: string
          total: number
        }
        Insert: {
          completed?: number
          day: Database["public"]["Enums"]["day_key"]
          plan_id: string
          total?: number
        }
        Update: {
          completed?: number
          day?: Database["public"]["Enums"]["day_key"]
          plan_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "study_plan_daily_stats_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "study_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      study_plan_tasks: {
        Row: {
          completed: boolean
          created_at: string
          curriculum_id: string | null
          day: Database["public"]["Enums"]["day_key"]
          id: string
          lesson_id: number | null
          notes: string | null
          plan_id: string
          section_id: number | null
          title: string
          topic_uuid: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          curriculum_id?: string | null
          day: Database["public"]["Enums"]["day_key"]
          id?: string
          lesson_id?: number | null
          notes?: string | null
          plan_id: string
          section_id?: number | null
          title: string
          topic_uuid: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          curriculum_id?: string | null
          day?: Database["public"]["Enums"]["day_key"]
          id?: string
          lesson_id?: number | null
          notes?: string | null
          plan_id?: string
          section_id?: number | null
          title?: string
          topic_uuid?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_plan_tasks_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curricula"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_plan_tasks_lesson_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "curriculum_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_plan_tasks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "study_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_plan_tasks_section_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "curriculum_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_plan_tasks_topic_uuid_fkey"
            columns: ["topic_uuid"]
            isOneToOne: false
            referencedRelation: "curriculum_topics"
            referencedColumns: ["new_id"]
          },
        ]
      }
      study_plans: {
        Row: {
          completed_tasks: number
          completion_rate: number
          created_at: string
          id: string
          sprint_id: string | null
          total_tasks: number
          updated_at: string
          user_id: string
          week_start: string
        }
        Insert: {
          completed_tasks?: number
          completion_rate?: number
          created_at?: string
          id?: string
          sprint_id?: string | null
          total_tasks?: number
          updated_at?: string
          user_id: string
          week_start: string
        }
        Update: {
          completed_tasks?: number
          completion_rate?: number
          created_at?: string
          id?: string
          sprint_id?: string | null
          total_tasks?: number
          updated_at?: string
          user_id?: string
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_plans_sprint_id_fkey"
            columns: ["sprint_id"]
            isOneToOne: false
            referencedRelation: "sprints"
            referencedColumns: ["id"]
          },
        ]
      }
      study_sessions: {
        Row: {
          created_at: string
          curriculum_id: string | null
          date: string
          duration_minutes: number
          id: string
          lesson_id: number | null
          lesson_name: string | null
          note: string | null
          section_id: number | null
          section_name: string | null
          topic_title: string | null
          topic_uuid: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          curriculum_id?: string | null
          date: string
          duration_minutes: number
          id?: string
          lesson_id?: number | null
          lesson_name?: string | null
          note?: string | null
          section_id?: number | null
          section_name?: string | null
          topic_title?: string | null
          topic_uuid: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          curriculum_id?: string | null
          date?: string
          duration_minutes?: number
          id?: string
          lesson_id?: number | null
          lesson_name?: string | null
          note?: string | null
          section_id?: number | null
          section_name?: string | null
          topic_title?: string | null
          topic_uuid?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_curriculum_id_fkey"
            columns: ["curriculum_id"]
            isOneToOne: false
            referencedRelation: "curricula"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_sessions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "curriculum_lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_sessions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "curriculum_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_sessions_topic_uuid_fkey"
            columns: ["topic_uuid"]
            isOneToOne: false
            referencedRelation: "curriculum_topics"
            referencedColumns: ["new_id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_code: string
          earned_at: string
          level: Database["public"]["Enums"]["badge_level"]
          user_id: string
        }
        Insert: {
          badge_code: string
          earned_at?: string
          level: Database["public"]["Enums"]["badge_level"]
          user_id: string
        }
        Update: {
          badge_code?: string
          earned_at?: string
          level?: Database["public"]["Enums"]["badge_level"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_code_fkey"
            columns: ["badge_code"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["code"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fn_ai_belgesel_data: {
        Args: { p_user_id: string }
        Returns: {
          date: string
          total_minutes: number
        }[]
      }
      fn_ai_character_detect: { Args: { p_user_id: string }; Returns: string }
      fn_ai_daily_minutes: { Args: { p_user_id: string }; Returns: number }
      fn_ai_dependency_warnings: {
        Args: { p_user_id: string }
        Returns: {
          current_risky_topic: string
          weak_topic: string
        }[]
      }
      fn_ai_lesson_completion: {
        Args: { p_curriculum_id: string; p_user_id: string }
        Returns: {
          completed_topics: number
          lesson_name: string
          total_topics: number
        }[]
      }
      fn_ai_long_trend: {
        Args: { p_days?: number; p_user_id: string }
        Returns: {
          date: string
          total_minutes: number
        }[]
      }
      fn_ai_mastery_map: {
        Args: { p_user_id: string }
        Returns: {
          last_exam_net: number
          lesson_name: string
          mastery: number
          topic_title: string
          topic_uuid: string
          total_minutes: number
        }[]
      }
      fn_ai_plan_topics: {
        Args: { p_curriculum_id: string; p_user_id: string }
        Returns: {
          lesson_name: string
          topic_title: string
          topic_uuid: string
          total_minutes: number
        }[]
      }
      fn_ai_prediction_data: {
        Args: { p_user_id: string }
        Returns: {
          created_at: string
          net: number
        }[]
      }
      fn_ai_reward_check: { Args: { p_user_id: string }; Returns: Json }
      fn_ai_srs_candidates: {
        Args: { p_user_id: string }
        Returns: {
          days_ago: number
          topic_title: string
        }[]
      }
      fn_ai_study_habit_times: {
        Args: { p_user_id: string }
        Returns: {
          hour_of_day: number
          session_count: number
        }[]
      }
      fn_ai_study_trend: {
        Args: { p_days?: number; p_user_id: string }
        Returns: {
          day: string
          total_minutes: number
        }[]
      }
      fn_ai_study_verification: {
        Args: { p_user_id: string }
        Returns: {
          avg_net: number
          exam_count: number
          study_date: string
          topic_title: string
        }[]
      }
      fn_ai_time_quality: {
        Args: { p_user_id: string }
        Returns: {
          avg_net: number
          exam_count: number
          hour_of_day: number
        }[]
      }
      fn_ai_topic_completion: {
        Args: { p_user_id: string }
        Returns: {
          completed_at: string
          lesson_name: string
          topic_title: string
          topic_uuid: string
          total_minutes: number
        }[]
      }
      fn_ai_topic_exams: {
        Args: { p_user_id: string }
        Returns: {
          exam_date: string
          net: number
          question_count: number
          topic_title: string
          topic_uuid: string
        }[]
      }
      fn_ai_weak_topics: {
        Args: { p_limit?: number; p_user_id: string }
        Returns: {
          topic_title: string
          wrong_rate: number
        }[]
      }
      fn_ai_weekly_minutes: { Args: { p_user_id: string }; Returns: number }
      fn_get_lesson_progress: {
        Args: { p_user_id: string }
        Returns: {
          completed_topics: number
          lesson_name: string
          lesson_status: string
          total_topics: number
        }[]
      }
      fn_get_topic_progress: {
        Args: { p_user_id: string }
        Returns: {
          lesson_name: string
          topic_id: string
          topic_status: string
          topic_title: string
          total_minutes: number
        }[]
      }
      fn_user_last_7_days_avg: { Args: { p_user_id: string }; Returns: number }
      fn_user_lesson_progress: {
        Args: { p_curriculum_id: string; p_user_id: string }
        Returns: {
          completed_topics: number
          lesson_name: string
          note: string
          total_topics: number
        }[]
      }
      fn_user_overall_progress: {
        Args: { p_curriculum_id: string; p_user_id: string }
        Returns: {
          completed_topics: number
          progress_percent: number
          total_topics: number
        }[]
      }
      fn_user_prev_7_days_avg: { Args: { p_user_id: string }; Returns: number }
      fn_user_streak: { Args: { p_user_id: string }; Returns: Json }
      fn_user_study_trend: {
        Args: { uid: string }
        Returns: {
          date: string
          totalminutes: number
        }[]
      }
      fn_user_weak_topics: {
        Args: { p_user_id: string }
        Returns: {
          topic_title: string
          wrong_rate: number
        }[]
      }
      get_curriculum_topic_summary: {
        Args: { p_curriculum_id?: string; p_user_id: string }
        Returns: {
          completed_topics: number
          note: string
          total_topics: number
        }[]
      }
      get_sprint_content_stats: {
        Args: { sprint_uuid: string }
        Returns: {
          lesson_count: number
          section_count: number
          topic_count: number
        }[]
      }
      grant_badge_if_absent: {
        Args: {
          p_badge_code: string
          p_level: Database["public"]["Enums"]["badge_level"]
          p_user_id: string
        }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      is_premium: { Args: { uid: string }; Returns: boolean }
      is_premium_user: { Args: { uid: string }; Returns: boolean }
      test_job: { Args: never; Returns: undefined }
      unaccent: { Args: { "": string }; Returns: string }
      upsert_curriculum_json: {
        Args: { p_id: string; p_json: Json }
        Returns: undefined
      }
    }
    Enums: {
      ai_character_enum:
        | "fast_start_drop"
        | "slow_stable"
        | "low_study_high_net"
        | "hardworking_chaotic"
        | "focused_slow"
        | "social_distracted"
        | "unknown"
      ai_creativity_enum:
        | "normal"
        | "creative"
        | "very_creative"
        | "storytelling"
      ai_inspiration_enum: "soft" | "balanced" | "hardcore" | "humorous"
      ai_mode_enum:
        | "discipline_commando"
        | "soft_mentor"
        | "funny_comic"
        | "anime_senpai"
        | "professional_coach"
        | "elon_style"
        | "rick_and_morty"
        | "game_character"
      ai_reward_enum: "none" | "basic" | "gamified" | "legendary_cards"
      badge_level: "bronze" | "silver" | "gold" | "platinum"
      day_key:
        | "monday"
        | "tuesday"
        | "wednesday"
        | "thursday"
        | "friday"
        | "saturday"
        | "sunday"
      notification_type:
        | "welcome"
        | "badge_earned"
        | "weekly_ai_comment"
        | "system"
        | "direct_message"
      period_type: "weekly" | "monthly"
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
      ai_character_enum: [
        "fast_start_drop",
        "slow_stable",
        "low_study_high_net",
        "hardworking_chaotic",
        "focused_slow",
        "social_distracted",
        "unknown",
      ],
      ai_creativity_enum: [
        "normal",
        "creative",
        "very_creative",
        "storytelling",
      ],
      ai_inspiration_enum: ["soft", "balanced", "hardcore", "humorous"],
      ai_mode_enum: [
        "discipline_commando",
        "soft_mentor",
        "funny_comic",
        "anime_senpai",
        "professional_coach",
        "elon_style",
        "rick_and_morty",
        "game_character",
      ],
      ai_reward_enum: ["none", "basic", "gamified", "legendary_cards"],
      badge_level: ["bronze", "silver", "gold", "platinum"],
      day_key: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
      notification_type: [
        "welcome",
        "badge_earned",
        "weekly_ai_comment",
        "system",
        "direct_message",
      ],
      period_type: ["weekly", "monthly"],
    },
  },
} as const
