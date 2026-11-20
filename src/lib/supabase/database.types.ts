export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      crawl_run_sources: {
        Row: {
          crawl_run_id: string;
          discovered: number;
          error: string | null;
          failed_pages: number;
          finished_at: string | null;
          firecrawl_job_id: string | null;
          id: string;
          new_listings: number;
          processed: number;
          rent_changes: number;
          source_id: string;
          started_at: string | null;
          status: Database['public']['Enums']['crawl_state'];
          updated_listings: number;
        };
        Insert: {
          crawl_run_id: string;
          discovered?: number;
          error?: string | null;
          failed_pages?: number;
          finished_at?: string | null;
          firecrawl_job_id?: string | null;
          id?: string;
          new_listings?: number;
          processed?: number;
          rent_changes?: number;
          source_id: string;
          started_at?: string | null;
          status?: Database['public']['Enums']['crawl_state'];
          updated_listings?: number;
        };
        Update: {
          crawl_run_id?: string;
          discovered?: number;
          error?: string | null;
          failed_pages?: number;
          finished_at?: string | null;
          firecrawl_job_id?: string | null;
          id?: string;
          new_listings?: number;
          processed?: number;
          rent_changes?: number;
          source_id?: string;
          started_at?: string | null;
          status?: Database['public']['Enums']['crawl_state'];
          updated_listings?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'crawl_run_sources_crawl_run_id_fkey';
            columns: ['crawl_run_id'];
            isOneToOne: false;
            referencedRelation: 'crawl_runs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'crawl_run_sources_source_id_fkey';
            columns: ['source_id'];
            isOneToOne: false;
            referencedRelation: 'sources';
            referencedColumns: ['id'];
          },
        ];
      };
      crawl_runs: {
        Row: {
          created_at: string;
          finished_at: string | null;
          id: string;
          started_at: string | null;
          status: Database['public']['Enums']['crawl_state'];
        };
        Insert: {
          created_at?: string;
          finished_at?: string | null;
          id?: string;
          started_at?: string | null;
          status?: Database['public']['Enums']['crawl_state'];
        };
        Update: {
          created_at?: string;
          finished_at?: string | null;
          id?: string;
          started_at?: string | null;
          status?: Database['public']['Enums']['crawl_state'];
        };
        Relationships: [];
      };
      listing_observations: {
        Row: {
          crawl_run_source_id: string;
          created_at: string;
          evidence: string | null;
          fetched_at: string;
          id: string;
          listing_id: string | null;
          normalized: Json | null;
          page_url: string;
          raw_extraction: Json;
        };
        Insert: {
          crawl_run_source_id: string;
          created_at?: string;
          evidence?: string | null;
          fetched_at: string;
          id?: string;
          listing_id?: string | null;
          normalized?: Json | null;
          page_url: string;
          raw_extraction: Json;
        };
        Update: {
          crawl_run_source_id?: string;
          created_at?: string;
          evidence?: string | null;
          fetched_at?: string;
          id?: string;
          listing_id?: string | null;
          normalized?: Json | null;
          page_url?: string;
          raw_extraction?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'listing_observations_crawl_run_source_id_fkey';
            columns: ['crawl_run_source_id'];
            isOneToOne: false;
            referencedRelation: 'crawl_run_sources';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'listing_observations_listing_id_fkey';
            columns: ['listing_id'];
            isOneToOne: false;
            referencedRelation: 'listings';
            referencedColumns: ['id'];
          },
        ];
      };
      listings: {
        Row: {
          accessible: boolean | null;
          address: string;
          amenities: Json;
          available_from: string | null;
          beds: number | null;
          contact: Json | null;
          created_at: string;
          description: string | null;
          embedding: string | null;
          features: string[];
          id: string;
          is_active: boolean;
          is_demo: boolean;
          merge_key: string;
          normalized_address: string;
          normalized_unit: string | null;
          recurring_fees_monthly: number | null;
          refreshed_at: string;
          rent_basis: Database['public']['Enums']['rent_basis'];
          rent_max: number | null;
          rent_min: number | null;
          searchable_text: string;
          sources: Json;
          text_hash: string;
          unit: string | null;
          updated_at: string;
        };
        Insert: {
          accessible?: boolean | null;
          address: string;
          amenities?: Json;
          available_from?: string | null;
          beds?: number | null;
          contact?: Json | null;
          created_at?: string;
          description?: string | null;
          embedding?: string | null;
          features?: string[];
          id?: string;
          is_active?: boolean;
          is_demo?: boolean;
          merge_key: string;
          normalized_address: string;
          normalized_unit?: string | null;
          recurring_fees_monthly?: number | null;
          refreshed_at: string;
          rent_basis?: Database['public']['Enums']['rent_basis'];
          rent_max?: number | null;
          rent_min?: number | null;
          searchable_text: string;
          sources: Json;
          text_hash: string;
          unit?: string | null;
          updated_at?: string;
        };
        Update: {
          accessible?: boolean | null;
          address?: string;
          amenities?: Json;
          available_from?: string | null;
          beds?: number | null;
          contact?: Json | null;
          created_at?: string;
          description?: string | null;
          embedding?: string | null;
          features?: string[];
          id?: string;
          is_active?: boolean;
          is_demo?: boolean;
          merge_key?: string;
          normalized_address?: string;
          normalized_unit?: string | null;
          recurring_fees_monthly?: number | null;
          refreshed_at?: string;
          rent_basis?: Database['public']['Enums']['rent_basis'];
          rent_max?: number | null;
          rent_min?: number | null;
          searchable_text?: string;
          sources?: Json;
          text_hash?: string;
          unit?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      sources: {
        Row: {
          allowed_domains: string[];
          created_at: string;
          id: string;
          inventory_url: string;
          is_enabled: boolean;
          last_successful_refresh_at: string | null;
          listing_patterns: string[];
          provider: string;
        };
        Insert: {
          allowed_domains?: string[];
          created_at?: string;
          id?: string;
          inventory_url: string;
          is_enabled?: boolean;
          last_successful_refresh_at?: string | null;
          listing_patterns?: string[];
          provider: string;
        };
        Update: {
          allowed_domains?: string[];
          created_at?: string;
          id?: string;
          inventory_url?: string;
          is_enabled?: boolean;
          last_successful_refresh_at?: string | null;
          listing_patterns?: string[];
          provider?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_crawl_run: {
        Args: { p_source_ids: string[] };
        Returns: {
          crawl_run_id: string;
          crawl_run_source_id: string;
          source_id: string;
        }[];
      };
      increment_crawl_run_source_counts: {
        Args: {
          p_crawl_run_source_id: string;
          p_discovered?: number;
          p_failed_pages?: number;
          p_new_listings?: number;
          p_processed?: number;
          p_rent_changes?: number;
          p_updated_listings?: number;
        };
        Returns: undefined;
      };
      upsert_listing: {
        Args: { p_listing: Json; p_observation_id?: string };
        Returns: {
          listing_id: string;
          rent_changed: boolean;
          was_inserted: boolean;
        }[];
      };
    };
    Enums: {
      crawl_state: 'queued' | 'running' | 'succeeded' | 'partial' | 'failed';
      rent_basis: 'per_person' | 'per_unit' | 'unknown';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
