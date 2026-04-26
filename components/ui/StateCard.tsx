import { AlertTriangle, Inbox, LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

type StateTone = "loading" | "empty" | "error";

const toneMap = {
  loading: {
    icon: LoaderCircle,
    titleClassName: "text-primary",
    iconClassName: "animate-spin text-primary",
  },
  empty: {
    icon: Inbox,
    titleClassName: "text-[var(--text-main)]",
    iconClassName: "text-[var(--text-muted)]",
  },
  error: {
    icon: AlertTriangle,
    titleClassName: "text-danger",
    iconClassName: "text-danger",
  },
};

interface StateCardProps {
  tone: StateTone;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
  quote?: string;
}

export function StateCard({
  tone,
  title,
  description,
  action,
  className,
  quote,
}: StateCardProps) {
  const Icon = toneMap[tone].icon;

  return (
    <div
      className={cn(
        "rounded-card border border-dashed border-[var(--border-color)] bg-[var(--bg-card)] p-6 text-center shadow-soft dark:shadow-soft-dark",
        className,
      )}
    >
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--bg-body)]">
        <Icon className={cn("h-6 w-6", toneMap[tone].iconClassName)} />
      </div>
      <h3 className={cn("text-lg font-bold", toneMap[tone].titleClassName)}>{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">{description}</p>
      {quote ? (
        <p className="mt-3 text-xs italic text-[var(--text-muted)]">&ldquo;{quote}&rdquo;</p>
      ) : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
