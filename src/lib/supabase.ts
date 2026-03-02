import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your deployment settings.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      customers: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          phone: string | null;
          address: string | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['customers']['Insert']>;
      };
      surveys: {
        Row: {
          id: string;
          customer_id: string | null;
          move_type_id: string | null;
          survey_date: string;
          survey_type: string;
          origin_address: string | null;
          destination_address: string | null;
          total_volume: number;
          status: string;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
      };
      quotes: {
        Row: {
          id: string;
          survey_id: string | null;
          quote_number: string;
          quote_date: string;
          valid_until: string | null;
          subtotal: number;
          tax: number;
          total: number;
          status: string;
          notes: string | null;
          created_by: string | null;
          created_at: string;
        };
      };
      jobs: {
        Row: {
          id: string;
          quote_id: string | null;
          job_number: string;
          customer_id: string | null;
          move_type_id: string | null;
          scheduled_date: string | null;
          completion_date: string | null;
          status: string;
          origin_address: string | null;
          destination_address: string | null;
          notes: string | null;
          created_at: string;
        };
      };
    };
  };
};
