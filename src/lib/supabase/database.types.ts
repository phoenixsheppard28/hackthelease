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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      crawl_run_sources: {
        Row: {
          crawl_run_id: string
          discovered: number
          error: string | null
          failed_pages: number
          finished_at: string | null
          firecrawl_job_id: string | null
          id: string
          new_listings: number
          processed: number
          rent_changes: number
          source_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["crawl_state"]
          updated_listings: number
        }
        Insert: {
          crawl_run_id: string
          discovered?: number
          error?: string | null
          failed_pages?: number
          finished_at?: string | null
          firecrawl_job_id?: string | null
          id?: string
          new_listings?: number
          processed?: number
          rent_changes?: number
          source_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["crawl_state"]
          updated_listings?: number
        }
        Update: {
          crawl_run_id?: string
          discovered?: number
          error?: string | null
          failed_pages?: number
          finished_at?: string | null
          firecrawl_job_id?: string | null
          id?: string
          new_listings?: number
          processed?: number
          rent_changes?: number
          source_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["crawl_state"]
          updated_listings?: number
        }
        Relationships: [
          {
            foreignKeyName: "crawl_run_sources_crawl_run_id_fkey"
            columns: ["crawl_run_id"]
            isOneToOne: false
            referencedRelation: "crawl_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crawl_run_sources_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "sources"
            referencedColumns: ["id"]
          },
        ]
      }
      crawl_runs: {
        Row: {
          created_at: string
          finished_at: string | null
          id: string
          started_at: string | null
          status: Database["public"]["Enums"]["crawl_state"]
        }
        Insert: {
          created_at?: string
          finished_at?: string | null
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["crawl_state"]
        }
        Update: {
          created_at?: string
          finished_at?: string | null
          id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["crawl_state"]
        }
        Relationships: []
      }
      listing_observations: {
        Row: {
          crawl_run_source_id: string
          created_at: string
          evidence: string | null
          fetched_at: string
          id: string
          listing_id: string | null
          normalized: Json | null
          page_url: string
          raw_extraction: Json
        }
        Insert: {
          crawl_run_source_id: string
          created_at?: string
          evidence?: string | null
          fetched_at: string
          id?: string
          listing_id?: string | null
          normalized?: Json | null
          page_url: string
          raw_extraction: Json
        }
        Update: {
          crawl_run_source_id?: string
          created_at?: string
          evidence?: string | null
          fetched_at?: string
          id?: string
          listing_id?: string | null
          normalized?: Json | null
          page_url?: string
          raw_extraction?: Json
        }
        Relationships: [
          {
            foreignKeyName: "listing_observations_crawl_run_source_id_fkey"
            columns: ["crawl_run_source_id"]
            isOneToOne: false
            referencedRelation: "crawl_run_sources"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "listing_observations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          accessible: boolean | null
          address: string
          amenities: Json
          available_from: string | null
          beds: number | null
          contact: Json | null
          created_at: string
          description: string | null
          embedding: string | null
          features: string[]
          id: string
          is_active: boolean
          is_demo: boolean
          merge_key: string
          normalized_address: string
          normalized_unit: string | null
          recurring_fees_monthly: number | null
          refreshed_at: string
          rent_basis: Database["public"]["Enums"]["rent_basis"]
          rent_max: number | null
          rent_min: number | null
          searchable_text: string
          sources: Json
          text_hash: string
          unit: string | null
          updated_at: string
        }
        Insert: {
          accessible?: boolean | null
          address: string
          amenities?: Json
          available_from?: string | null
          beds?: number | null
          contact?: Json | null
          created_at?: string
          description?: string | null
          embedding?: string | null
          features?: string[]
          id?: string
          is_active?: boolean
          is_demo?: boolean
          merge_key: string
          normalized_address: string
          normalized_unit?: string | null
          recurring_fees_monthly?: number | null
          refreshed_at: string
          rent_basis?: Database["public"]["Enums"]["rent_basis"]
          rent_max?: number | null
          rent_min?: number | null
          searchable_text: string
          sources: Json
          text_hash: string
          unit?: string | null
          updated_at?: string
        }
        Update: {
          accessible?: boolean | null
          address?: string
          amenities?: Json
          available_from?: string | null
          beds?: number | null
          contact?: Json | null
          created_at?: string
          description?: string | null
          embedding?: string | null
          features?: string[]
          id?: string
          is_active?: boolean
          is_demo?: boolean
          merge_key?: string
          normalized_address?: string
          normalized_unit?: string | null
          recurring_fees_monthly?: number | null
          refreshed_at?: string
          rent_basis?: Database["public"]["Enums"]["rent_basis"]
          rent_max?: number | null
          rent_min?: number | null
          searchable_text?: string
          sources?: Json
          text_hash?: string
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sources: {
        Row: {
          allowed_domains: string[]
          created_at: string
          id: string
          inventory_url: string
          is_enabled: boolean
          last_successful_refresh_at: string | null
          listing_patterns: string[]
          provider: string
        }
        Insert: {
          allowed_domains?: string[]
          created_at?: string
          id?: string
          inventory_url: string
          is_enabled?: boolean
          last_successful_refresh_at?: string | null
          listing_patterns?: string[]
          provider: string
        }
        Update: {
          allowed_domains?: string[]
          created_at?: string
          id?: string
          inventory_url?: string
          is_enabled?: boolean
          last_successful_refresh_at?: string | null
          listing_patterns?: string[]
          provider?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_crawl_run: {
        Args: { p_source_ids: string[] }
        Returns: {
          crawl_run_id: string
          crawl_run_source_id: string
          source_id: string
        }[]
      }
      deactivate_stale_listings: {
        Args: { p_source_id: string }
        Returns: number
      }
      increment_crawl_run_source_counts: {
        Args: {
          p_crawl_run_source_id: string
          p_discovered?: number
          p_failed_pages?: number
          p_new_listings?: number
          p_processed?: number
          p_rent_changes?: number
          p_updated_listings?: number
        }
        Returns: undefined
      }
      record_observed_listing: {
        Args: {
          p_crawl_run_source_id: string
          p_listing: Json
          p_observation_id: string
        }
        Returns: {
          listing_id: string
          rent_changed: boolean
          was_inserted: boolean
        }[]
      }
      upsert_listing: {
        Args: { p_listing: Json; p_observation_id?: string }
        Returns: {
          listing_id: string
          rent_changed: boolean
          was_inserted: boolean
        }[]
      }
    }
    Enums: {
      crawl_state: "queued" | "running" | "succeeded" | "partial" | "failed"
      rent_basis: "per_person" | "per_unit" | "unknown"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      crawl_state: ["queued", "running", "succeeded", "partial", "failed"],
      rent_basis: ["per_person", "per_unit", "unknown"],
    },
  },
} as const
