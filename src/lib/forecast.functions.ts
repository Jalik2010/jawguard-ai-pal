import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  forecastDays,
  riskLabel,
  riskLevel,
  summarize,
  toDailyPoints,
  type ForecastPoint,
  type RiskLevel,
} from "./analytics";
import type { Measurement } from "./emg.functions";

export type ForecastResult = {
  points: ForecastPoint[];
  risk: RiskLevel;
  riskTitle: string;
  summaryText: string;
  recommendations: string[];
  aiGenerated: boolean;
};

const schema = z.object({
  from: z.string().min(4),
  to: z.string().min(4),
  source: z.enum(["all", "own", "demo"]).default("all"),
  horizon: z.number().int().min(3).max(14).default(7),
});

export const buildForecast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }): Promise<ForecastResult> => {
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

    const measurements = (rows ?? []) as unknown as Measurement[];
    const daily = toDailyPoints(
      measurements.map((r) => ({
        ...r,
        rms_uv: Number(r.rms_uv),
        peak_uv: Number(r.peak_uv),
        episodes: Number(r.episodes),
        clench_seconds: Number(r.clench_seconds),
      })),
    );

    const summary = summarize(daily);
    const points = forecastDays(daily, data.horizon);
    const risk = riskLevel(points, summary);

    const fallback: ForecastResult = {
      points,
      risk,
      riskTitle: riskLabel[risk],
      summaryText:
        daily.length < 3
          ? "Для прогноза нужно хотя бы 3 ночи измерений в выбранном периоде."
          : `Средняя активность жевательных мышц — ${summary.avgRms} мкВ, эпизодов сжатия за ночь — ${summary.avgEpisodes}. Динамика за период: ${summary.trendPercent > 0 ? "+" : ""}${summary.trendPercent}%.`,
      recommendations:
        daily.length < 3
          ? ["Добавьте ещё несколько ночей измерений."]
          : [
              "Сохраняйте регулярный режим сна и фиксируйте вечерние нагрузки.",
              "Ограничьте кофеин во второй половине дня.",
              "При росте показателей обсудите защитную каппу со стоматологом.",
            ],
      aiGenerated: false,
    };

    if (daily.length < 3) return fallback;

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return fallback;

    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "google/gemini-3.8-flash",
          messages: [
            {
              role: "system",
              content:
                "Ты помогаешь исследователям анализировать данные поверхностной ЭМГ жевательных мышц (бруксизм). Отвечай ТОЛЬКО валидным JSON вида {\"summary\": string, \"risk\": \"low\"|\"moderate\"|\"high\", \"recommendations\": string[]}. Пиши по-русски, 2-3 предложения в summary, 3-4 коротких рекомендации. Не ставь диагнозов, говори об исследовательских наблюдениях.",
            },
            {
              role: "user",
              content: JSON.stringify({
                period: { from: data.from, to: data.to },
                nights: summary.nights,
                avg_rms_uv: summary.avgRms,
                max_peak_uv: summary.maxPeak,
                avg_episodes_per_night: summary.avgEpisodes,
                avg_clench_minutes: summary.avgClenchMinutes,
                trend_percent: summary.trendPercent,
                daily: daily.slice(-30),
                statistical_forecast: points,
              }),
            },
          ],
          reasoning_effort: "none",
        }),
      });

      if (!response.ok) return fallback;

      const payload = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = payload.choices?.[0]?.message?.content ?? "";
      const json = content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);
      const parsed = JSON.parse(json) as {
        summary?: string;
        risk?: RiskLevel;
        recommendations?: string[];
      };

      const aiRisk = parsed.risk === "low" || parsed.risk === "moderate" || parsed.risk === "high" ? parsed.risk : risk;

      return {
        points,
        risk: aiRisk,
        riskTitle: riskLabel[aiRisk],
        summaryText: parsed.summary?.trim() || fallback.summaryText,
        recommendations:
          parsed.recommendations?.filter((r) => typeof r === "string" && r.trim().length > 0).slice(0, 5) ??
          fallback.recommendations,
        aiGenerated: true,
      };
    } catch {
      return fallback;
    }
  });
