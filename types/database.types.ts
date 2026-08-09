/**
 * PLACEHOLDER - substitua rodando:
 *   npx supabase gen types typescript --project-id <SEU_ID> --schema public > types/database.types.ts
 *
 * Ate la, este tipo permissivo mantem o projeto compilando.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: Record<string, { Row: any; Insert: any; Update: any; Relationships: [] }>;
    Views: Record<string, { Row: any }>;
    Functions: Record<string, { Args: any; Returns: any }>;
    Enums: Record<string, string>;
    CompositeTypes: Record<string, never>;
  };
};
