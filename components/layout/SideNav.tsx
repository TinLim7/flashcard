"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navItems } from "./nav-data";

export default function SideNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 top-0 z-50 hidden w-[80px] flex-col items-center border-r border-[var(--border-color)] bg-[var(--bg-card)] py-8 md:flex">
      <div className="flex w-full flex-col space-y-8">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/app" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`group relative flex w-full flex-col items-center justify-center space-y-[6px] transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-[var(--text-muted)] hover:text-primary/80"
              }`}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 h-8 w-1 -translate-y-1/2 rounded-r-md bg-primary" />
              )}
              <item.icon
                className="h-[24px] w-[24px]"
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className="text-xs font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
