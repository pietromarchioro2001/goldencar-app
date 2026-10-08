import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase non configurato: mancano NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY/SUPABASE_ANON_KEY."
  );
}

/*
 * Goldencar non usa Supabase Auth per l'accesso all'app.
 * Disabilitiamo quindi la persistenza/ripresa automatica di sessioni Auth:
 * una sessione JWT scaduta o non valida nel browser non deve sovrascrivere
 * l'Authorization basata sulla chiave anon/publishable e causare 401.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
