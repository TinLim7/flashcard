"use client";

import { useEffect, useMemo, useState } from "react";

import {
  Mic2,
  MoonStar,
  Monitor,
  Palette,
  Rabbit,
  Settings,
  SunMedium,
  Turtle,
  Volume2,
} from "lucide-react";

import { Card } from "@/components/ui/Card";
import { getServiceRuntimeInfo } from "@/lib/service-config";
import { settingsSections } from "@/lib/mock-data";
import { getSettingsQuote } from "@/lib/quotes";
import {
  getDefaultSpeechPreferences,
  readSpeechPreferences,
  writeSpeechPreferences,
} from "@/lib/speech";
import { useTheme } from "@/components/theme/ThemeProvider";
import type { SpeechPreferences, SpeechRatePreference } from "@/lib/speech";
import type { ThemePreference } from "@/lib/theme";

export default function SettingsPage() {
  const runtime = getServiceRuntimeInfo();
  const quote = useMemo(() => getSettingsQuote(), []);
  const { preference, resolvedTheme, setPreference } = useTheme();
  const [speechPreferences, setSpeechPreferences] = useState(getDefaultSpeechPreferences());

  useEffect(() => {
    setSpeechPreferences(readSpeechPreferences());
  }, []);

  const themeOptions: Array<{
    id: ThemePreference;
    label: string;
    hint: string;
    icon: typeof Monitor;
  }> = [
    { id: "system", label: "跟随系统", hint: "自动匹配系统深浅模式", icon: Monitor },
    { id: "light", label: "白天模式", hint: "更适合明亮环境阅读", icon: SunMedium },
    { id: "dark", label: "黑夜模式", hint: "减轻夜间眩光刺激", icon: MoonStar },
  ];
  const rateOptions: Array<{
    id: SpeechRatePreference;
    label: string;
    hint: string;
    icon: typeof Turtle;
  }> = [
    { id: "slow", label: "慢速", hint: "更适合跟读和辨音", icon: Turtle },
    { id: "normal", label: "正常", hint: "日常背词推荐", icon: Mic2 },
    { id: "fast", label: "稍快", hint: "熟词扫读更高效", icon: Rabbit },
  ];

  const updateSpeechPreferences = (patch: Partial<SpeechPreferences>) => {
    setSpeechPreferences((current) => {
      const nextPreferences = {
        ...current,
        ...patch,
      };

      writeSpeechPreferences(nextPreferences);
      return nextPreferences;
    });
  };

  const infoItems = [
    ...settingsSections
      .filter((section) => section.id !== "theme")
      .map((section) => ({
        icon: Volume2,
        iconBg: "bg-primary/10 text-primary",
        title: section.label,
        badge: section.value,
        badgeClass: "bg-primary/10 text-primary",
        desc: section.hint,
      })),
  ];

  return (
    <div className="space-y-6 md:space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Settings size={20} />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-[var(--text-main)] md:text-2xl">设置</h1>
            <p className="text-sm text-[var(--text-muted)]">偏好与系统状态</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] md:text-xs">
          <span className="rounded-full bg-[var(--bg-card)] px-2.5 py-1 text-[var(--text-muted)] md:px-3">
            数据源：{runtime.mode}
          </span>
          {runtime.isFallback ? (
            <span className="rounded-full bg-warning/10 px-2.5 py-1 text-warning md:px-3">
              {runtime.reason}
            </span>
          ) : null}
        </div>
      </div>

      <Card className="overflow-hidden divide-y divide-[var(--border-color)]">
        {infoItems.map((item, index) => (
          <div key={index} className="flex items-start gap-3 p-4 md:gap-4 md:p-5">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.iconBg}`}
            >
              <item.icon size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[var(--text-main)] md:text-base">{item.title}</h3>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold md:text-xs ${item.badgeClass}`}
                >
                  {item.badge}
                </span>
              </div>
              <p className="mt-1 text-xs leading-5 text-[var(--text-muted)] md:text-sm md:leading-6">
                {item.desc}
              </p>
            </div>
          </div>
        ))}
      </Card>

      <Card className="p-5 md:p-6">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Palette size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--text-main)] md:text-base">主题模式</h2>
            <p className="text-xs text-[var(--text-muted)]">支持跟随系统或手动固定</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {themeOptions.map((option) => {
            const Icon = option.icon;
            const isActive = preference === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setPreference(option.id)}
                className={`relative rounded-card border p-3.5 text-left transition-all md:p-4 ${
                  isActive
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-[var(--border-color)] bg-[var(--bg-card)] hover:border-primary/20"
                }`}
              >
                {isActive && (
                  <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-primary" />
                )}
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      isActive ? "bg-primary/10 text-primary" : "bg-[var(--bg-body)] text-[var(--text-muted)]"
                    }`}
                  >
                    <Icon size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[var(--text-main)]">{option.label}</div>
                    <div className="mt-0.5 text-xs text-[var(--text-muted)]">{option.hint}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-5 md:p-6">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Volume2 size={16} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--text-main)] md:text-base">朗读声音</h2>
            <p className="text-xs text-[var(--text-muted)]">
              当前：系统朗读 /
              {speechPreferences.rate === "slow"
                ? "慢速"
                : speechPreferences.rate === "fast"
                  ? "稍快"
                  : "正常"}
            </p>
          </div>
        </div>

        <div className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-muted)]">
          朗读速度
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {rateOptions.map((option) => {
            const Icon = option.icon;
            const isActive = speechPreferences.rate === option.id;

            return (
              <button
                key={option.id}
                type="button"
                onClick={() => updateSpeechPreferences({ rate: option.id })}
                className={`relative rounded-card border p-3.5 text-left transition-all md:p-4 ${
                  isActive
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-[var(--border-color)] bg-[var(--bg-card)] hover:border-primary/20"
                }`}
              >
                {isActive && (
                  <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-primary" />
                )}
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                      isActive ? "bg-primary/10 text-primary" : "bg-[var(--bg-body)] text-[var(--text-muted)]"
                    }`}
                  >
                    <Icon size={18} />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-[var(--text-main)]">{option.label}</div>
                    <div className="mt-0.5 text-xs text-[var(--text-muted)]">{option.hint}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      <div className="text-center"
      >
        <p className="text-xs italic text-[var(--text-muted)]"
        >&ldquo;{quote}&rdquo;</p>
      </div>
    </div>
  );
}
