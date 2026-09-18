import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, BrainCircuit, CalendarRange, ShieldCheck } from "lucide-react";

import heroImage from "@/assets/hero-emg.jpg";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bruxa — ЭМГ жевательных мышц и ИИ-прогнозы бруксизма" },
      {
        name: "description",
        content:
          "Исследовательская платформа с двухфакторным входом: электрическая активность жевательных мышц за выбранный период, статистика ночей и ИИ-прогнозы риска бруксизма.",
      },
      { property: "og:title", content: "Bruxa — ЭМГ жевательных мышц и ИИ-прогнозы бруксизма" },
      {
        property: "og:description",
        content: "Данные ЭМГ за период, статистика ночей и ИИ-прогнозы риска бруксизма.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: CalendarRange,
    title: "Данные за любой период",
    text: "Выберите интервал дат — платформа покажет среднюю и пиковую активность мышц, эпизоды сжатия и суммарное время напряжения по ночам.",
  },
  {
    icon: BrainCircuit,
    title: "ИИ-прогнозы",
    text: "Числовой прогноз активности на ближайшие дни и оценка риска бруксизма с пояснением и рекомендациями.",
  },
  {
    icon: ShieldCheck,
    title: "Двухфакторный вход",
    text: "Пароль плюс одноразовый код на почту. Записи каждого исследователя видны только ему.",
  },
];

function Landing() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
  }, []);

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6">
        <div className="flex items-center gap-2">
          <Activity className="size-6 text-primary" />
          <span className="font-display text-lg font-semibold">Bruxa Research</span>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link to={signedIn ? "/dashboard" : "/auth"}>{signedIn ? "Открыть панель" : "Войти"}</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-24">
        <section className="grid items-center gap-10 py-10 lg:grid-cols-[1.05fr_1fr] lg:py-16">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-xs tracking-wide text-muted-foreground uppercase">
              Исследование бруксизма · поверхностная ЭМГ
            </p>
            <h1 className="text-4xl leading-[1.05] font-semibold sm:text-5xl lg:text-6xl">
              Электрическая активность <span className="text-signal">жевательных мышц</span> под
              наблюдением
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              Платформа собирает ночные записи ЭМГ, показывает динамику за выбранный период и строит
              ИИ-прогноз активности и риска бруксизма на ближайшие дни.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to={signedIn ? "/dashboard" : "/auth"}>
                  {signedIn ? "Перейти к данным" : "Начать исследование"}
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#how">Как это работает</a>
              </Button>
            </div>
          </div>

          <div className="panel overflow-hidden">
            <img
              src={heroImage}
              alt="Схема жевательной мышцы и сигналы ЭМГ"
              width={1536}
              height={1024}
              className="h-full w-full object-cover opacity-90"
            />
          </div>
        </section>

        <section id="how" className="grid gap-4 md:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title} className="panel p-6">
              <Icon className="size-6 text-primary" />
              <h2 className="mt-4 text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </section>

        <section className="panel grid-lines mt-16 p-8 text-center">
          <h2 className="text-2xl font-semibold sm:text-3xl">Демонстрационные записи уже внутри</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-muted-foreground">
            В системе есть 90 ночей демонстрационных измерений — можно сразу посмотреть графики и
            прогнозы, а затем добавить свои данные вручную или списком.
          </p>
          <div className="mt-6">
            <Button asChild size="lg">
              <Link to={signedIn ? "/dashboard" : "/auth"}>Смотреть данные</Link>
            </Button>
          </div>
        </section>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Платформа предназначена для исследовательских задач и не заменяет консультацию врача.
        </p>
      </main>
    </div>
  );
}
