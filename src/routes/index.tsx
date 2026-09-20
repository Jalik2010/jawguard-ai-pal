import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bruxa — ЭМГ жевательных мышц и ИИ-прогнозы бруксизма" },
      {
        name: "description",
        content:
          "Исследовательская платформа: электрическая активность жевательных мышц за выбранный период и ИИ-прогнозы риска бруксизма.",
      },
      { property: "og:title", content: "Bruxa — ЭМГ жевательных мышц и ИИ-прогнозы бруксизма" },
      {
        property: "og:description",
        content: "Данные ЭМГ за период и ИИ-прогнозы риска бруксизма.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-5 py-6">
        <span className="font-display text-lg font-semibold">Bruxa Research</span>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="secondary" size="sm">
            <Link to={signedIn ? "/dashboard" : "/auth"}>
              {signedIn ? "Открыть панель" : "Войти"}
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-5 pb-20">
        <h1 className="text-4xl leading-[1.05] font-semibold sm:text-5xl">
          Электрическая активность жевательных мышц
        </h1>
        <div className="mt-8">
          <Button asChild size="lg">
            <Link to={signedIn ? "/dashboard" : "/auth"}>Смотреть данные</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
