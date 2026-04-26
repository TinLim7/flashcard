import type { Metadata, Viewport } from "next";
import { Suspense } from "react";

import AuthBoundary from "@/components/auth/AuthBoundary";
import AppShell from "@/components/layout/AppShell";
import PwaRegistrar from "@/components/pwa/PwaRegistrar";
import ThemeProvider from "@/components/theme/ThemeProvider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Flashcard | 专注记忆",
  description: "沉浸、清爽、轻压力的跨端闪卡记忆工具",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-maskable.svg", type: "image/svg+xml", sizes: "any" },
    ],
    apple: [{ url: "/icon.svg" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Flashcard",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F6F8FA" },
    { media: "(prefers-color-scheme: dark)", color: "#0D1117" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="flex min-h-screen flex-col font-sans" data-build-tag="20260331-v2">
        <ThemeProvider>
          <PwaRegistrar />
          <Suspense fallback={null}>
            <AuthBoundary>
              <AppShell>{children}</AppShell>
            </AuthBoundary>
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
