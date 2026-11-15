import { CheckCircle2, Clock3, Gift, XCircle } from "lucide-react";
import type { AppStatus } from "@/lib/api";
import { cx } from "@/lib/format";

const STYLE: Record<AppStatus, { cls: string; Icon: typeof Clock3 }> = {
  submitted: { cls: "bg-standard-bg text-standard", Icon: Clock3 },
  approved: { cls: "bg-fast-bg text-fast", Icon: CheckCircle2 },
  offer_accepted: { cls: "bg-fast-bg text-fast", Icon: CheckCircle2 },
  offered: { cls: "bg-accent-soft text-accent", Icon: Gift },
  rejected: { cls: "bg-strict-bg text-strict", Icon: XCircle },
  offer_declined: { cls: "bg-strict-bg text-strict", Icon: XCircle },
};

/** Status is always icon + text + colour. */
export function StatusBadge({ status, label }: { status: AppStatus; label: string }) {
  const { cls, Icon } = STYLE[status];
  return (
    <span className={cx("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold", cls)}>
      <Icon className="size-4" aria-hidden />{label}
    </span>
  );
}
