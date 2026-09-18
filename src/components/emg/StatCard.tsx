import type { LucideIcon } from "lucide-react";

export function StatCard({
  icon: Icon,
  label,
  value,
  unit,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  unit?: string;
  hint?: string;
}) {
  return (
    <div className="panel p-5">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs tracking-wide uppercase">{label}</span>
        <Icon className="size-4 text-primary" />
      </div>
      <p className="mt-3 font-display text-2xl font-semibold">
        {value}
        {unit ? <span className="ml-1 text-sm text-muted-foreground">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
