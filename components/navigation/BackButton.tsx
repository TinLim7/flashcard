"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  fallbackHref: string;
  className?: string;
  label?: string;
  onBeforeBack?: () => void;
}

export default function BackButton({
  fallbackHref,
  className,
  label = "返回",
  onBeforeBack,
}: BackButtonProps) {
  const router = useRouter();

  const handleBack = () => {
    onBeforeBack?.();

    if (typeof window === "undefined") {
      router.replace(fallbackHref);
      return;
    }

    const hasSameOriginReferrer =
      document.referrer.length > 0 &&
      (() => {
        try {
          return new URL(document.referrer).origin === window.location.origin;
        } catch {
          return false;
        }
      })();

    if (hasSameOriginReferrer) {
      router.back();
      return;
    }

    router.replace(fallbackHref);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleBack}
      className={cn("w-fit rounded-full px-3 text-[var(--text-main)]", className)}
    >
      <ChevronLeft className="mr-1" size={16} />
      {label}
    </Button>
  );
}
