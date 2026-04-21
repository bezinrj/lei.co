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
      assinaturas: {
        Row: {
          created_at: string
          fim: string | null
          id: string
          inicio: string
          plano_id: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          fim?: string | null
          id?: string
          inicio?: string
          plano_id?: string | null
          status: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          fim?: string | null
          id?: string
          inicio?: string
          plano_id?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      badges: {
        Row: {
          cor: string
          created_at: string
          descricao: string
          icone: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          cor: string
          created_at?: string
          descricao: string
          icone: string
          id: string
          nome: string
          ordem?: number
        }
        Update: {
          cor?: string
          created_at?: string
          descricao?: string
          icone?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      cronograma_compras: {
        Row: {
          created_at: string
          cronograma_id: string | null
          id: string
          status: string
          stripe_payment_intent_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          cronograma_id?: string | null
          id?: string
          status: string
          stripe_payment_intent_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          cronograma_id?: string | null
          id?: string
          status?: string
          stripe_payment_intent_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_compras_cronograma_id_fkey"
            columns: ["cronograma_id"]
            isOneToOne: false
            referencedRelation: "cronogramas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cronograma_compras_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_materias: {
        Row: {
          cor: string
          created_at: string
          cronograma_id: string
          id: string
          nome: string
          ordem: number
          updated_at: string
        }
        Insert: {
          cor?: string
          created_at?: string
          cronograma_id: string
          id?: string
          nome: string
          ordem?: number
          updated_at?: string
        }
        Update: {
          cor?: string
          created_at?: string
          cronograma_id?: string
          id?: string
          nome?: string
          ordem?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_materias_cronograma_id_fkey"
            columns: ["cronograma_id"]
            isOneToOne: false
            referencedRelation: "cronogramas"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_topicos: {
        Row: {
          created_at: string
          descricao: string | null
          duracao_minutos: number
          fontes: Json
          horas_estimadas: number
          id: string
          materia_id: string
          ordem: number
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          duracao_minutos?: number
          fontes?: Json
          horas_estimadas?: number
          id?: string
          materia_id: string
          ordem?: number
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          duracao_minutos?: number
          fontes?: Json
          horas_estimadas?: number
          id?: string
          materia_id?: string
          ordem?: number
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_topicos_materia_id_fkey"
            columns: ["materia_id"]
            isOneToOne: false
            referencedRelation: "cronograma_materias"
            referencedColumns: ["id"]
          },
        ]
      }
      cronogramas: {
        Row: {
          categoria: string | null
          created_at: string
          created_by: string | null
          criado_por: string | null
          id: string
          imagem_url: string | null
          is_proprio: boolean
          nome: string
          preco_centavos: number | null
          premium: boolean
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          criado_por?: string | null
          id?: string
          imagem_url?: string | null
          is_proprio?: boolean
          nome: string
          preco_centavos?: number | null
          premium?: boolean
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          categoria?: string | null
          created_at?: string
          created_by?: string | null
          criado_por?: string | null
          id?: string
          imagem_url?: string | null
          is_proprio?: boolean
          nome?: string
          preco_centavos?: number | null
          premium?: boolean
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cronogramas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      planos: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          preco_centavos: number | null
          stripe_price_id: string | null
          tipo: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          preco_centavos?: number | null
          stripe_price_id?: string | null
          tipo: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          preco_centavos?: number | null
          stripe_price_id?: string | null
          tipo?: string
        }
        Relationships: []
      }
      presence: {
        Row: {
          last_seen_at: string
          user_id: string
        }
        Insert: {
          last_seen_at?: string
          user_id: string
        }
        Update: {
          last_seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          concurso_alvo: string | null
          created_at: string
          data_prova: string | null
          display_name: string | null
          friend_id: string
          id: string
          plano_atual: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          concurso_alvo?: string | null
          created_at?: string
          data_prova?: string | null
          display_name?: string | null
          friend_id: string
          id: string
          plano_atual?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          concurso_alvo?: string | null
          created_at?: string
          data_prova?: string | null
          display_name?: string | null
          friend_id?: string
          id?: string
          plano_atual?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          created_at: string
          desbloqueada_em: string
          destaque: boolean
          id: string
          publica: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          badge_id: string
          created_at?: string
          desbloqueada_em?: string
          destaque?: boolean
          id?: string
          publica?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          created_at?: string
          desbloqueada_em?: string
          destaque?: boolean
          id?: string
          publica?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
        ]
      }
      user_calendar_events: {
        Row: {
          concluido: boolean
          cor: string | null
          created_at: string
          cronograma_id: string | null
          data: string
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          is_revisao: boolean
          materia_id: string | null
          titulo: string
          topico_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          concluido?: boolean
          cor?: string | null
          created_at?: string
          cronograma_id?: string | null
          data: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          is_revisao?: boolean
          materia_id?: string | null
          titulo: string
          topico_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          concluido?: boolean
          cor?: string | null
          created_at?: string
          cronograma_id?: string | null
          data?: string
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          is_revisao?: boolean
          materia_id?: string | null
          titulo?: string
          topico_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_calendar_events_cronograma_id_fkey"
            columns: ["cronograma_id"]
            isOneToOne: false
            referencedRelation: "cronogramas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_calendar_events_materia_id_fkey"
            columns: ["materia_id"]
            isOneToOne: false
            referencedRelation: "cronograma_materias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_calendar_events_topico_id_fkey"
            columns: ["topico_id"]
            isOneToOne: false
            referencedRelation: "cronograma_topicos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_cronograma_ativacao: {
        Row: {
          ativo: boolean
          created_at: string
          cronograma_id: string
          data_inicio: string
          data_prova: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          cronograma_id: string
          data_inicio?: string
          data_prova: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          cronograma_id?: string
          data_inicio?: string
          data_prova?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_cronograma_ativacao_cronograma_id_fkey"
            columns: ["cronograma_id"]
            isOneToOne: false
            referencedRelation: "cronogramas"
            referencedColumns: ["id"]
          },
        ]
      }
      user_fonte_progress: {
        Row: {
          concluido: boolean
          id: string
          sigla: string
          topico_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          concluido?: boolean
          id?: string
          sigla: string
          topico_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          concluido?: boolean
          id?: string
          sigla?: string
          topico_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_fonte_progress_topico_id_fkey"
            columns: ["topico_id"]
            isOneToOne: false
            referencedRelation: "cronograma_topicos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_plans: {
        Row: {
          created_at: string
          expira_em: string | null
          id: string
          inicio_em: string
          tipo: Database["public"]["Enums"]["plan_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expira_em?: string | null
          id?: string
          inicio_em?: string
          tipo?: Database["public"]["Enums"]["plan_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expira_em?: string | null
          id?: string
          inicio_em?: string
          tipo?: Database["public"]["Enums"]["plan_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          acertos: number
          created_at: string
          data: string
          id: string
          percentual_acerto: number
          questoes: number
          tempo_estudado: string | null
          topico_id: string
          user_id: string
        }
        Insert: {
          acertos?: number
          created_at?: string
          data?: string
          id?: string
          percentual_acerto?: number
          questoes?: number
          tempo_estudado?: string | null
          topico_id: string
          user_id: string
        }
        Update: {
          acertos?: number
          created_at?: string
          data?: string
          id?: string
          percentual_acerto?: number
          questoes?: number
          tempo_estudado?: string | null
          topico_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_topico_id_fkey"
            columns: ["topico_id"]
            isOneToOne: false
            referencedRelation: "cronograma_topicos"
            referencedColumns: ["id"]
          },
        ]
      }
      user_topico_progresso: {
        Row: {
          concluido: boolean
          concluido_em: string | null
          created_at: string
          id: string
          minutos_estudados: number
          topico_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          concluido?: boolean
          concluido_em?: string | null
          created_at?: string
          id?: string
          minutos_estudados?: number
          topico_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          concluido?: boolean
          concluido_em?: string | null
          created_at?: string
          id?: string
          minutos_estudados?: number
          topico_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_topico_progresso_topico_id_fkey"
            columns: ["topico_id"]
            isOneToOne: false
            referencedRelation: "cronograma_topicos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      tem_acesso_cronograma: {
        Args: { cid: string; uid: string }
        Returns: boolean
      }
      tem_assinatura_ativa: { Args: { uid: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "moderador" | "user"
      plan_type: "free" | "premium"
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
      app_role: ["admin", "moderador", "user"],
      plan_type: ["free", "premium"],
    },
  },
} as const
