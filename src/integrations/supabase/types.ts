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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      clientes: {
        Row: {
          cadastrado_em: string | null
          created_at: string | null
          desconto: number | null
          id: string
          nome: string
          plano_id: string | null
          servidores_ids: string[] | null
          status: string | null
          updated_at: string | null
          user_id: string
          valor: number | null
          vencimento: string | null
          whatsapp: string | null
        }
        Insert: {
          cadastrado_em?: string | null
          created_at?: string | null
          desconto?: number | null
          id?: string
          nome: string
          plano_id?: string | null
          servidores_ids?: string[] | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          valor?: number | null
          vencimento?: string | null
          whatsapp?: string | null
        }
        Update: {
          cadastrado_em?: string | null
          created_at?: string | null
          desconto?: number | null
          id?: string
          nome?: string
          plano_id?: string | null
          servidores_ids?: string[] | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
          valor?: number | null
          vencimento?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      dispositivos: {
        Row: {
          app_key: string | null
          app_nome: string
          cliente_id: string
          created_at: string | null
          id: string
          mac_address: string
        }
        Insert: {
          app_key?: string | null
          app_nome: string
          cliente_id: string
          created_at?: string | null
          id?: string
          mac_address: string
        }
        Update: {
          app_key?: string | null
          app_nome?: string
          cliente_id?: string
          created_at?: string | null
          id?: string
          mac_address?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispositivos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          name: string
          price: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name: string
          price?: number
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name?: string
          price?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      renovacoes: {
        Row: {
          cliente_id: string | null
          created_at: string | null
          data_renovacao: string | null
          desconto: number | null
          id: string
          novo_vencimento: string | null
          plano_id: string | null
          user_id: string
          valor: number | null
          vencimento_anterior: string | null
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string | null
          data_renovacao?: string | null
          desconto?: number | null
          id?: string
          novo_vencimento?: string | null
          plano_id?: string | null
          user_id?: string
          valor?: number | null
          vencimento_anterior?: string | null
        }
        Update: {
          cliente_id?: string | null
          created_at?: string | null
          data_renovacao?: string | null
          desconto?: number | null
          id?: string
          novo_vencimento?: string | null
          plano_id?: string | null
          user_id?: string
          valor?: number | null
          vencimento_anterior?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "renovacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "renovacoes_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_credits: {
        Row: {
          created_at: string | null
          custo: number
          data: string | null
          id: string
          quantidade_creditos: number
          reseller_id: string
          servidor: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          custo: number
          data?: string | null
          id?: string
          quantidade_creditos: number
          reseller_id: string
          servidor?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          custo?: number
          data?: string | null
          id?: string
          quantidade_creditos?: number
          reseller_id?: string
          servidor?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_credits_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "revendedores"
            referencedColumns: ["id"]
          },
        ]
      }
      revendedores: {
        Row: {
          created_at: string | null
          custo_por_credito: number | null
          id: string
          nome: string
          painel_login: string | null
          painel_senha: string | null
          preco_venda_por_credito: number | null
          saldo_creditos: number | null
          servidor: string | null
          servidor_principal_id: string | null
          updated_at: string | null
          user_id: string
          vencimento_painel: string | null
          whatsapp: string | null
        }
        Insert: {
          created_at?: string | null
          custo_por_credito?: number | null
          id?: string
          nome: string
          painel_login?: string | null
          painel_senha?: string | null
          preco_venda_por_credito?: number | null
          saldo_creditos?: number | null
          servidor?: string | null
          servidor_principal_id?: string | null
          updated_at?: string | null
          user_id: string
          vencimento_painel?: string | null
          whatsapp?: string | null
        }
        Update: {
          created_at?: string | null
          custo_por_credito?: number | null
          id?: string
          nome?: string
          painel_login?: string | null
          painel_senha?: string | null
          preco_venda_por_credito?: number | null
          saldo_creditos?: number | null
          servidor?: string | null
          servidor_principal_id?: string | null
          updated_at?: string | null
          user_id?: string
          vencimento_painel?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "revendedores_servidor_principal_id_fkey"
            columns: ["servidor_principal_id"]
            isOneToOne: false
            referencedRelation: "servidores_iptv"
            referencedColumns: ["id"]
          },
        ]
      }
      servidores_iptv: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
          valor: number
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name: string
          updated_at?: string | null
          user_id?: string
          valor?: number
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      telegram_authorized_users: {
        Row: {
          created_at: string | null
          current_step: string | null
          id: string
          telegram_chat_id: number
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_step?: string | null
          id?: string
          telegram_chat_id: number
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_step?: string | null
          id?: string
          telegram_chat_id?: number
          user_id?: string
        }
        Relationships: []
      }
      telegram_message_logs: {
        Row: {
          created_at: string | null
          id: string
          message_id: number
          telegram_chat_id: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          message_id: number
          telegram_chat_id: number
        }
        Update: {
          created_at?: string | null
          id?: string
          message_id?: number
          telegram_chat_id?: number
        }
        Relationships: []
      }
      templates_whatsapp: {
        Row: {
          created_at: string
          id: string
          mensagem: string
          nome: string
        }
        Insert: {
          created_at?: string
          id?: string
          mensagem: string
          nome: string
        }
        Update: {
          created_at?: string
          id?: string
          mensagem?: string
          nome?: string
        }
        Relationships: []
      }
      transacoes: {
        Row: {
          cliente_id: string | null
          created_at: string | null
          custo: number | null
          data: string | null
          descricao: string | null
          entrada: number | null
          id: string
          lucro_liquido: number | null
          serv_id: string | null
          tipo: string
          user_id: string
          valor: number
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string | null
          custo?: number | null
          data?: string | null
          descricao?: string | null
          entrada?: number | null
          id?: string
          lucro_liquido?: number | null
          serv_id?: string | null
          tipo: string
          user_id?: string
          valor?: number
        }
        Update: {
          cliente_id?: string | null
          created_at?: string | null
          custo?: number | null
          data?: string | null
          descricao?: string | null
          entrada?: number | null
          id?: string
          lucro_liquido?: number | null
          serv_id?: string | null
          tipo?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "transacoes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_serv_id_fkey"
            columns: ["serv_id"]
            isOneToOne: false
            referencedRelation: "servidores_iptv"
            referencedColumns: ["id"]
          },
        ]
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
