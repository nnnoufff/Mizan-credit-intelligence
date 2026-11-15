"use client";
import { LogOut } from "lucide-react";
import { signOutOfficer } from "./OfficerGate";
import { cx } from "@/lib/format";

export function SignOutButton({ label, onInk = false, compact = false }: { label: string; onInk?: boolean; compact?: boolean }) {
  return (
    <button type="button" onClick={signOutOfficer} aria-label={compact ? label : undefined} title={compact ? label : undefined}
      className={cx("inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium transition",
        onInk ? "text-on-ink-muted hover:bg-white/10 hover:text-on-ink" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>
      <LogOut className="size-4 rtl:-scale-x-100" aria-hidden />
      {!compact && label}
    </button>
  );
}
