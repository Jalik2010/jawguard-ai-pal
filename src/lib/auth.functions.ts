import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * Первый фактор входа: пароль проверяется на сервере и сессия НЕ создаётся
 * в браузере. Сессию выдаёт только второй фактор — код из письма.
 */
export const verifyPasswordFactor = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ email: z.string().email(), password: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; reason?: "credentials" | "unconfirmed" }> => {
    const url = process.env["SUPABASE_URL"]!;
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;

    const client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
            headers.delete("Authorization");
          }
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });

    const { data: result, error } = await client.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      const message = error.message.toLowerCase();
      if (message.includes("confirm")) return { ok: false, reason: "unconfirmed" };
      return { ok: false, reason: "credentials" };
    }

    if (result.session) {
      await client.auth.signOut({ scope: "local" });
    }

    return { ok: Boolean(result.user) };
  });
