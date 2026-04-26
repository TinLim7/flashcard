import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  interactive?: boolean;
}

export function Card({
  children,
  className,
  interactive = false,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-[var(--border-color)] bg-[var(--bg-card)] shadow-soft dark:shadow-soft-dark",
        interactive &&
          "cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-md active:scale-[0.98]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
