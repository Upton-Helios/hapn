import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types/database";

// For use in the Expo app — reads from env
export function createSupabaseClient() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY");
  }

  return createClient<Database>(url, anonKey);
}

// For use in scrapers and edge functions — uses service role
export function createServiceClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  return createClient<Database>(url, serviceKey);
}

// Types re-export
export type { Database };
