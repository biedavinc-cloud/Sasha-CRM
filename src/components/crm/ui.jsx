import React from "react";
import { cn } from "@/lib/utils";
import { TONE_CLASSES } from "@/lib/format";

export function StatCard({ label, value, sublabel, icon: Icon, tone = "brand" }) {
  const toneBg = {
    brand: "bg-brand/10 text-brand",
    soft: "bg-brand-soft/30 text-brand-dark",
    neutral: "bg-muted text-muted-foreground",
  }[tone];
  return (
    <div className="bg-card rounded-2xl p-5 card-shadow border border-border/60 animate-fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-semibold mt-1.5 text-foreground truncate">{value}</p>
          {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
        </div>
        {Icon && (
          <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center shrink-0", toneBg)}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function StatusBadge({ status, map }) {
  const entry = map?.[status] || { label: status, tone: "neutral" };
  return (
    <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize", TONE_CLASSES[entry.tone] || TONE_CLASSES.neutral)}>
      {entry.label}
    </span>
  );
}

export function EmptyState({ title = "Nothing here yet", description, icon: Icon, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Icon className="h-7 w-7 text-muted-foreground" />
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Card({ className, children }) {
  return <div className={cn("bg-card rounded-2xl border border-border/60 card-shadow", className)}>{children}</div>;
}

export function Spinner({ label }) {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-7 h-7 border-[3px] border-brand-soft border-t-brand rounded-full animate-spin" />
      {label && <span className="ml-3 text-sm text-muted-foreground">{label}</span>}
    </div>
  );
}

export function Th({ children, className }) {
  return <th className={cn("text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-4 py-3", className)}>{children}</th>;
}

export function Td({ children, className }) {
  return <td className={cn("px-4 py-3 text-sm text-foreground", className)}>{children}</td>;
}