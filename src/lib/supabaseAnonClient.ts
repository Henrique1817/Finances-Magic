import { createClient } from "@supabase/supabase-js";

import { env } from "../config/env";

/**
 * Cliente Supabase (chave anon) sem persistência — login/registo no servidor e `getUser(JWT)`.
 */
export const supabaseAnon = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
