import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Activity, ArrowLeft, Loader2, MailCheck, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { verifyPasswordFactor } from "@/lib/auth.functions";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Вход с двухфакторной защитой — Bruxa Research" },
      {
        name: "description",
        content:
          "Вход в исследовательскую панель Bruxa: пароль и одноразовый код на электронную почту.",
      },
      { property: "og:title", content: "Вход с двухфакторной защитой — Bruxa Research" },
      { property: "og:description", content: "Пароль плюс одноразовый код на почту." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const verifyPassword = useServerFn(verifyPasswordFactor);

  const [step, setStep] = useState<"credentials" | "code">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [signupDone, setSignupDone] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleCredentials(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await verifyPassword({ data: { email: email.trim(), password } });
      if (!result.ok) {
        toast.error(
          result.reason === "unconfirmed"
            ? "Почта ещё не подтверждена. Откройте письмо о регистрации."
            : "Неверная почта или пароль.",
        );
        return;
      }

      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth` },
      });
      if (error) {
        toast.error("Не удалось отправить код: " + error.message);
        return;
      }

      setStep("code");
      toast.success("Код второго фактора отправлен на почту");
    } finally {
      setBusy(false);
    }
  }

  async function handleCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim(),
        token: code.trim(),
        type: "email",
      });
      if (error) {
        toast.error("Код не подошёл. Проверьте письмо или запросите новый код.");
        return;
      }
      toast.success("Вход выполнен");
      await navigate({ to: "/dashboard", replace: true });
    } finally {
      setBusy(false);
    }
  }

  async function handleSignUp(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth` },
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setSignupDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-6">
        <Link to="/" className="flex items-center gap-2">
          <Activity className="size-5 text-primary" />
          <span className="font-display font-semibold">Bruxa Research</span>
        </Link>
        <Button asChild variant="ghost" size="sm">
          <Link to="/">
            <ArrowLeft className="size-4" /> На главную
          </Link>
        </Button>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 pb-16">
        <div className="panel p-7">
          {step === "code" ? (
            <form onSubmit={handleCode} className="space-y-5">
              <div className="flex items-center gap-2 text-primary">
                <ShieldCheck className="size-5" />
                <h1 className="text-xl font-semibold">Второй фактор</h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Мы отправили письмо на <span className="text-foreground">{email}</span>. Введите
                6-значный код из письма — или откройте ссылку в этом письме, чтобы завершить вход.
              </p>
              <div className="space-y-2">
                <Label htmlFor="code">Код из письма</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  className="text-center text-lg tracking-[0.4em]"
                />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : null} Подтвердить вход
              </Button>
              <button
                type="button"
                className="w-full text-sm text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setStep("credentials");
                  setCode("");
                }}
              >
                Ввести почту и пароль заново
              </button>
            </form>
          ) : signupDone ? (
            <div className="space-y-4 text-center">
              <MailCheck className="mx-auto size-8 text-primary" />
              <h1 className="text-xl font-semibold">Подтвердите почту</h1>
              <p className="text-sm text-muted-foreground">
                Мы отправили письмо на {email}. Перейдите по ссылке из письма, затем войдите с
                паролем и одноразовым кодом.
              </p>
              <Button variant="secondary" className="w-full" onClick={() => setSignupDone(false)}>
                Вернуться к входу
              </Button>
            </div>
          ) : (
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Вход</TabsTrigger>
                <TabsTrigger value="signup">Регистрация</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-6">
                <h1 className="text-xl font-semibold">Вход в панель исследования</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  Шаг 1 из 2: пароль. Затем придёт одноразовый код на почту.
                </p>
                <form onSubmit={handleCredentials} className="mt-5 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Электронная почта</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Пароль</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : null} Продолжить
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup" className="mt-6">
                <h1 className="text-xl font-semibold">Регистрация исследователя</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  После подтверждения почты вход всегда будет в два шага.
                </p>
                <form onSubmit={handleSignUp} className="mt-5 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-up">Электронная почта</Label>
                    <Input
                      id="email-up"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password-up">Пароль</Label>
                    <Input
                      id="password-up"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? <Loader2 className="size-4 animate-spin" /> : null} Создать аккаунт
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </main>
    </div>
  );
}
