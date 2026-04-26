"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navItems } from "./nav-data";

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex h-[64px] items-center justify-around border-t border-[var(--border-color)] bg-[var(--bg-card)] pb-[env(safe-area-inset-bottom)] md:hidden">
      {navItems.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/app" && pathname.startsWith(item.href));

        return (
          <Link
            key={item.name}
            href={item.href}
            className={`flex h-full w-full flex-col items-center justify-center space-y-1 transition-colors ${
              isActive ? "text-primary" : "text-[var(--text-muted)]"
            }`}
          >
            <item.icon
              className="h-[22px] w-[22px]"
              strokeWidth={isActive ? 2.5 : 2}
            />
            <span className="text-[10px] font-medium leading-none">{item.name}</span>
          </Link>
        );
      })}
    </nav>
  );
}
