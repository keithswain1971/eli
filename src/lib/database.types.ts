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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
    }
    Functions: {
      match_chunks: {
        Args: {
          query_embedding: string | number[]
          match_threshold: number
          match_count: number
        }
        Returns: {
          id: string
          content: string
          similarity: number
          title: string
          url: string
          source_type: string
        }[]
      }
    }
  }
  eli: {
    Tables: {
      documents: {
        Row: {
          id: string
          source_type: string
          source_slug: string
          title: string
          url: string
          last_synced_at: string
        }
        Insert: {
          id?: string
          source_type: string
          source_slug: string
          title: string
          url: string
          last_synced_at?: string
        }
        Update: Partial<Database['eli']['Tables']['documents']['Insert']>
      }
      chunks: {
        Row: {
          id: string
          document_id: string
          content: string
          chunk_index: number
        }
        Insert: {
          id?: string
          document_id: string
          content: string
          chunk_index: number
        }
        Update: Partial<Database['eli']['Tables']['chunks']['Insert']>
      }
      embeddings: {
        Row: {
          chunk_id: string
          embedding: string // vector
        }
        Insert: {
          chunk_id: string
          embedding: string
        }
        Update: Partial<Database['eli']['Tables']['embeddings']['Insert']>
      }
      chat_sessions: {
        Row: {
          id: string
          surface: string
          created_at: string
        }
        Insert: {
          id?: string
          surface: string
          created_at?: string
        }
        Update: Partial<Database['eli']['Tables']['chat_sessions']['Insert']>
      }
      chat_messages: {
        Row: {
          id: string
          session_id: string
          role: 'user' | 'assistant'
          content: string
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          role: 'user' | 'assistant'
          content: string
          created_at?: string
        }
        Update: Partial<Database['eli']['Tables']['chat_messages']['Insert']>
      }
      feedback: {
        Row: {
          id: string
          message_id: string
          rating: number
          comment: string | null
        }
        Insert: {
          id?: string
          message_id: string
          rating: number
          comment?: string | null
        }
        Update: Partial<Database['eli']['Tables']['feedback']['Insert']>
      }
      config: {
        Row: {
          surface: string
          system_prompt: string | null
          allowed_sources: string[] | null
          tone: string | null
        }
        Insert: {
          surface: string
          system_prompt?: string | null
          allowed_sources?: string[] | null
          tone?: string | null
        }
        Update: Partial<Database['eli']['Tables']['config']['Insert']>
      }
    }
  }
}
