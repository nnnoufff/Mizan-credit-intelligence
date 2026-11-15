import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, Scale } from "lucide-react";
import type { Lane } from "@/lib/api";
import { cx } from "@/lib/format";

type BtnVariant = "primary" | "secondary" | "ghost-ink";
const btnBase =
  "inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-5 text-[15px] font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-60";
const btnVariants: Record<BtnVariant, string> = {
  primary: "bg-accent text-accent-foreground hover:brightness-110 active:brightness-95",
  secondary: "border border-foreground/80 text-foreground hover:bg-foreground/5",
  "ghost-ink": "border border-white/30 text-on-ink hover:bg-white/10",
};

export function ButtonLink({ href, variant = "primary", className, children }: { href: string; variant?: BtnVariant; className?: string; children: React.ReactNode }) {
  return <Link href={href} className={cx(btnBase, btnVariants[variant], className)}>{children}</Link>;
}

export function Button({ variant = "primary", className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant }) {
  return <button {...p} className={cx(btnBase, btnVariants[variant], className)} />;
}

export function Logo({ name, tagline, onInk = false }: { name: string; tagline?: string; onInk?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className={cx("grid size-9 place-items-center rounded-xl", onInk ? "bg-gold/15 text-gold" : "bg-accent-soft text-accent")}>
        <Scale className="size-5" strokeWidth={1.8} aria-hidden />
      </span>
      <span className="flex flex-col leading-tight">
        <span className={cx("text-lg font-bold", onInk ? "text-on-ink" : "text-foreground")}>{name}</span>
        {tagline && <span className={cx("text-xs", onInk ? "text-on-ink-muted" : "text-muted-foreground")}>{tagline}</span>}
      </span>
    </span>
  );
}

const LANE_STYLE: Record<Lane, { cls: string; Icon: typeof Clock3 }> = {
  fast: { cls: "bg-fast-bg text-fast", Icon: CheckCircle2 },
  normal: { cls: "bg-standard-bg text-standard", Icon: Clock3 },
  high_risk: { cls: "bg-strict-bg text-strict", Icon: AlertTriangle },
};

/** Lane is always icon + text + colour, never colour alone. */
export function LaneBadge({ lane, label, size = "md" }: { lane: Lane; label: string; size?: "md" | "lg" }) {
  const { cls, Icon } = LANE_STYLE[lane];
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full font-semibold", cls, size === "lg" ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-[13px]")}>
      <Icon className="size-4" aria-hidden />
      {label}
    </span>
  );
}

export function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  const Icon = ok ? CheckCircle2 : AlertTriangle;
  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold", ok ? "bg-fast-bg text-fast" : "bg-strict-bg text-strict")}>
      <Icon className="size-4" aria-hidden />
      {label}
    </span>
  );
}

export function Card({ className, children, as: Tag = "section", ...rest }: { className?: string; children: React.ReactNode; as?: "section" | "div" | "article" } & React.HTMLAttributes<HTMLElement>) {
  // a caller's own padding (p-0, p-4, …) replaces the default instead of fighting it in the CSS order
  const pad = /(^|\s)p-\d/.test(className ?? "") ? "" : "p-6";
  return <Tag {...rest} className={cx("rounded-lg bg-card shadow-card ring-1 ring-border/60", pad, className)}>{children}</Tag>;
}

export function IconChip({ children, tone = "gold" }: { children: React.ReactNode; tone?: "gold" | "ink" }) {
  return (
    <span className={cx("grid size-10 shrink-0 place-items-center rounded-xl", tone === "gold" ? "bg-gradient-to-br from-accent-soft to-[#c9e6e9] text-accent dark:to-accent-soft" : "bg-white/10 text-gold")}>
      {children}
    </span>
  );
}
