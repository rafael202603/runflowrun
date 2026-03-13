import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);
export const supabaseConfigurationError =
  "Supabase no esta configurado para este entorno. Crea un .env local o usa las mismas VITE_SUPABASE_* de .env.github-pages.";

export const supabase = isSupabaseConfigured ? createClient(supabaseUrl!, supabasePublishableKey!) : null;
