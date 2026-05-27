import type { ReactNode } from "react";
import { Info } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  accent,
  bar,
  info,
  children,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: "success" | "warn" | "crit" | "accent";
  bar?: number;
  info?: string;
  children?: ReactNode;
}) {
  const accentColor =
    accent === "success"
      ? "bg-success"
      : accent === "warn"
        ? "bg-warn"
        : accent === "crit"
          ? "bg-crit"
          : "bg-accent";

  const valueColor =
    accent === "success"
      ? "text-success"
      : accent === "warn"
        ? "text-warn"
        : accent === "crit"
          ? "text-crit"
          : accent === "accent"
            ? "text-accent"
            : "text-foreground";

  return (
    <div className="bg-card p-6 rounded-xl border shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
          {label}
        </p>
        {info ? (
          <span
            title={info}
            className="text-muted-foreground hover:text-accent cursor-help"
            aria-label={info}
          >
            <Info className="size-3.5" />
          </span>
        ) : null}
      </div>
      <div className={`text-3xl font-bold ${valueColor}`}>{value}</div>
      {hint ? <p className="text-xs text-muted-foreground mt-2">{hint}</p> : null}
      {typeof bar === "number" ? (
        <div className="mt-3 h-1.5 w-full bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full ${accentColor}`}
            style={{ width: `${Math.min(100, Math.max(0, bar))}%` }}
          />
        </div>
      ) : null}
      {children}
    </div>
  );
}
