import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Measurement = {
  id: string;
  user_id: string | null;
  measured_at: string;
  side: "left" | "right" | "both";
  rms_uv: number;
  peak_uv: number;
  episodes: number;
  clench_seconds: number;
  sleep_hours: number | null;
  note: string | null;
  is_demo: boolean;
};

const rangeSchema = z.object({
  from: z.string().min(4),
  to: z.string().min(4),
  source: z.enum(["all", "own", "demo"]).default("all"),
});

const measurementSchema = z.object({
  measured_at: z.string().min(4),
  side: z.enum(["left", "right", "both"]),
  rms_uv: z.number().min(0).max(5000),
  peak_uv: z.number().min(0).max(10000),
  episodes: z.number().int().min(0).max(5000),
  clench_seconds: z.number().int().min(0).max(100000),
  sleep_hours: z.number().min(0).max(24).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

function normalize(rows: unknown[]): Measurement[] {
  return (rows as Record<string, unknown>[]).map((r) => ({
    id: String(r["id"]),
    user_id: (r["user_id"] as string | null) ?? null,
    measured_at: String(r["measured_at"]),
    side: r["side"] as Measurement["side"],
    rms_uv: Number(r["rms_uv"]),
    peak_uv: Number(r["peak_uv"]),
    episodes: Number(r["episodes"]),
    clench_seconds: Number(r["clench_seconds"]),
    sleep_hours: r["sleep_hours"] === null ? null : Number(r["sleep_hours"]),
    note: (r["note"] as string | null) ?? null,
    is_demo: Boolean(r["is_demo"]),
  }));
}

export const listMeasurements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rangeSchema.parse(input))
  .handler(async ({ data, context }): Promise<Measurement[]> => {
    let query = context.supabase
      .from("emg_measurements")
      .select("*")
      .gte("measured_at", data.from)
      .lte("measured_at", data.to)
      .order("measured_at", { ascending: true })
      .limit(2000);

    if (data.source === "own") query = query.eq("user_id", context.userId);
    if (data.source === "demo") query = query.is("user_id", null);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return normalize(rows ?? []);
  });

export const addMeasurements = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ rows: z.array(measurementSchema).min(1).max(500) }).parse(input))
  .handler(async ({ data, context }) => {
    const payload = data.rows.map((row) => ({
      ...row,
      sleep_hours: row.sleep_hours ?? null,
      note: row.note ?? null,
      user_id: context.userId,
      is_demo: false,
    }));

    const { error } = await context.supabase.from("emg_measurements").insert(payload);
    if (error) throw new Error(error.message);
    return { inserted: payload.length };
  });

export const deleteMeasurement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("emg_measurements")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
