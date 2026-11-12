// Generated from the Supabase project lestrace-dev (generate_typescript_types). Do not edit by hand.
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
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          at: string
          id: number
          new_data: Json | null
          old_data: Json | null
          organization_id: string
          row_id: string
          table_name: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          organization_id: string
          row_id: string
          table_name: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          at?: string
          id?: never
          new_data?: Json | null
          old_data?: Json | null
          organization_id?: string
          row_id?: string
          table_name?: string
        }
        Relationships: []
      }
      buyer_shares: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          include_documents: boolean
          show_suppliers: boolean
          last_viewed_at: string | null
          organization_id: string
          revoked_at: string | null
          shipment_ids: string[]
          token_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          include_documents?: boolean
          show_suppliers?: boolean
          last_viewed_at?: string | null
          organization_id: string
          revoked_at?: string | null
          shipment_ids: string[]
          token_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          include_documents?: boolean
          show_suppliers?: boolean
          last_viewed_at?: string | null
          organization_id?: string
          revoked_at?: string | null
          shipment_ids?: string[]
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyer_shares_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      country_risk: {
        Row: {
          country: string
          notes: string | null
          risk: Database["public"]["Enums"]["risk_level"]
          source_act: string
          valid_from: string | null
        }
        Insert: {
          country: string
          notes?: string | null
          risk: Database["public"]["Enums"]["risk_level"]
          source_act: string
          valid_from?: string | null
        }
        Update: {
          country?: string
          notes?: string | null
          risk?: Database["public"]["Enums"]["risk_level"]
          source_act?: string
          valid_from?: string | null
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          country: string
          created_at: string
          email: string | null
          eori: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          country: string
          created_at?: string
          email?: string | null
          eori?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          country?: string
          created_at?: string
          email?: string | null
          eori?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          created_at: string
          created_by: string | null
          file_path: string
          id: string
          mime: string
          organization_id: string
          size_bytes: number
          title: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at: string
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_path: string
          id?: string
          mime: string
          organization_id: string
          size_bytes: number
          title: string
          type: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_path?: string
          id?: string
          mime?: string
          organization_id?: string
          size_bytes?: number
          title?: string
          type?: Database["public"]["Enums"]["document_type"]
          updated_at?: string
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      hs_codes: {
        Row: {
          applies_from: string
          code: string
          description_en: string
          description_sl: string
          in_scope: boolean
          notes: string | null
        }
        Insert: {
          applies_from?: string
          code: string
          description_en: string
          description_sl: string
          in_scope?: boolean
          notes?: string | null
        }
        Update: {
          applies_from?: string
          code?: string
          description_en?: string
          description_sl?: string
          in_scope?: boolean
          notes?: string | null
        }
        Relationships: []
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          created_by: string | null
          email: string
          expires_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["member_role"]
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          expires_at: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["member_role"]
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          expires_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          organization_id: string
          role: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_links: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          partner_organization_id: string
          status: Database["public"]["Enums"]["link_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          partner_organization_id: string
          status?: Database["public"]["Enums"]["link_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          partner_organization_id?: string
          status?: Database["public"]["Enums"]["link_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_links_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_links_partner_organization_id_fkey"
            columns: ["partner_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          country: string
          created_at: string
          created_by: string | null
          eori: string | null
          id: string
          kind: Database["public"]["Enums"]["org_kind"]
          name: string
          registration_no: string | null
          size: Database["public"]["Enums"]["org_size"]
          tax_id: string | null
          updated_at: string
          was_under_eutr: boolean
        }
        Insert: {
          address?: string | null
          country: string
          created_at?: string
          created_by?: string | null
          eori?: string | null
          id?: string
          kind: Database["public"]["Enums"]["org_kind"]
          name: string
          registration_no?: string | null
          size: Database["public"]["Enums"]["org_size"]
          tax_id?: string | null
          updated_at?: string
          was_under_eutr?: boolean
        }
        Update: {
          address?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          eori?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["org_kind"]
          name?: string
          registration_no?: string | null
          size?: Database["public"]["Enums"]["org_size"]
          tax_id?: string | null
          updated_at?: string
          was_under_eutr?: boolean
        }
        Relationships: []
      }
      plot_documents: {
        Row: {
          created_at: string
          document_id: string
          organization_id: string
          plot_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          organization_id: string
          plot_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          organization_id?: string
          plot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plot_documents_organization_id_document_id_fkey"
            columns: ["organization_id", "document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "plot_documents_organization_id_plot_id_fkey"
            columns: ["organization_id", "plot_id"]
            isOneToOne: false
            referencedRelation: "plots"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      plot_imports: {
        Row: {
          created_at: string
          created_by: string | null
          detected_crs: string | null
          feature_count: number
          file_name: string
          file_path: string
          id: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          detected_crs?: string | null
          feature_count?: number
          file_name: string
          file_path: string
          id?: string
          organization_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          detected_crs?: string | null
          feature_count?: number
          file_name?: string
          file_path?: string
          id?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plot_imports_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      plots: {
        Row: {
          archived_at: string | null
          area_ha: number | null
          area_source: string | null
          cadastral_municipality: string | null
          cadastral_no: string | null
          harvest_from: string | null
          harvest_to: string | null
          country: string
          created_at: string
          created_by: string | null
          geom: unknown
          id: string
          label: string
          organization_id: string
          postal_address: string | null
          source_import_id: string | null
          supplier_id: string | null
          updated_at: string
          validation_issues: Json
          validation_status: Database["public"]["Enums"]["plot_status"]
        }
        Insert: {
          archived_at?: string | null
          area_ha?: number | null
          area_source?: string | null
          cadastral_municipality?: string | null
          cadastral_no?: string | null
          harvest_from?: string | null
          harvest_to?: string | null
          country: string
          created_at?: string
          created_by?: string | null
          geom?: unknown
          id?: string
          label: string
          organization_id: string
          postal_address?: string | null
          source_import_id?: string | null
          supplier_id?: string | null
          updated_at?: string
          validation_issues?: Json
          validation_status: Database["public"]["Enums"]["plot_status"]
        }
        Update: {
          archived_at?: string | null
          area_ha?: number | null
          area_source?: string | null
          cadastral_municipality?: string | null
          cadastral_no?: string | null
          harvest_from?: string | null
          harvest_to?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          geom?: unknown
          id?: string
          label?: string
          organization_id?: string
          postal_address?: string | null
          source_import_id?: string | null
          supplier_id?: string | null
          updated_at?: string
          validation_issues?: Json
          validation_status?: Database["public"]["Enums"]["plot_status"]
        }
        Relationships: [
          {
            foreignKeyName: "plots_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plots_organization_id_source_import_id_fkey"
            columns: ["organization_id", "source_import_id"]
            isOneToOne: false
            referencedRelation: "plot_imports"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "plots_organization_id_supplier_id_fkey"
            columns: ["organization_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      products: {
        Row: {
          created_at: string
          hs_code: string
          id: string
          name: string
          organization_id: string
          species_id: number | null
          trade_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          hs_code: string
          id?: string
          name: string
          organization_id: string
          species_id?: number | null
          trade_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          hs_code?: string
          id?: string
          name?: string
          organization_id?: string
          species_id?: number | null
          trade_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_hs_code_fkey"
            columns: ["hs_code"]
            isOneToOne: false
            referencedRelation: "hs_codes"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_species_id_fkey"
            columns: ["species_id"]
            isOneToOne: false
            referencedRelation: "species"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_documents: {
        Row: {
          created_at: string
          document_id: string
          organization_id: string
          shipment_id: string
        }
        Insert: {
          created_at?: string
          document_id: string
          organization_id: string
          shipment_id: string
        }
        Update: {
          created_at?: string
          document_id?: string
          organization_id?: string
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_documents_organization_id_document_id_fkey"
            columns: ["organization_id", "document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "shipment_documents_organization_id_shipment_id_fkey"
            columns: ["organization_id", "shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      shipment_items: {
        Row: {
          created_at: string
          id: string
          net_mass_kg: number | null
          organization_id: string
          pieces: number | null
          product_id: string
          shipment_id: string
          supplementary_units: number | null
          updated_at: string
          volume_m3: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          net_mass_kg?: number | null
          organization_id: string
          pieces?: number | null
          product_id: string
          shipment_id: string
          supplementary_units?: number | null
          updated_at?: string
          volume_m3?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          net_mass_kg?: number | null
          organization_id?: string
          pieces?: number | null
          product_id?: string
          shipment_id?: string
          supplementary_units?: number | null
          updated_at?: string
          volume_m3?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipment_items_organization_id_product_id_fkey"
            columns: ["organization_id", "product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "shipment_items_organization_id_shipment_id_fkey"
            columns: ["organization_id", "shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      shipment_plots: {
        Row: {
          created_at: string
          geom_snapshot: unknown
          organization_id: string
          plot_id: string
          shipment_id: string
        }
        Insert: {
          created_at?: string
          geom_snapshot?: unknown
          organization_id: string
          plot_id: string
          shipment_id: string
        }
        Update: {
          created_at?: string
          geom_snapshot?: unknown
          organization_id?: string
          plot_id?: string
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_plots_organization_id_plot_id_fkey"
            columns: ["organization_id", "plot_id"]
            isOneToOne: false
            referencedRelation: "plots"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "shipment_plots_organization_id_shipment_id_fkey"
            columns: ["organization_id", "shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
      shipments: {
        Row: {
          activity: Database["public"]["Enums"]["shipment_activity"]
          copied_from_id: string | null
          country_of_production: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          dds_reference_no: string | null
          dds_verification_no: string | null
          risk_assessed_at: string | null
          risk_assessment: string | null
          risk_mitigation: string | null
          risk_negligible: boolean | null
          id: string
          internal_ref: string
          mode: Database["public"]["Enums"]["shipment_mode"]
          organization_id: string
          shipment_date: string | null
          status: Database["public"]["Enums"]["shipment_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          activity: Database["public"]["Enums"]["shipment_activity"]
          copied_from_id?: string | null
          country_of_production?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          dds_reference_no?: string | null
          dds_verification_no?: string | null
          risk_assessed_at?: string | null
          risk_assessment?: string | null
          risk_mitigation?: string | null
          risk_negligible?: boolean | null
          id?: string
          internal_ref: string
          mode: Database["public"]["Enums"]["shipment_mode"]
          organization_id: string
          shipment_date?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          activity?: Database["public"]["Enums"]["shipment_activity"]
          copied_from_id?: string | null
          country_of_production?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          dds_reference_no?: string | null
          dds_verification_no?: string | null
          risk_assessed_at?: string | null
          risk_assessment?: string | null
          risk_mitigation?: string | null
          risk_negligible?: boolean | null
          id?: string
          internal_ref?: string
          mode?: Database["public"]["Enums"]["shipment_mode"]
          organization_id?: string
          shipment_date?: string | null
          status?: Database["public"]["Enums"]["shipment_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipments_organization_id_copied_from_id_fkey"
            columns: ["organization_id", "copied_from_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "shipments_organization_id_customer_id_fkey"
            columns: ["organization_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "shipments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      species: {
        Row: {
          common_name_bs: string
          common_name_en: string
          common_name_hr: string
          common_name_sl: string
          common_name_sr: string
          id: number
          scientific_name: string
        }
        Insert: {
          common_name_bs: string
          common_name_en: string
          common_name_hr: string
          common_name_sl: string
          common_name_sr: string
          id?: never
          scientific_name: string
        }
        Update: {
          common_name_bs?: string
          common_name_en?: string
          common_name_hr?: string
          common_name_sl?: string
          common_name_sr?: string
          id?: never
          scientific_name?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          country: string
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          kind: Database["public"]["Enums"]["supplier_kind"]
          linked_organization_id: string | null
          name: string
          organization_id: string
          simplified_declaration_id: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          country: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          kind: Database["public"]["Enums"]["supplier_kind"]
          linked_organization_id?: string | null
          name: string
          organization_id: string
          simplified_declaration_id?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["supplier_kind"]
          linked_organization_id?: string | null
          name?: string
          organization_id?: string
          simplified_declaration_id?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_linked_organization_id_fkey"
            columns: ["linked_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      upstream_references: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["upstream_ref_kind"]
          organization_id: string
          reference_no: string
          shipment_id: string
          supplier_id: string | null
          updated_at: string
          verification_no: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["upstream_ref_kind"]
          organization_id: string
          reference_no: string
          shipment_id: string
          supplier_id?: string | null
          updated_at?: string
          verification_no?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["upstream_ref_kind"]
          organization_id?: string
          reference_no?: string
          shipment_id?: string
          supplier_id?: string | null
          updated_at?: string
          verification_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "upstream_references_organization_id_shipment_id_fkey"
            columns: ["organization_id", "shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["organization_id", "id"]
          },
          {
            foreignKeyName: "upstream_references_organization_id_supplier_id_fkey"
            columns: ["organization_id", "supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["organization_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      buyer_package: { Args: { p_token: string }; Returns: Json }
      delete_my_account: { Args: { p_dry_run?: boolean }; Returns: Json }
      accept_invitation: { Args: { p_token: string }; Returns: string }
      invitation_info: { Args: { p_token: string }; Returns: Json }
      organization_members: {
        Args: { p_org: string }
        Returns: { user_id: string; email: string; role: Database['public']['Enums']['member_role']; joined_at: string }[]
      }
      plots_in_bbox: {
        Args: {
          p_exclude?: string
          p_maxx: number
          p_maxy: number
          p_minx: number
          p_miny: number
          p_org: string
        }
        Returns: {
          geom: Json
          id: string
        }[]
      }
      plots_map: { Args: { p_org: string }; Returns: Json }
      plots_near: {
        Args: { p_geoms: Json; p_org: string }
        Returns: {
          geom: Json
          id: string
        }[]
      }
    }
    Enums: {
      document_type:
        | "felling_permit"
        | "decision"
        | "delivery_note"
        | "certificate_fsc"
        | "certificate_pefc"
        | "other"
      link_status: "pending" | "active" | "revoked"
      member_role: "owner" | "member"
      org_kind: "operator" | "exporter" | "importer" | "trader"
      org_size: "micro" | "small" | "medium" | "large"
      plot_status: "valid" | "warning" | "error"
      risk_level: "low" | "standard" | "high"
      shipment_activity: "domestic" | "import" | "export"
      shipment_mode: "submit_dds" | "forward_references"
      shipment_status: "draft" | "ready" | "submitted" | "rejected"
      supplier_kind: "forest_owner" | "company"
      upstream_ref_kind: "dds" | "simplified_declaration"
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
      document_type: [
        "felling_permit",
        "decision",
        "delivery_note",
        "certificate_fsc",
        "certificate_pefc",
        "other",
      ],
      link_status: ["pending", "active", "revoked"],
      member_role: ["owner", "member"],
      org_kind: ["operator", "exporter", "importer", "trader"],
      org_size: ["micro", "small", "medium", "large"],
      plot_status: ["valid", "warning", "error"],
      risk_level: ["low", "standard", "high"],
      shipment_activity: ["domestic", "import", "export"],
      shipment_mode: ["submit_dds", "forward_references"],
      shipment_status: ["draft", "ready", "submitted", "rejected"],
      supplier_kind: ["forest_owner", "company"],
      upstream_ref_kind: ["dds", "simplified_declaration"],
    },
  },
} as const
