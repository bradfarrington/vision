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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activities: {
        Row: {
          company_id: string
          contract_id: string | null
          created_at: string
          customer_id: string | null
          description: string
          id: string
          job_id: string | null
          lead_id: string | null
          quote_id: string | null
          type: string
          user_id: string | null
        }
        Insert: {
          company_id: string
          contract_id?: string | null
          created_at?: string
          customer_id?: string | null
          description: string
          id?: string
          job_id?: string | null
          lead_id?: string | null
          quote_id?: string | null
          type: string
          user_id?: string | null
        }
        Update: {
          company_id?: string
          contract_id?: string | null
          created_at?: string
          customer_id?: string | null
          description?: string
          id?: string
          job_id?: string | null
          lead_id?: string | null
          quote_id?: string | null
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          assigned_to: string | null
          company_id: string
          created_at: string
          customer_id: string | null
          date: string
          duration: number | null
          id: string
          lead_id: string | null
          location: string | null
          notes: string | null
          status: string | null
          time: string | null
          title: string
          type: string | null
        }
        Insert: {
          assigned_to?: string | null
          company_id: string
          created_at?: string
          customer_id?: string | null
          date: string
          duration?: number | null
          id?: string
          lead_id?: string | null
          location?: string | null
          notes?: string | null
          status?: string | null
          time?: string | null
          title: string
          type?: string | null
        }
        Update: {
          assigned_to?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string | null
          date?: string
          duration?: number | null
          id?: string
          lead_id?: string | null
          location?: string | null
          notes?: string | null
          status?: string | null
          time?: string | null
          title?: string
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_channel_members: {
        Row: {
          channel_id: number
          id: number
          joined_at: string
          user_id: string
        }
        Insert: {
          channel_id: number
          id?: number
          joined_at?: string
          user_id: string
        }
        Update: {
          channel_id?: number
          id?: number
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_channel_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_channels: {
        Row: {
          company_id: string
          created_at: string
          id: number
          name: string
          type: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: number
          name: string
          type: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: number
          name?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_channels_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_message_reads: {
        Row: {
          id: number
          message_id: number
          read_at: string
          user_id: string
        }
        Insert: {
          id?: number
          message_id: number
          read_at?: string
          user_id: string
        }
        Update: {
          id?: number
          message_id?: number
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_message_reads_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_message_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          channel_id: number
          company_id: string
          content: string
          created_at: string
          id: number
          sender_id: string
        }
        Insert: {
          channel_id: number
          company_id: string
          content: string
          created_at?: string
          id?: number
          sender_id: string
        }
        Update: {
          channel_id?: number
          company_id?: string
          content?: string
          created_at?: string
          id?: number
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "chat_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          action_name: string
          assigned_by_id: string | null
          assigned_to_id: string | null
          company_id: string
          customer_email_body: string | null
          customer_email_subject: string | null
          customer_notify_on_complete: boolean | null
          customer_notify_sms: boolean | null
          customer_sms_template: string | null
          days_relative_to: string | null
          days_to_add: number | null
          due_date_mode: string | null
          id: number
          locked: boolean | null
          notification_email_body: string | null
          notification_email_subject: string | null
          notification_from_address_id: string | null
          notification_signature: string | null
          notification_template: string | null
          notify_on_complete: boolean | null
          notify_sms_on_complete: boolean | null
          notify_user_ids: string[] | null
          priority: string | null
          quote_type_id: number
          sms_template: string | null
          sort_order: number | null
        }
        Insert: {
          action_name: string
          assigned_by_id?: string | null
          assigned_to_id?: string | null
          company_id: string
          customer_email_body?: string | null
          customer_email_subject?: string | null
          customer_notify_on_complete?: boolean | null
          customer_notify_sms?: boolean | null
          customer_sms_template?: string | null
          days_relative_to?: string | null
          days_to_add?: number | null
          due_date_mode?: string | null
          id?: number
          locked?: boolean | null
          notification_email_body?: string | null
          notification_email_subject?: string | null
          notification_from_address_id?: string | null
          notification_signature?: string | null
          notification_template?: string | null
          notify_on_complete?: boolean | null
          notify_sms_on_complete?: boolean | null
          notify_user_ids?: string[] | null
          priority?: string | null
          quote_type_id: number
          sms_template?: string | null
          sort_order?: number | null
        }
        Update: {
          action_name?: string
          assigned_by_id?: string | null
          assigned_to_id?: string | null
          company_id?: string
          customer_email_body?: string | null
          customer_email_subject?: string | null
          customer_notify_on_complete?: boolean | null
          customer_notify_sms?: boolean | null
          customer_sms_template?: string | null
          days_relative_to?: string | null
          days_to_add?: number | null
          due_date_mode?: string | null
          id?: number
          locked?: boolean | null
          notification_email_body?: string | null
          notification_email_subject?: string | null
          notification_from_address_id?: string | null
          notification_signature?: string | null
          notification_template?: string | null
          notify_on_complete?: boolean | null
          notify_sms_on_complete?: boolean | null
          notify_user_ids?: string[] | null
          priority?: string | null
          quote_type_id?: number
          sms_template?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_assigned_by_id_fkey"
            columns: ["assigned_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_templates_assigned_to_id_fkey"
            columns: ["assigned_to_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_templates_quote_type_id_fkey"
            columns: ["quote_type_id"]
            isOneToOne: false
            referencedRelation: "quote_types"
            referencedColumns: ["id"]
          },
        ]
      }
      commissions: {
        Row: {
          comments: string | null
          commission_amount: number | null
          commission_percent: number | null
          commission_type: string | null
          company_id: string
          contract_id: string | null
          created_at: string
          date: string | null
          date_paid: string | null
          details: string | null
          hold_reason: string | null
          hourly_rate: number | null
          hours: number | null
          id: string
          lead_id: string | null
          paid: boolean | null
          paid_by: string | null
          staff_member_id: string | null
          staff_member_name: string | null
          total_cost: number | null
          travel_hours: number | null
        }
        Insert: {
          comments?: string | null
          commission_amount?: number | null
          commission_percent?: number | null
          commission_type?: string | null
          company_id: string
          contract_id?: string | null
          created_at?: string
          date?: string | null
          date_paid?: string | null
          details?: string | null
          hold_reason?: string | null
          hourly_rate?: number | null
          hours?: number | null
          id?: string
          lead_id?: string | null
          paid?: boolean | null
          paid_by?: string | null
          staff_member_id?: string | null
          staff_member_name?: string | null
          total_cost?: number | null
          travel_hours?: number | null
        }
        Update: {
          comments?: string | null
          commission_amount?: number | null
          commission_percent?: number | null
          commission_type?: string | null
          company_id?: string
          contract_id?: string | null
          created_at?: string
          date?: string | null
          date_paid?: string | null
          details?: string | null
          hold_reason?: string | null
          hourly_rate?: number | null
          hours?: number | null
          id?: string
          lead_id?: string | null
          paid?: boolean | null
          paid_by?: string | null
          staff_member_id?: string | null
          staff_member_name?: string | null
          total_cost?: number | null
          travel_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "commissions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commissions_staff_member_id_fkey"
            columns: ["staff_member_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          active: boolean
          brand_color_1: string | null
          brand_color_2: string | null
          created_at: string
          id: string
          logo_url: string | null
          name: string
          plan: string
          seat_limit: number
          slug: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string
          trial_ends_at: string | null
        }
        Insert: {
          active?: boolean
          brand_color_1?: string | null
          brand_color_2?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name: string
          plan?: string
          seat_limit?: number
          slug: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          trial_ends_at?: string | null
        }
        Update: {
          active?: boolean
          brand_color_1?: string | null
          brand_color_2?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          name?: string
          plan?: string
          seat_limit?: number
          slug?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string
          trial_ends_at?: string | null
        }
        Relationships: []
      }
      company_settings: {
        Row: {
          address: string | null
          brand_color_1: string | null
          brand_color_2: string | null
          business_short_name: string | null
          checklist_enabled: boolean | null
          company_id: string
          company_name: string | null
          contact_1_name: string | null
          contact_1_title: string | null
          contact_2_name: string | null
          contact_2_title: string | null
          customer_id: string | null
          default_quote_type_id: number | null
          email: string | null
          fax: string | null
          id: string
          logo_1_path: string | null
          logo_2_path: string | null
          logo_3_path: string | null
          sms_enabled: boolean | null
          sms_sender_name: string | null
          telephone: string | null
          tt_api_key: string | null
          tt_auto_push: boolean | null
          tt_enabled: boolean | null
          tt_user_id: string | null
          twilio_phone_number: string | null
          vat_number: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          brand_color_1?: string | null
          brand_color_2?: string | null
          business_short_name?: string | null
          checklist_enabled?: boolean | null
          company_id: string
          company_name?: string | null
          contact_1_name?: string | null
          contact_1_title?: string | null
          contact_2_name?: string | null
          contact_2_title?: string | null
          customer_id?: string | null
          default_quote_type_id?: number | null
          email?: string | null
          fax?: string | null
          id?: string
          logo_1_path?: string | null
          logo_2_path?: string | null
          logo_3_path?: string | null
          sms_enabled?: boolean | null
          sms_sender_name?: string | null
          telephone?: string | null
          tt_api_key?: string | null
          tt_auto_push?: boolean | null
          tt_enabled?: boolean | null
          tt_user_id?: string | null
          twilio_phone_number?: string | null
          vat_number?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          brand_color_1?: string | null
          brand_color_2?: string | null
          business_short_name?: string | null
          checklist_enabled?: boolean | null
          company_id?: string
          company_name?: string | null
          contact_1_name?: string | null
          contact_1_title?: string | null
          contact_2_name?: string | null
          contact_2_title?: string | null
          customer_id?: string | null
          default_quote_type_id?: number | null
          email?: string | null
          fax?: string | null
          id?: string
          logo_1_path?: string | null
          logo_2_path?: string | null
          logo_3_path?: string | null
          sms_enabled?: boolean | null
          sms_sender_name?: string | null
          telephone?: string | null
          tt_api_key?: string | null
          tt_auto_push?: boolean | null
          tt_enabled?: boolean | null
          tt_user_id?: string | null
          twilio_phone_number?: string | null
          vat_number?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_checklist_items: {
        Row: {
          action_name: string
          assigned_by_id: string | null
          assigned_to_id: string | null
          comment: string | null
          company_id: string
          completed_at: string | null
          completed_by_id: string | null
          completed_by_name: string | null
          contract_id: string
          created_at: string
          due_date: string | null
          id: number
          locked: boolean | null
          notification_template: string | null
          notify_on_complete: boolean | null
          priority: string | null
          sort_order: number | null
          status: string | null
          template_id: number | null
        }
        Insert: {
          action_name: string
          assigned_by_id?: string | null
          assigned_to_id?: string | null
          comment?: string | null
          company_id: string
          completed_at?: string | null
          completed_by_id?: string | null
          completed_by_name?: string | null
          contract_id: string
          created_at?: string
          due_date?: string | null
          id?: number
          locked?: boolean | null
          notification_template?: string | null
          notify_on_complete?: boolean | null
          priority?: string | null
          sort_order?: number | null
          status?: string | null
          template_id?: number | null
        }
        Update: {
          action_name?: string
          assigned_by_id?: string | null
          assigned_to_id?: string | null
          comment?: string | null
          company_id?: string
          completed_at?: string | null
          completed_by_id?: string | null
          completed_by_name?: string | null
          contract_id?: string
          created_at?: string
          due_date?: string | null
          id?: number
          locked?: boolean | null
          notification_template?: string | null
          notify_on_complete?: boolean | null
          priority?: string | null
          sort_order?: number | null
          status?: string | null
          template_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_checklist_items_assigned_by_id_fkey"
            columns: ["assigned_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_checklist_items_assigned_to_id_fkey"
            columns: ["assigned_to_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_checklist_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_checklist_items_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_checklist_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "contract_checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_checklist_templates: {
        Row: {
          action_name: string
          assigned_by_id: string | null
          assigned_to_id: string | null
          company_id: string
          contract_type_id: number
          customer_email_body: string | null
          customer_email_subject: string | null
          customer_notify_on_complete: boolean | null
          customer_notify_sms: boolean | null
          customer_sms_template: string | null
          days_relative_to: string | null
          days_to_add: number | null
          due_date_mode: string | null
          id: number
          locked: boolean | null
          notification_email_body: string | null
          notification_email_subject: string | null
          notification_from_address_id: string | null
          notification_signature: string | null
          notification_template: string | null
          notify_on_complete: boolean | null
          notify_sms_on_complete: boolean | null
          notify_user_ids: string[] | null
          priority: string | null
          sms_template: string | null
          sort_order: number | null
        }
        Insert: {
          action_name: string
          assigned_by_id?: string | null
          assigned_to_id?: string | null
          company_id: string
          contract_type_id: number
          customer_email_body?: string | null
          customer_email_subject?: string | null
          customer_notify_on_complete?: boolean | null
          customer_notify_sms?: boolean | null
          customer_sms_template?: string | null
          days_relative_to?: string | null
          days_to_add?: number | null
          due_date_mode?: string | null
          id?: number
          locked?: boolean | null
          notification_email_body?: string | null
          notification_email_subject?: string | null
          notification_from_address_id?: string | null
          notification_signature?: string | null
          notification_template?: string | null
          notify_on_complete?: boolean | null
          notify_sms_on_complete?: boolean | null
          notify_user_ids?: string[] | null
          priority?: string | null
          sms_template?: string | null
          sort_order?: number | null
        }
        Update: {
          action_name?: string
          assigned_by_id?: string | null
          assigned_to_id?: string | null
          company_id?: string
          contract_type_id?: number
          customer_email_body?: string | null
          customer_email_subject?: string | null
          customer_notify_on_complete?: boolean | null
          customer_notify_sms?: boolean | null
          customer_sms_template?: string | null
          days_relative_to?: string | null
          days_to_add?: number | null
          due_date_mode?: string | null
          id?: number
          locked?: boolean | null
          notification_email_body?: string | null
          notification_email_subject?: string | null
          notification_from_address_id?: string | null
          notification_signature?: string | null
          notification_template?: string | null
          notify_on_complete?: boolean | null
          notify_sms_on_complete?: boolean | null
          notify_user_ids?: string[] | null
          priority?: string | null
          sms_template?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_checklist_templates_assigned_by_id_fkey"
            columns: ["assigned_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_checklist_templates_assigned_to_id_fkey"
            columns: ["assigned_to_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_checklist_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_checklist_templates_contract_type_id_fkey"
            columns: ["contract_type_id"]
            isOneToOne: false
            referencedRelation: "contract_types"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_notes: {
        Row: {
          company_id: string
          content: string
          contract_id: string | null
          created_at: string
          created_by: string | null
          id: string
          lead_id: string | null
        }
        Insert: {
          company_id: string
          content: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string | null
        }
        Update: {
          company_id?: string
          content?: string
          contract_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lead_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_notes_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_products: {
        Row: {
          company_id: string
          contract_id: string | null
          created_at: string
          description: string | null
          id: string
          lead_id: string | null
          product_name: string
          quantity: number | null
          total_price: number | null
          unit_price: number | null
        }
        Insert: {
          company_id: string
          contract_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string | null
          product_name: string
          quantity?: number | null
          total_price?: number | null
          unit_price?: number | null
        }
        Update: {
          company_id?: string
          contract_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string | null
          product_name?: string
          quantity?: number | null
          total_price?: number | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_products_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contract_products_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_types: {
        Row: {
          company_id: string
          created_at: string
          description: string | null
          id: number
          is_active: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          description?: string | null
          id?: number
          is_active?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          description?: string | null
          id?: number
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          balance_reason: string | null
          cancel_date: string | null
          cancel_reason: string | null
          company_id: string
          contract_cancelled: boolean | null
          contract_date: string | null
          contract_number: number | null
          contract_type: string | null
          contract_type_id: number | null
          created_at: string
          customer_id: string | null
          delivery_method: string | null
          estimated_fitting_days: number | null
          fitting_county: string | null
          fitting_directions: string | null
          fitting_house_name: string | null
          fitting_house_number: string | null
          fitting_locality: string | null
          fitting_postcode: string | null
          fitting_same_as_customer: boolean | null
          fitting_street: string | null
          fitting_town: string | null
          fitting_what_3_words: string | null
          gross_value: number | null
          guarantee_date: string | null
          guarantee_number: string | null
          hold_date_off: string | null
          hold_date_on: string | null
          hold_reason: string | null
          id: string
          installation_completed: string | null
          installation_manager: string | null
          insurance_backed_guarantee_ref: string | null
          invoice_county: string | null
          invoice_house_name: string | null
          invoice_house_number: string | null
          invoice_locality: string | null
          invoice_name: string | null
          invoice_postcode: string | null
          invoice_same_as_customer: boolean | null
          invoice_street: string | null
          invoice_town: string | null
          lead_id: string
          notes: string | null
          office_reference: string | null
          office_reference_2: string | null
          old_balance_reason: string | null
          on_hold: boolean | null
          sales_area: string | null
          sales_director: string | null
          salesman: string | null
          send_letters_to_fitting: boolean | null
          signboard_date: string | null
          signboard_left: boolean | null
          source: string | null
          status: string | null
          supply_only: boolean | null
        }
        Insert: {
          balance_reason?: string | null
          cancel_date?: string | null
          cancel_reason?: string | null
          company_id: string
          contract_cancelled?: boolean | null
          contract_date?: string | null
          contract_number?: number | null
          contract_type?: string | null
          contract_type_id?: number | null
          created_at?: string
          customer_id?: string | null
          delivery_method?: string | null
          estimated_fitting_days?: number | null
          fitting_county?: string | null
          fitting_directions?: string | null
          fitting_house_name?: string | null
          fitting_house_number?: string | null
          fitting_locality?: string | null
          fitting_postcode?: string | null
          fitting_same_as_customer?: boolean | null
          fitting_street?: string | null
          fitting_town?: string | null
          fitting_what_3_words?: string | null
          gross_value?: number | null
          guarantee_date?: string | null
          guarantee_number?: string | null
          hold_date_off?: string | null
          hold_date_on?: string | null
          hold_reason?: string | null
          id?: string
          installation_completed?: string | null
          installation_manager?: string | null
          insurance_backed_guarantee_ref?: string | null
          invoice_county?: string | null
          invoice_house_name?: string | null
          invoice_house_number?: string | null
          invoice_locality?: string | null
          invoice_name?: string | null
          invoice_postcode?: string | null
          invoice_same_as_customer?: boolean | null
          invoice_street?: string | null
          invoice_town?: string | null
          lead_id: string
          notes?: string | null
          office_reference?: string | null
          office_reference_2?: string | null
          old_balance_reason?: string | null
          on_hold?: boolean | null
          sales_area?: string | null
          sales_director?: string | null
          salesman?: string | null
          send_letters_to_fitting?: boolean | null
          signboard_date?: string | null
          signboard_left?: boolean | null
          source?: string | null
          status?: string | null
          supply_only?: boolean | null
        }
        Update: {
          balance_reason?: string | null
          cancel_date?: string | null
          cancel_reason?: string | null
          company_id?: string
          contract_cancelled?: boolean | null
          contract_date?: string | null
          contract_number?: number | null
          contract_type?: string | null
          contract_type_id?: number | null
          created_at?: string
          customer_id?: string | null
          delivery_method?: string | null
          estimated_fitting_days?: number | null
          fitting_county?: string | null
          fitting_directions?: string | null
          fitting_house_name?: string | null
          fitting_house_number?: string | null
          fitting_locality?: string | null
          fitting_postcode?: string | null
          fitting_same_as_customer?: boolean | null
          fitting_street?: string | null
          fitting_town?: string | null
          fitting_what_3_words?: string | null
          gross_value?: number | null
          guarantee_date?: string | null
          guarantee_number?: string | null
          hold_date_off?: string | null
          hold_date_on?: string | null
          hold_reason?: string | null
          id?: string
          installation_completed?: string | null
          installation_manager?: string | null
          insurance_backed_guarantee_ref?: string | null
          invoice_county?: string | null
          invoice_house_name?: string | null
          invoice_house_number?: string | null
          invoice_locality?: string | null
          invoice_name?: string | null
          invoice_postcode?: string | null
          invoice_same_as_customer?: boolean | null
          invoice_street?: string | null
          invoice_town?: string | null
          lead_id?: string
          notes?: string | null
          office_reference?: string | null
          office_reference_2?: string | null
          old_balance_reason?: string | null
          on_hold?: boolean | null
          sales_area?: string | null
          sales_director?: string | null
          salesman?: string | null
          send_letters_to_fitting?: boolean | null
          signboard_date?: string | null
          signboard_left?: boolean | null
          source?: string | null
          status?: string | null
          supply_only?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "contracts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_definitions: {
        Row: {
          company_id: string
          created_at: string
          data_type: string
          entity: string
          id: number
          is_active: boolean | null
          options: string[] | null
          question: string
          required: boolean | null
          sort_order: number | null
        }
        Insert: {
          company_id: string
          created_at?: string
          data_type?: string
          entity?: string
          id?: number
          is_active?: boolean | null
          options?: string[] | null
          question: string
          required?: boolean | null
          sort_order?: number | null
        }
        Update: {
          company_id?: string
          created_at?: string
          data_type?: string
          entity?: string
          id?: number
          is_active?: boolean | null
          options?: string[] | null
          question?: string
          required?: boolean | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_definitions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_values: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string | null
          definition_id: number
          id: string
          initials: string | null
          lead_id: string | null
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id?: string | null
          definition_id: number
          id?: string
          initials?: string | null
          lead_id?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string | null
          definition_id?: number
          id?: string
          initials?: string | null
          lead_id?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_values_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_field_values_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_field_values_definition_id_fkey"
            columns: ["definition_id"]
            isOneToOne: false
            referencedRelation: "custom_field_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_field_values_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_field_values_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_account_references: {
        Row: {
          acc_name: string | null
          company_id: string
          created_at: string
          customer_id: string
          id: string
          reference: string | null
        }
        Insert: {
          acc_name?: string | null
          company_id: string
          created_at?: string
          customer_id: string
          id?: string
          reference?: string | null
        }
        Update: {
          acc_name?: string | null
          company_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_account_references_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_account_references_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contacts: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string
          email: string | null
          id: string
          is_default: boolean | null
          name: string
          no_whatsapp: boolean | null
          phone: string | null
          position_role: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id: string
          email?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          no_whatsapp?: boolean | null
          phone?: string | null
          position_role?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string
          email?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          no_whatsapp?: boolean | null
          phone?: string | null
          position_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contacts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          account_created_in_package: boolean | null
          address: string | null
          bad_payer: boolean | null
          business_address: boolean | null
          calculate_vat_on_reduced: boolean | null
          cis_reg: string | null
          city: string | null
          company_id: string
          company_name: string | null
          county: string | null
          created_at: string
          created_by: string | null
          customer_moved_away: boolean | null
          customer_number: number | null
          customer_type: string | null
          default_account_reference: string | null
          directions: string | null
          do_not_contact: boolean | null
          email: string | null
          email_opt_in: boolean | null
          fax_alt_no: string | null
          first_name: string
          first_name_2: string | null
          flash_note: string | null
          home_telephone: string | null
          house_name: string | null
          house_number: string | null
          id: string
          invoice_address_1: string | null
          invoice_address_2: string | null
          invoice_address_3: string | null
          invoice_address_4: string | null
          invoice_name: string | null
          invoice_postcode: string | null
          invoice_tel: string | null
          last_name: string
          last_name_2: string | null
          letter_opt_in: boolean | null
          locality: string | null
          marketing_code: string | null
          marketing_notes: string | null
          mobile: string | null
          mobile_2: string | null
          no_email_marketing: boolean | null
          no_postal_marketing: boolean | null
          no_sms_marketing: boolean | null
          no_telephone_marketing: boolean | null
          no_whatsapp: boolean | null
          notes: string | null
          office_ref_1: string | null
          office_ref_2: string | null
          opt_in_date: string | null
          opt_in_document: string | null
          opted_in_by: string | null
          payment_terms: string | null
          phone: string | null
          phone_opt_in: boolean | null
          postcode: string | null
          property_type: string | null
          sales_manager: string | null
          salutation: string | null
          settlement_disc_pct: number | null
          settlement_disc_terms: string | null
          sms_opt_in: boolean | null
          state: string | null
          street: string | null
          title: string | null
          title_2: string | null
          town: string | null
          tt_customer_id: string | null
          vat_no: string | null
          what_3_words: string | null
          work_telephone: string | null
          zip_code: string | null
        }
        Insert: {
          account_created_in_package?: boolean | null
          address?: string | null
          bad_payer?: boolean | null
          business_address?: boolean | null
          calculate_vat_on_reduced?: boolean | null
          cis_reg?: string | null
          city?: string | null
          company_id: string
          company_name?: string | null
          county?: string | null
          created_at?: string
          created_by?: string | null
          customer_moved_away?: boolean | null
          customer_number?: number | null
          customer_type?: string | null
          default_account_reference?: string | null
          directions?: string | null
          do_not_contact?: boolean | null
          email?: string | null
          email_opt_in?: boolean | null
          fax_alt_no?: string | null
          first_name: string
          first_name_2?: string | null
          flash_note?: string | null
          home_telephone?: string | null
          house_name?: string | null
          house_number?: string | null
          id?: string
          invoice_address_1?: string | null
          invoice_address_2?: string | null
          invoice_address_3?: string | null
          invoice_address_4?: string | null
          invoice_name?: string | null
          invoice_postcode?: string | null
          invoice_tel?: string | null
          last_name: string
          last_name_2?: string | null
          letter_opt_in?: boolean | null
          locality?: string | null
          marketing_code?: string | null
          marketing_notes?: string | null
          mobile?: string | null
          mobile_2?: string | null
          no_email_marketing?: boolean | null
          no_postal_marketing?: boolean | null
          no_sms_marketing?: boolean | null
          no_telephone_marketing?: boolean | null
          no_whatsapp?: boolean | null
          notes?: string | null
          office_ref_1?: string | null
          office_ref_2?: string | null
          opt_in_date?: string | null
          opt_in_document?: string | null
          opted_in_by?: string | null
          payment_terms?: string | null
          phone?: string | null
          phone_opt_in?: boolean | null
          postcode?: string | null
          property_type?: string | null
          sales_manager?: string | null
          salutation?: string | null
          settlement_disc_pct?: number | null
          settlement_disc_terms?: string | null
          sms_opt_in?: boolean | null
          state?: string | null
          street?: string | null
          title?: string | null
          title_2?: string | null
          town?: string | null
          tt_customer_id?: string | null
          vat_no?: string | null
          what_3_words?: string | null
          work_telephone?: string | null
          zip_code?: string | null
        }
        Update: {
          account_created_in_package?: boolean | null
          address?: string | null
          bad_payer?: boolean | null
          business_address?: boolean | null
          calculate_vat_on_reduced?: boolean | null
          cis_reg?: string | null
          city?: string | null
          company_id?: string
          company_name?: string | null
          county?: string | null
          created_at?: string
          created_by?: string | null
          customer_moved_away?: boolean | null
          customer_number?: number | null
          customer_type?: string | null
          default_account_reference?: string | null
          directions?: string | null
          do_not_contact?: boolean | null
          email?: string | null
          email_opt_in?: boolean | null
          fax_alt_no?: string | null
          first_name?: string
          first_name_2?: string | null
          flash_note?: string | null
          home_telephone?: string | null
          house_name?: string | null
          house_number?: string | null
          id?: string
          invoice_address_1?: string | null
          invoice_address_2?: string | null
          invoice_address_3?: string | null
          invoice_address_4?: string | null
          invoice_name?: string | null
          invoice_postcode?: string | null
          invoice_tel?: string | null
          last_name?: string
          last_name_2?: string | null
          letter_opt_in?: boolean | null
          locality?: string | null
          marketing_code?: string | null
          marketing_notes?: string | null
          mobile?: string | null
          mobile_2?: string | null
          no_email_marketing?: boolean | null
          no_postal_marketing?: boolean | null
          no_sms_marketing?: boolean | null
          no_telephone_marketing?: boolean | null
          no_whatsapp?: boolean | null
          notes?: string | null
          office_ref_1?: string | null
          office_ref_2?: string | null
          opt_in_date?: string | null
          opt_in_document?: string | null
          opted_in_by?: string | null
          payment_terms?: string | null
          phone?: string | null
          phone_opt_in?: boolean | null
          postcode?: string | null
          property_type?: string | null
          sales_manager?: string | null
          salutation?: string | null
          settlement_disc_pct?: number | null
          settlement_disc_terms?: string | null
          sms_opt_in?: boolean | null
          state?: string | null
          street?: string | null
          title?: string | null
          title_2?: string | null
          town?: string | null
          tt_customer_id?: string | null
          vat_no?: string | null
          what_3_words?: string | null
          work_telephone?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_lines: {
        Row: {
          comments: string | null
          company_id: string
          contract_id: string | null
          created_at: string
          date_ordered: string | null
          date_received: string | null
          delivery_due_date: string | null
          id: string
          item_name: string
          lead_id: string | null
          net_value: number | null
          ordered_by_initials: string | null
          quantity_ordered: number | null
          quantity_received: number | null
          supplier_name: string | null
        }
        Insert: {
          comments?: string | null
          company_id: string
          contract_id?: string | null
          created_at?: string
          date_ordered?: string | null
          date_received?: string | null
          delivery_due_date?: string | null
          id?: string
          item_name: string
          lead_id?: string | null
          net_value?: number | null
          ordered_by_initials?: string | null
          quantity_ordered?: number | null
          quantity_received?: number | null
          supplier_name?: string | null
        }
        Update: {
          comments?: string | null
          company_id?: string
          contract_id?: string | null
          created_at?: string
          date_ordered?: string | null
          date_received?: string | null
          delivery_due_date?: string | null
          id?: string
          item_name?: string
          lead_id?: string | null
          net_value?: number | null
          ordered_by_initials?: string | null
          quantity_ordered?: number | null
          quantity_received?: number | null
          supplier_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_lines_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_lines_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          category: string | null
          company_id: string
          context: string | null
          contract_id: string | null
          created_at: string
          customer_id: string | null
          file_name: string
          file_size: number | null
          file_type: string | null
          file_url: string
          id: string
          lead_id: string | null
          name: string
          uploaded_by: string | null
        }
        Insert: {
          category?: string | null
          company_id: string
          context?: string | null
          contract_id?: string | null
          created_at?: string
          customer_id?: string | null
          file_name: string
          file_size?: number | null
          file_type?: string | null
          file_url: string
          id?: string
          lead_id?: string | null
          name: string
          uploaded_by?: string | null
        }
        Update: {
          category?: string | null
          company_id?: string
          context?: string | null
          contract_id?: string | null
          created_at?: string
          customer_id?: string | null
          file_name?: string
          file_size?: number | null
          file_type?: string | null
          file_url?: string
          id?: string
          lead_id?: string | null
          name?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      email_campaigns: {
        Row: {
          company_id: string
          created_at: string
          from_address_id: string | null
          id: string
          name: string
          recipient_count: number | null
          sent_at: string | null
          sent_count: number | null
          status: string
          subject: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          from_address_id?: string | null
          id?: string
          name: string
          recipient_count?: number | null
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          subject: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          from_address_id?: string | null
          id?: string
          name?: string
          recipient_count?: number | null
          sent_at?: string | null
          sent_count?: number | null
          status?: string
          subject?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_from_address_id_fkey"
            columns: ["from_address_id"]
            isOneToOne: false
            referencedRelation: "email_sender_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_domains: {
        Row: {
          company_id: string
          created_at: string
          dns_records: Json | null
          domain: string
          id: string
          sendgrid_domain_id: string | null
          status: string
        }
        Insert: {
          company_id: string
          created_at?: string
          dns_records?: Json | null
          domain: string
          id?: string
          sendgrid_domain_id?: string | null
          status?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          dns_records?: Json | null
          domain?: string
          id?: string
          sendgrid_domain_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_domains_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      email_sender_addresses: {
        Row: {
          company_id: string
          created_at: string
          domain_id: string | null
          email: string
          id: string
          is_default: boolean | null
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string
          domain_id?: string | null
          email: string
          id?: string
          is_default?: boolean | null
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          domain_id?: string | null
          email?: string
          id?: string
          is_default?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_sender_addresses_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_sender_addresses_domain_id_fkey"
            columns: ["domain_id"]
            isOneToOne: false
            referencedRelation: "email_domains"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          blocks: Json
          category: string | null
          company_id: string
          created_at: string
          global_styles: Json
          id: string
          is_industry_template: boolean | null
          name: string
          subject: string | null
          thumbnail_url: string | null
          updated_at: string
        }
        Insert: {
          blocks?: Json
          category?: string | null
          company_id: string
          created_at?: string
          global_styles?: Json
          id?: string
          is_industry_template?: boolean | null
          name: string
          subject?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Update: {
          blocks?: Json
          category?: string | null
          company_id?: string
          created_at?: string
          global_styles?: Json
          id?: string
          is_industry_template?: boolean | null
          name?: string
          subject?: string | null
          thumbnail_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_lines: {
        Row: {
          charge_amount: number | null
          company_id: string
          contract_id: string | null
          created_at: string
          id: string
          invoice_details: string | null
          invoice_number: string | null
          lead_id: string | null
          line_type: string
          notes: string | null
          payment_amount: number | null
          payment_date: string | null
          payment_method: string | null
        }
        Insert: {
          charge_amount?: number | null
          company_id: string
          contract_id?: string | null
          created_at?: string
          id?: string
          invoice_details?: string | null
          invoice_number?: string | null
          lead_id?: string | null
          line_type: string
          notes?: string | null
          payment_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
        }
        Update: {
          charge_amount?: number | null
          company_id?: string
          contract_id?: string | null
          created_at?: string
          id?: string
          invoice_details?: string | null
          invoice_number?: string | null
          lead_id?: string | null
          line_type?: string
          notes?: string | null
          payment_amount?: number | null
          payment_date?: string | null
          payment_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_lines_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_lines_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_lines_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_payments: {
        Row: {
          amount: number
          company_id: string
          created_at: string
          finance_line_id: string | null
          id: string
          payment_date: string | null
          payment_method: string | null
          reference: string | null
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string
          finance_line_id?: string | null
          id?: string
          payment_date?: string | null
          payment_method?: string | null
          reference?: string | null
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string
          finance_line_id?: string | null
          id?: string
          payment_date?: string | null
          payment_method?: string | null
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payments_finance_line_id_fkey"
            columns: ["finance_line_id"]
            isOneToOne: false
            referencedRelation: "finance_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      fitting_appointments: {
        Row: {
          assigned_staff_ids: string[] | null
          assigned_staff_names: string[] | null
          comments: string | null
          company_id: string
          completed: boolean | null
          completed_date: string | null
          confirmed: boolean | null
          confirmed_by: string | null
          confirmed_date: string | null
          confirmed_method: string | null
          contract_id: string | null
          created_at: string
          date: string | null
          description: string | null
          duration_days: number | null
          duration_hours: number | null
          id: string
          lead_id: string | null
          locked: boolean | null
          provisional: boolean | null
          time: string | null
          travel_time: string | null
          work_type: string | null
        }
        Insert: {
          assigned_staff_ids?: string[] | null
          assigned_staff_names?: string[] | null
          comments?: string | null
          company_id: string
          completed?: boolean | null
          completed_date?: string | null
          confirmed?: boolean | null
          confirmed_by?: string | null
          confirmed_date?: string | null
          confirmed_method?: string | null
          contract_id?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          duration_days?: number | null
          duration_hours?: number | null
          id?: string
          lead_id?: string | null
          locked?: boolean | null
          provisional?: boolean | null
          time?: string | null
          travel_time?: string | null
          work_type?: string | null
        }
        Update: {
          assigned_staff_ids?: string[] | null
          assigned_staff_names?: string[] | null
          comments?: string | null
          company_id?: string
          completed?: boolean | null
          completed_date?: string | null
          confirmed?: boolean | null
          confirmed_by?: string | null
          confirmed_date?: string | null
          confirmed_method?: string | null
          contract_id?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          duration_days?: number | null
          duration_hours?: number | null
          id?: string
          lead_id?: string | null
          locked?: boolean | null
          provisional?: boolean | null
          time?: string | null
          travel_time?: string | null
          work_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fitting_appointments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fitting_appointments_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fitting_appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          category: string
          company_id: string
          description: string | null
          id: string
          min_quantity: number | null
          name: string
          quantity: number | null
          sku: string
          supplier: string | null
          unit_price: number | null
        }
        Insert: {
          category: string
          company_id: string
          description?: string | null
          id?: string
          min_quantity?: number | null
          name: string
          quantity?: number | null
          sku: string
          supplier?: string | null
          unit_price?: number | null
        }
        Update: {
          category?: string
          company_id?: string
          description?: string | null
          id?: string
          min_quantity?: number | null
          name?: string
          quantity?: number | null
          sku?: string
          supplier?: string | null
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      job_invoices: {
        Row: {
          company_id: string
          contract_id: string | null
          created_at: string
          date: string | null
          description: string | null
          document_id: string | null
          gross_amount: number | null
          id: string
          invoice_number: string | null
          lead_id: string | null
          net_amount: number | null
          supplier_id: string | null
          supplier_name: string | null
          vat_amount: number | null
        }
        Insert: {
          company_id: string
          contract_id?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          document_id?: string | null
          gross_amount?: number | null
          id?: string
          invoice_number?: string | null
          lead_id?: string | null
          net_amount?: number | null
          supplier_id?: string | null
          supplier_name?: string | null
          vat_amount?: number | null
        }
        Update: {
          company_id?: string
          contract_id?: string | null
          created_at?: string
          date?: string | null
          description?: string | null
          document_id?: string | null
          gross_amount?: number | null
          id?: string
          invoice_number?: string | null
          lead_id?: string | null
          net_amount?: number | null
          supplier_id?: string | null
          supplier_name?: string | null
          vat_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_invoices_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          assigned_team: string[] | null
          company_id: string
          completed_date: string | null
          created_at: string
          customer_id: string | null
          id: string
          installation_type: string | null
          job_number: string
          notes: string | null
          quote_id: string | null
          scheduled_date: string | null
          status: string | null
          window_count: number | null
        }
        Insert: {
          assigned_team?: string[] | null
          company_id: string
          completed_date?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          installation_type?: string | null
          job_number: string
          notes?: string | null
          quote_id?: string | null
          scheduled_date?: string | null
          status?: string | null
          window_count?: number | null
        }
        Update: {
          assigned_team?: string[] | null
          company_id?: string
          completed_date?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          installation_type?: string | null
          job_number?: string
          notes?: string | null
          quote_id?: string | null
          scheduled_date?: string | null
          status?: string | null
          window_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_checklist_items: {
        Row: {
          action_name: string
          assigned_by_id: string | null
          assigned_to_id: string | null
          comment: string | null
          company_id: string
          completed_at: string | null
          completed_by_id: string | null
          completed_by_name: string | null
          created_at: string
          due_date: string | null
          id: number
          lead_id: string
          locked: boolean | null
          notification_template: string | null
          notify_on_complete: boolean | null
          priority: string | null
          sort_order: number | null
          status: string | null
          template_id: number | null
        }
        Insert: {
          action_name: string
          assigned_by_id?: string | null
          assigned_to_id?: string | null
          comment?: string | null
          company_id: string
          completed_at?: string | null
          completed_by_id?: string | null
          completed_by_name?: string | null
          created_at?: string
          due_date?: string | null
          id?: number
          lead_id: string
          locked?: boolean | null
          notification_template?: string | null
          notify_on_complete?: boolean | null
          priority?: string | null
          sort_order?: number | null
          status?: string | null
          template_id?: number | null
        }
        Update: {
          action_name?: string
          assigned_by_id?: string | null
          assigned_to_id?: string | null
          comment?: string | null
          company_id?: string
          completed_at?: string | null
          completed_by_id?: string | null
          completed_by_name?: string | null
          created_at?: string
          due_date?: string | null
          id?: number
          lead_id?: string
          locked?: boolean | null
          notification_template?: string | null
          notify_on_complete?: boolean | null
          priority?: string | null
          sort_order?: number | null
          status?: string | null
          template_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_checklist_items_assigned_by_id_fkey"
            columns: ["assigned_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_checklist_items_assigned_to_id_fkey"
            columns: ["assigned_to_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_checklist_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_checklist_items_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_checklist_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notes: {
        Row: {
          company_id: string
          content: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          lead_id: string | null
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          lead_id?: string | null
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          lead_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_results: {
        Row: {
          category: string
          company_id: string
          id: number
          is_active: boolean | null
          label: string
          sort_order: number | null
        }
        Insert: {
          category: string
          company_id: string
          id?: number
          is_active?: boolean | null
          label: string
          sort_order?: number | null
        }
        Update: {
          category?: string
          company_id?: string
          id?: number
          is_active?: boolean | null
          label?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_results_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          assigned_to: string | null
          balance_reason: string | null
          cancel_date: string | null
          cancel_reason: string | null
          company_id: string
          contract_cancelled: boolean | null
          contract_date: string | null
          contract_number: number | null
          contract_type: string | null
          created_at: string
          customer_id: string | null
          delivery_method: string | null
          estimated_fitting_days: number | null
          estimated_value: number | null
          fitting_county: string | null
          fitting_directions: string | null
          fitting_house_name: string | null
          fitting_house_number: string | null
          fitting_locality: string | null
          fitting_postcode: string | null
          fitting_same_as_customer: boolean | null
          fitting_street: string | null
          fitting_town: string | null
          fitting_what_3_words: string | null
          follow_up_date: string | null
          gross_value: number | null
          guarantee_date: string | null
          guarantee_number: string | null
          hold_date_off: string | null
          hold_date_on: string | null
          hold_reason: string | null
          id: string
          installation_completed: string | null
          installation_county: string | null
          installation_house_name: string | null
          installation_house_number: string | null
          installation_locality: string | null
          installation_manager: string | null
          installation_postcode: string | null
          installation_street: string | null
          installation_town: string | null
          installation_what_3_words: string | null
          insurance_backed_guarantee_ref: string | null
          invoice_county: string | null
          invoice_house_name: string | null
          invoice_house_number: string | null
          invoice_locality: string | null
          invoice_name: string | null
          invoice_postcode: string | null
          invoice_same_as_customer: boolean | null
          invoice_street: string | null
          invoice_town: string | null
          lead_date: string | null
          lead_number: number | null
          notes: string | null
          office_reference: string | null
          office_reference_2: string | null
          old_balance_reason: string | null
          on_hold: boolean | null
          payment_method: string | null
          priority: string | null
          product_interest_1: string | null
          product_interest_2: string | null
          product_type: string | null
          quote_date: string | null
          quote_type: string | null
          result: string | null
          result_date: string | null
          result_reason: string | null
          sales_area: string | null
          sales_director: string | null
          salesman: string | null
          salesperson_type: string | null
          same_as_customer_address: boolean | null
          send_letters_to_fitting: boolean | null
          signboard_date: string | null
          signboard_left: boolean | null
          source: string | null
          status: string | null
          sub_source: string | null
          supply_only: boolean | null
          taken_by: string | null
          tt_customer_id: string | null
          tt_last_sync_at: string | null
          tt_quote_id: string | null
          tt_quote_pdf_file_name: string | null
          tt_quote_pdf_url: string | null
          tt_quote_reference: string | null
          tt_quote_url: string | null
          tt_sync_status: string | null
          window_count: number | null
          window_types: string[] | null
        }
        Insert: {
          assigned_to?: string | null
          balance_reason?: string | null
          cancel_date?: string | null
          cancel_reason?: string | null
          company_id: string
          contract_cancelled?: boolean | null
          contract_date?: string | null
          contract_number?: number | null
          contract_type?: string | null
          created_at?: string
          customer_id?: string | null
          delivery_method?: string | null
          estimated_fitting_days?: number | null
          estimated_value?: number | null
          fitting_county?: string | null
          fitting_directions?: string | null
          fitting_house_name?: string | null
          fitting_house_number?: string | null
          fitting_locality?: string | null
          fitting_postcode?: string | null
          fitting_same_as_customer?: boolean | null
          fitting_street?: string | null
          fitting_town?: string | null
          fitting_what_3_words?: string | null
          follow_up_date?: string | null
          gross_value?: number | null
          guarantee_date?: string | null
          guarantee_number?: string | null
          hold_date_off?: string | null
          hold_date_on?: string | null
          hold_reason?: string | null
          id?: string
          installation_completed?: string | null
          installation_county?: string | null
          installation_house_name?: string | null
          installation_house_number?: string | null
          installation_locality?: string | null
          installation_manager?: string | null
          installation_postcode?: string | null
          installation_street?: string | null
          installation_town?: string | null
          installation_what_3_words?: string | null
          insurance_backed_guarantee_ref?: string | null
          invoice_county?: string | null
          invoice_house_name?: string | null
          invoice_house_number?: string | null
          invoice_locality?: string | null
          invoice_name?: string | null
          invoice_postcode?: string | null
          invoice_same_as_customer?: boolean | null
          invoice_street?: string | null
          invoice_town?: string | null
          lead_date?: string | null
          lead_number?: number | null
          notes?: string | null
          office_reference?: string | null
          office_reference_2?: string | null
          old_balance_reason?: string | null
          on_hold?: boolean | null
          payment_method?: string | null
          priority?: string | null
          product_interest_1?: string | null
          product_interest_2?: string | null
          product_type?: string | null
          quote_date?: string | null
          quote_type?: string | null
          result?: string | null
          result_date?: string | null
          result_reason?: string | null
          sales_area?: string | null
          sales_director?: string | null
          salesman?: string | null
          salesperson_type?: string | null
          same_as_customer_address?: boolean | null
          send_letters_to_fitting?: boolean | null
          signboard_date?: string | null
          signboard_left?: boolean | null
          source?: string | null
          status?: string | null
          sub_source?: string | null
          supply_only?: boolean | null
          taken_by?: string | null
          tt_customer_id?: string | null
          tt_last_sync_at?: string | null
          tt_quote_id?: string | null
          tt_quote_pdf_file_name?: string | null
          tt_quote_pdf_url?: string | null
          tt_quote_reference?: string | null
          tt_quote_url?: string | null
          tt_sync_status?: string | null
          window_count?: number | null
          window_types?: string[] | null
        }
        Update: {
          assigned_to?: string | null
          balance_reason?: string | null
          cancel_date?: string | null
          cancel_reason?: string | null
          company_id?: string
          contract_cancelled?: boolean | null
          contract_date?: string | null
          contract_number?: number | null
          contract_type?: string | null
          created_at?: string
          customer_id?: string | null
          delivery_method?: string | null
          estimated_fitting_days?: number | null
          estimated_value?: number | null
          fitting_county?: string | null
          fitting_directions?: string | null
          fitting_house_name?: string | null
          fitting_house_number?: string | null
          fitting_locality?: string | null
          fitting_postcode?: string | null
          fitting_same_as_customer?: boolean | null
          fitting_street?: string | null
          fitting_town?: string | null
          fitting_what_3_words?: string | null
          follow_up_date?: string | null
          gross_value?: number | null
          guarantee_date?: string | null
          guarantee_number?: string | null
          hold_date_off?: string | null
          hold_date_on?: string | null
          hold_reason?: string | null
          id?: string
          installation_completed?: string | null
          installation_county?: string | null
          installation_house_name?: string | null
          installation_house_number?: string | null
          installation_locality?: string | null
          installation_manager?: string | null
          installation_postcode?: string | null
          installation_street?: string | null
          installation_town?: string | null
          installation_what_3_words?: string | null
          insurance_backed_guarantee_ref?: string | null
          invoice_county?: string | null
          invoice_house_name?: string | null
          invoice_house_number?: string | null
          invoice_locality?: string | null
          invoice_name?: string | null
          invoice_postcode?: string | null
          invoice_same_as_customer?: boolean | null
          invoice_street?: string | null
          invoice_town?: string | null
          lead_date?: string | null
          lead_number?: number | null
          notes?: string | null
          office_reference?: string | null
          office_reference_2?: string | null
          old_balance_reason?: string | null
          on_hold?: boolean | null
          payment_method?: string | null
          priority?: string | null
          product_interest_1?: string | null
          product_interest_2?: string | null
          product_type?: string | null
          quote_date?: string | null
          quote_type?: string | null
          result?: string | null
          result_date?: string | null
          result_reason?: string | null
          sales_area?: string | null
          sales_director?: string | null
          salesman?: string | null
          salesperson_type?: string | null
          same_as_customer_address?: boolean | null
          send_letters_to_fitting?: boolean | null
          signboard_date?: string | null
          signboard_left?: boolean | null
          source?: string | null
          status?: string | null
          sub_source?: string | null
          supply_only?: boolean | null
          taken_by?: string | null
          tt_customer_id?: string | null
          tt_last_sync_at?: string | null
          tt_quote_id?: string | null
          tt_quote_pdf_file_name?: string | null
          tt_quote_pdf_url?: string | null
          tt_quote_reference?: string | null
          tt_quote_url?: string | null
          tt_sync_status?: string | null
          window_count?: number | null
          window_types?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_taken_by_fkey"
            columns: ["taken_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          company_id: string
          content: string
          created_at: string
          customer_id: string | null
          direction: string
          id: string
          read: boolean | null
        }
        Insert: {
          company_id: string
          content: string
          created_at?: string
          customer_id?: string | null
          direction: string
          id?: string
          read?: boolean | null
        }
        Update: {
          company_id?: string
          content?: string
          created_at?: string
          customer_id?: string | null
          direction?: string
          id?: string
          read?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          checklist_item_id: number | null
          company_id: string
          contract_id: string | null
          created_at: string
          id: number
          lead_id: string | null
          message: string
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          checklist_item_id?: number | null
          company_id: string
          contract_id?: string | null
          created_at?: string
          id?: number
          lead_id?: string | null
          message: string
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          checklist_item_id?: number | null
          company_id?: string
          contract_id?: string | null
          created_at?: string
          id?: number
          lead_id?: string | null
          message?: string
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          supplier_id: string | null
          supplier_name: string | null
          warranty: string | null
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          supplier_id?: string | null
          supplier_name?: string | null
          warranty?: string | null
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          supplier_id?: string | null
          supplier_name?: string | null
          warranty?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_types: {
        Row: {
          company_id: string
          id: number
          is_active: boolean | null
          name: string
          sort_order: number | null
        }
        Insert: {
          company_id: string
          id?: number
          is_active?: boolean | null
          name: string
          sort_order?: number | null
        }
        Update: {
          company_id?: string
          id?: number
          is_active?: boolean | null
          name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_types_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          company_id: string
          created_at: string
          customer_id: string | null
          id: string
          lead_id: string | null
          line_items: Json | null
          notes: string | null
          quote_number: string
          status: string | null
          subtotal: number | null
          tax: number | null
          total: number | null
          valid_until: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_id?: string | null
          id?: string
          lead_id?: string | null
          line_items?: Json | null
          notes?: string | null
          quote_number: string
          status?: string | null
          subtotal?: number | null
          tax?: number | null
          total?: number | null
          valid_until?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_id?: string | null
          id?: string
          lead_id?: string | null
          line_items?: Json | null
          notes?: string | null
          quote_number?: string
          status?: string | null
          subtotal?: number | null
          tax?: number | null
          total?: number | null
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_members: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string
          default_hourly_rate: number | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          phone: string | null
          role: string | null
          roles: string[] | null
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string
          default_hourly_rate?: number | null
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          phone?: string | null
          role?: string | null
          roles?: string[] | null
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string
          default_hourly_rate?: number | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          role?: string | null
          roles?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "staff_members_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_items: {
        Row: {
          active: boolean | null
          barcode_data: string | null
          barcode_value: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
          price: number | null
          supplier_id: string | null
          supplier_name: string | null
          unit_of_measurement: string
        }
        Insert: {
          active?: boolean | null
          barcode_data?: string | null
          barcode_value?: string | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          price?: number | null
          supplier_id?: string | null
          supplier_name?: string | null
          unit_of_measurement: string
        }
        Update: {
          active?: boolean | null
          barcode_data?: string | null
          barcode_value?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          price?: number | null
          supplier_id?: string | null
          supplier_name?: string | null
          unit_of_measurement?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_items_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_locations: {
        Row: {
          active: boolean | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          active?: boolean | null
          company_id: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          active?: boolean | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_locations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transactions: {
        Row: {
          company_id: string
          contract_id: string | null
          created_at: string
          created_by_id: string | null
          created_by_name: string | null
          id: number
          notes: string | null
          quantity: number
          stock_item_id: string
          stock_location_id: string
          supplier_id: string | null
          supplier_name: string | null
          type: string
          unit_price: number | null
        }
        Insert: {
          company_id: string
          contract_id?: string | null
          created_at?: string
          created_by_id?: string | null
          created_by_name?: string | null
          id?: number
          notes?: string | null
          quantity: number
          stock_item_id: string
          stock_location_id: string
          supplier_id?: string | null
          supplier_name?: string | null
          type: string
          unit_price?: number | null
        }
        Update: {
          company_id?: string
          contract_id?: string | null
          created_at?: string
          created_by_id?: string | null
          created_by_name?: string | null
          id?: number
          notes?: string | null
          quantity?: number
          stock_item_id?: string
          stock_location_id?: string
          supplier_id?: string | null
          supplier_name?: string | null
          type?: string
          unit_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_stock_item_id_fkey"
            columns: ["stock_item_id"]
            isOneToOne: false
            referencedRelation: "stock_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_stock_location_id_fkey"
            columns: ["stock_location_id"]
            isOneToOne: false
            referencedRelation: "stock_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transactions_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean | null
          address: string | null
          company_id: string
          contact_name: string | null
          county: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          postcode: string | null
          town: string | null
        }
        Insert: {
          active?: boolean | null
          address?: string | null
          company_id: string
          contact_name?: string | null
          county?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          postcode?: string | null
          town?: string | null
        }
        Update: {
          active?: boolean | null
          address?: string | null
          company_id?: string
          contact_name?: string | null
          county?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          postcode?: string | null
          town?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_counters: {
        Row: {
          company_id: string
          name: string
          value: number
        }
        Insert: {
          company_id: string
          name: string
          value?: number
        }
        Update: {
          company_id?: string
          name?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "tenant_counters_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      user_email_settings: {
        Row: {
          company_id: string
          created_at: string
          default_from_address_id: string | null
          email_signature: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          default_from_address_id?: string | null
          email_signature?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          default_from_address_id?: string | null
          email_signature?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_email_settings_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_email_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          active: boolean
          company_id: string | null
          created_at: string
          email: string | null
          first_name: string | null
          id: string
          last_name: string | null
          role: string
        }
        Insert: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id: string
          last_name?: string | null
          role?: string
        }
        Update: {
          active?: boolean
          company_id?: string | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      company_seats_used: { Args: never; Returns: number }
      current_company_id: { Args: never; Returns: string }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      is_platform_admin: { Args: never; Returns: boolean }
      next_reference: { Args: { p_name: string }; Returns: number }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
