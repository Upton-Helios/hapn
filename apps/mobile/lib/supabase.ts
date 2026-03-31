import { Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@hapn/supabase/types/database";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Platform-aware storage adapter
// - Native: expo-secure-store (encrypted, works in Expo Go)
// - Web: localStorage
const storage =
  Platform.OS === "web"
    ? {
        getItem: (key: string) => {
          try {
            return Promise.resolve(localStorage.getItem(key));
          } catch {
            return Promise.resolve(null);
          }
        },
        setItem: (key: string, value: string) => {
          try {
            localStorage.setItem(key, value);
          } catch {}
          return Promise.resolve();
        },
        removeItem: (key: string) => {
          try {
            localStorage.removeItem(key);
          } catch {}
          return Promise.resolve();
        },
      }
    : {
        getItem: async (key: string): Promise<string | null> => {
          const SecureStore = await import("expo-secure-store");
          try {
            return await SecureStore.getItemAsync(key);
          } catch {
            return null;
          }
        },
        setItem: async (key: string, value: string): Promise<void> => {
          const SecureStore = await import("expo-secure-store");
          try {
            await SecureStore.setItemAsync(key, value);
          } catch {}
        },
        removeItem: async (key: string): Promise<void> => {
          const SecureStore = await import("expo-secure-store");
          try {
            await SecureStore.deleteItemAsync(key);
          } catch {}
        },
      };

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
