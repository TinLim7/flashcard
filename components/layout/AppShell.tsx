"use client";

import { usePathname } from "next/navigation";

import BackButton from "@/components/navigation/BackButton";
import { getPageBackFallbackHref } from "@/lib/routes";

import BottomNav from "./BottomNav";
import SideNav from "./SideNav";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isAuthPage = pathname?.startsWith("/login");
  const isImmersivePage = pathname === "/" || pathname?.startsWith("/study") || pathname?.startsWith("/landing");
  const isWidePage = pathname?.startsWith("/decks") || pathname?.startsWith("/import");
  const maxWidthClass = isWidePage ? "max-w-[1100px]" : "max-w-[720px]";
  const fallbackHref = getPageBackFallbackHref(pathname);
  const shellVersion = "20260331-v3";

  if (isAuthPage) {
    return (
      <main className="min-h-screen bg-[var(--bg-body)]" data-shell-version={shellVersion}>
        {children}
      </main>
    );
  }

  if (isImmersivePage) {
    return (
      <main className="min-h-screen bg-[var(--bg-body)]" data-shell-version={shellVersion}>
        {children}
      </main>
    );
  }

  return (
    <div
      className="flex min-h-screen flex-col bg-[var(--bg-body)] md:flex-row"
      data-shell-version={shellVersion}
    >
      <SideNav />

      <main className="flex-1 pb-[64px] md:pl-[80px] md:pb-0">
        <div className={`mx-auto h-full w-full p-4 md:p-8 ${maxWidthClass}`}>
          <div className="mb-4">
            <BackButton fallbackHref={fallbackHref} />
          </div>
          {children}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
