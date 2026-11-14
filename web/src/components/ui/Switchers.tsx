"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Languages, Moon, Sun } from "lucide-react";
import { cx } from "@/lib/format";

export function LangSwitch({ label, target, onInk = false }: { label: string; target: string; onInk?: boolean }) {
  const path = usePathname() ?? "/";
  const href = path.replace(/^\/(en|ar)(?=\/|$)/, `/${target}`);
  return (
    <Link href={href} lang={target} hrefLang={target}
      className={cx("inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium transition", onInk ? "text-on-ink hover:bg-white/10" : "text-foreground hover:bg-muted")}>
      <Languages className="size-4" aria-hidden />
      {label}
    </Link>
  );
}

export function ThemeToggle({ labels, onInk = false }: { labels: { light: string; dark: string }; onInk?: boolean }) {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => { setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light"); }, []);
  const next = theme === "dark" ? "light" : "dark";
  const toggle = () => {
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("mizan-theme", next); } catch { /* storage blocked: theme still applies for this view */ }
    setTheme(next);
  };
  return (
    <button type="button" onClick={toggle} aria-label={next === "dark" ? labels.dark : labels.light} title={next === "dark" ? labels.dark : labels.light}
      className={cx("grid size-10 cursor-pointer place-items-center rounded-lg transition", onInk ? "text-on-ink hover:bg-white/10" : "text-foreground hover:bg-muted")}>
      {theme === "dark" ? <Sun className="size-5" aria-hidden /> : <Moon className="size-5" aria-hidden />}
    </button>
  );
}
