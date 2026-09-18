import type { Measurement } from "./emg.functions";

export type DailyPoint = {
  day: string;
  rms_uv: number;
  peak_uv: number;
  episodes: number;
  clench_seconds: number;
};

export type ForecastPoint = {
  day: string;
  rms_uv: number;
  episodes: number;
  low: number;
  high: number;
};

export function toDailyPoints(rows: Measurement[]): DailyPoint[] {
  const buckets = new Map<string, Measurement[]>();
  for (const row of rows) {
    const day = row.measured_at.slice(0, 10);
    const list = buckets.get(day);
    if (list) list.push(row);
    else buckets.set(day, [row]);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, list]) => ({
      day,
      rms_uv: round(avg(list.map((r) => r.rms_uv))),
      peak_uv: round(Math.max(...list.map((r) => r.peak_uv))),
      episodes: round(avg(list.map((r) => r.episodes))),
      clench_seconds: round(avg(list.map((r) => r.clench_seconds))),
    }));
}

export type Summary = {
  nights: number;
  avgRms: number;
  maxPeak: number;
  avgEpisodes: number;
  avgClenchMinutes: number;
  trendPercent: number;
};

export function summarize(daily: DailyPoint[]): Summary {
  if (daily.length === 0) {
    return { nights: 0, avgRms: 0, maxPeak: 0, avgEpisodes: 0, avgClenchMinutes: 0, trendPercent: 0 };
  }

  const half = Math.max(1, Math.floor(daily.length / 2));
  const first = avg(daily.slice(0, half).map((d) => d.rms_uv));
  const last = avg(daily.slice(-half).map((d) => d.rms_uv));

  return {
    nights: daily.length,
    avgRms: round(avg(daily.map((d) => d.rms_uv))),
    maxPeak: round(Math.max(...daily.map((d) => d.peak_uv))),
    avgEpisodes: round(avg(daily.map((d) => d.episodes))),
    avgClenchMinutes: round(avg(daily.map((d) => d.clench_seconds)) / 60),
    trendPercent: first > 0 ? round(((last - first) / first) * 100) : 0,
  };
}

/** Линейный тренд по методу наименьших квадратов + прогноз на N дней вперёд. */
export function forecastDays(daily: DailyPoint[], days = 7): ForecastPoint[] {
  if (daily.length < 3) return [];

  const rms = regression(daily.map((d, i) => [i, d.rms_uv] as const));
  const eps = regression(daily.map((d, i) => [i, d.episodes] as const));
  const residuals = daily.map((d, i) => d.rms_uv - (rms.a + rms.b * i));
  const sigma = Math.sqrt(avg(residuals.map((r) => r * r))) || 1;

  const lastDay = new Date(`${daily[daily.length - 1]!.day}T00:00:00Z`);
  const out: ForecastPoint[] = [];

  for (let k = 1; k <= days; k += 1) {
    const x = daily.length - 1 + k;
    const value = Math.max(0, rms.a + rms.b * x);
    const next = new Date(lastDay);
    next.setUTCDate(next.getUTCDate() + k);
    out.push({
      day: next.toISOString().slice(0, 10),
      rms_uv: round(value),
      episodes: Math.max(0, round(eps.a + eps.b * x)),
      low: round(Math.max(0, value - 1.4 * sigma)),
      high: round(value + 1.4 * sigma),
    });
  }

  return out;
}

export type RiskLevel = "low" | "moderate" | "high";

export function riskLevel(forecast: ForecastPoint[], summary: Summary): RiskLevel {
  if (forecast.length === 0) return "low";
  const peakForecast = Math.max(...forecast.map((f) => f.rms_uv));
  const episodes = Math.max(...forecast.map((f) => f.episodes));
  const score =
    (peakForecast > 90 ? 2 : peakForecast > 65 ? 1 : 0) +
    (episodes > 32 ? 2 : episodes > 22 ? 1 : 0) +
    (summary.trendPercent > 12 ? 1 : 0);

  if (score >= 4) return "high";
  if (score >= 2) return "moderate";
  return "low";
}

export const riskLabel: Record<RiskLevel, string> = {
  low: "Низкий риск",
  moderate: "Умеренный риск",
  high: "Высокий риск",
};

function regression(points: ReadonlyArray<readonly [number, number]>) {
  const n = points.length;
  const meanX = avg(points.map(([x]) => x));
  const meanY = avg(points.map(([, y]) => y));
  let num = 0;
  let den = 0;
  for (const [x, y] of points) {
    num += (x - meanX) * (y - meanY);
    den += (x - meanX) ** 2;
  }
  const b = den === 0 ? 0 : num / den;
  return { a: meanY - b * meanX, b };
}

function avg(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

export function formatDay(day: string) {
  const date = new Date(`${day}T00:00:00Z`);
  return date.toLocaleDateString("ru-RU", { day: "2-digit", month: "short", timeZone: "UTC" });
}
