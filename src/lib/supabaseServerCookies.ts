import { createServerClient } from "@supabase/ssr";
import { serialize, type SerializeOptions } from "cookie";
import type { Request, Response } from "express";

import { env } from "../config/env";

/**
 * Cliente Supabase por pedido HTTP — cookies PKCE para OAuth (Google) na própria API.
 */
export function createSupabaseServerClient(req: Request, res: Response) {
  return createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        const jar = req.cookies;
        if (!jar || typeof jar !== "object") return [];
        return Object.entries(jar).map(([name, value]) => ({
          name,
          value: value === undefined ? "" : String(value),
        }));
      },
      setAll(cookiesToSet, headers) {
        for (const [key, value] of Object.entries(headers)) {
          res.setHeader(key, value);
        }
        for (const { name, value, options } of cookiesToSet) {
          res.append(
            "Set-Cookie",
            serialize(name, value, {
              ...(options as SerializeOptions),
              path: (options as SerializeOptions).path ?? "/",
            }),
          );
        }
      },
    },
  });
}
