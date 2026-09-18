import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Activity,
  BrainCircuit,
  Gauge,
  LogOut,
  Loader2,
  Timer,
  TrendingUp,
  Trash2,
  Zap,
} from "lucide-react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { AddMeasurementDialog } from "@/components/emg/AddMeasurementDialog";
import { StatCard } from "@/components/emg/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { deleteMeasurement, listMeasurements } from "@/lib/emg.functions";
import { buildForecast } from "@/lib/forecast.functions";
import { formatDay, summarize, toDailyPoints } from "@/lib/analytics";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Данные ЭМГ и прогнозы — Bruxa Research" },
      {
        name: "description",
        content:
          "Панель исследователя: электрическая активность жевательных мышц за выбранный период и ИИ-прогноз риска бруксизма.",
      },
      { property: "og:title", content: "Данные ЭМГ и прогнозы — Bruxa Research" },
      {
        property: "og:description",
        content: "Активность жевательных мышц за период и ИИ-прогноз риска бруксизма.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard;
});

type Source = "all" | "own" | "demo";

const sideLabels: Record<string, string> = {
  both: "Обе",
  left: "Левая",
  right: "Правая",
};

function isoDaysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchMeasurements = useServerFn(listMeasurements);
  const fetchForecast = useServerFn(buildForecast);
  const removeMeasurement = useServerFn(deleteMeasurement);

  const [from, setFrom] = useState(() => isoDaysAgo(30));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [source, setSource] = useState<Source>("all");
  const [horizon, setHorizon] = useState(7);

  const range = useMemo(
    () => ({ from: `${from}T00:00:00.000Z`, to: `${to}T23:59:59.999Z`, source }),
    [from, to, source],
  );

  const measurementsQuery = useQuery({
    queryKey: ["measurements", range],
    queryFn: () => fetchMeasurements({ data: range }),
  });

  const forecastQuery = useQuery({
    queryKey: ["forecast", range, horizon],
    queryFn: () => fetchForecast({ data: { ...range, horizon } }),
  });

  const rows = measurementsQuery.data ?? [];
  const daily = useMemo(() => toDailyPoints(rows), [rows]);
  const summary = useMemo(() => summarize(daily), [daily]);
  const forecast = forecastQuery.data;

  const chartData = useMemo(() => {
    const history = daily.map((point) => ({
      day: point.day,
      label: formatDay(point.day),
      rms: point.rms_uv,
      peak: point.peak_uv,
      episodes: point.episodes,
      forecast: null as number | null,
      band: null as [number, number] | null,
    }));

    const tail = (forecast?.points ?? []).map((point) => ({
      day: point.day,
      label: formatDay(point.day),
      rms: null as number | null,
      peak: null as number | null,
      episodes: point.episodes,
      forecast: point.rms_uv,
      band: [point.low, point.high] as [number, number],
    }));

    const last = history[history.length - 1];
    if (last && tail.length > 0) {
      return [...history.slice(0, -1), { ...last, forecast: last.rms, band: [last.rms, last.rms] as [number, number] }, ...tail];
    }
    return [...history, ...tail];
  }, [daily, forecast]);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", replace: true });
  }

  async function handleDelete(id: string) {
    try {
      await removeMeasurement({ data: { id } });
      toast.success("Запись удалена");
      await queryClient.invalidateQueries();
    } catch (error) {
      toast.error("Не удалось удалить: " + (error as Error).message);
    }
  }

  const riskTone =
    forecast?.risk === "high"
      ? "text-destructive"
      : forecast?.risk === "moderate"
        ? "text-warning"
        : "text-success";

  return (
    <div className="min-h-screen">
      <header className="border-b border-border/70 bg-surface/40 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-2">
            <Activity className="size-5 text-primary" />
            <span className="font-display font-semibold">Bruxa Research</span>
          </div>
          <div className="flex items-center gap-2">
            <AddMeasurementDialog onSaved={() => void queryClient.invalidateQueries()} />
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="size-4" /> Выйти
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-5 py-8">
        <section className="panel flex flex-wrap items-end gap-4 p-5">
          <div className="space-y-2">
            <Label htmlFor="from">Начало периода</Label>
            <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to">Конец периода</Label>
            <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Источник данных</Label>
            <Select value={source} onValueChange={(value) => setSource(value as Source)}>
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все записи</SelectItem>
                <SelectItem value="own">Только мои</SelectItem>
                <SelectItem value="demo">Демонстрационные</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Горизонт прогноза</Label>
            <Select value={String(horizon)} onValueChange={(value) => setHorizon(Number(value))}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 дня</SelectItem>
                <SelectItem value="7">7 дней</SelectItem>
                <SelectItem value="14">14 дней</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto flex flex-wrap gap-2">
            {[7, 30, 90].map((days) => (
              <Button
                key={days}
                variant="secondary"
                size="sm"
                onClick={() => {
                  setFrom(isoDaysAgo(days));
                  setTo(new Date().toISOString().slice(0, 10));
                }}
              >
                {days} дней
              </Button>
            ))}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard icon={Gauge} label="Ночей в периоде" value={summary.nights} />
          <StatCard icon={Activity} label="Средняя активность" value={summary.avgRms} unit="мкВ" />
          <StatCard icon={Zap} label="Максимум" value={summary.maxPeak} unit="мкВ" />
          <StatCard icon={Timer} label="Эпизоды за ночь" value={summary.avgEpisodes} />
          <StatCard
            icon={TrendingUp}
            label="Динамика"
            value={`${summary.trendPercent > 0 ? "+" : ""}${summary.trendPercent}`}
            unit="%"
            hint="первая половина периода против второй"
          />
        </section>

        <section className="panel p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Активность жевательных мышц и прогноз</h2>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {measurementsQuery.isFetching ? <Loader2 className="size-3 animate-spin" /> : null}
              мкВ · среднеквадратичное значение сигнала за ночь
            </div>
          </div>

          {daily.length === 0 ? (
            <p className="py-16 text-center text-sm text-muted-foreground">
              За выбранный период данных нет. Измените период или добавьте измерения.
            </p>
          ) : (
            <div className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rmsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                    tickMargin={8}
                    minTickGap={16}
                  />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      color: "var(--color-popover-foreground)",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="band"
                    name="Доверительный интервал"
                    stroke="none"
                    fill="var(--color-warning)"
                    fillOpacity={0.14}
                    connectNulls
                  />
                  <Area
                    type="monotone"
                    dataKey="rms"
                    name="Факт, мкВ"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    fill="url(#rmsFill)"
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    name="Прогноз, мкВ"
                    stroke="var(--color-warning)"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="episodes"
                    name="Эпизоды сжатия"
                    stroke="var(--color-chart-3)"
                    strokeWidth={1.5}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <div className="panel p-5">
            <div className="flex items-center gap-2">
              <BrainCircuit className="size-5 text-primary" />
              <h2 className="text-lg font-semibold">ИИ-прогноз</h2>
              {forecast?.aiGenerated ? (
                <Badge variant="secondary" className="ml-auto">
                  анализ ИИ
                </Badge>
              ) : null}
            </div>

            {forecastQuery.isPending ? (
              <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Считаем прогноз…
              </p>
            ) : forecast ? (
              <>
                <p className={`mt-4 font-display text-xl font-semibold ${riskTone}`}>
                  {forecast.riskTitle}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{forecast.summaryText}</p>

                {forecast.points.length > 0 ? (
                  <>
                    <Separator className="my-4" />
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {forecast.points.map((point) => (
                        <div key={point.day} className="rounded-lg border border-border bg-surface/50 p-3">
                          <p className="text-xs text-muted-foreground">{formatDay(point.day)}</p>
                          <p className="font-display text-lg font-semibold">{point.rms_uv} мкВ</p>
                          <p className="text-xs text-muted-foreground">
                            {point.low}–{point.high} мкВ · {point.episodes} эпиз.
                          </p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}

                <Separator className="my-4" />
                <ul className="space-y-2 text-sm">
                  {forecast.recommendations.map((item) => (
                    <li key={item} className="flex gap-2 text-muted-foreground">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-6 text-sm text-muted-foreground">Прогноз недоступен для этого периода.</p>
            )}
          </div>

          <div className="panel p-5">
            <h2 className="text-lg font-semibold">Записи периода</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Всего измерений: {rows.length}. Удалять можно только свои записи.
            </p>
            <div className="mt-4 max-h-[420px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="pb-2">Дата</th>
                    <th className="pb-2">Сторона</th>
                    <th className="pb-2">Сред.</th>
                    <th className="pb-2">Макс.</th>
                    <th className="pb-2">Эпиз.</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {[...rows].reverse().map((row) => (
                    <tr key={row.id} className="border-t border-border/60">
                      <td className="py-2">
                        {new Date(row.measured_at).toLocaleString("ru-RU", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="py-2">{sideLabels[row.side] ?? row.side}</td>
                      <td className="py-2">{row.rms_uv}</td>
                      <td className="py-2">{row.peak_uv}</td>
                      <td className="py-2">{row.episodes}</td>
                      <td className="py-2 text-right">
                        {row.user_id ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => void handleDelete(row.id)}
                            aria-label="Удалить запись"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">демо</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <p className="pb-6 text-center text-xs text-muted-foreground">
          Прогнозы носят исследовательский характер и не являются медицинским заключением.
        </p>
      </main>
    </div>
  );
}
