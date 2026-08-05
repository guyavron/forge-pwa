import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project's values (Project Settings → API)."
  );
}

// Not passing the generated `Database` generic here on purpose — hand-rolled types don't
// structurally match what supabase-js's generic inference expects (it wants Row/Insert/Update
// *and* a Relationships array per table) and produced `never` types on every insert/update.
// Type safety instead lives at the api.ts boundary via explicit return-type annotations,
// which is what the rest of the app actually imports from. If this grows, regenerate real
// types with `npx supabase gen types typescript` and wire the generic back in.
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
