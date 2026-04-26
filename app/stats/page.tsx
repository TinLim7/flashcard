"use client";

import { useEffect, useMemo, useState } from "react";

import { BarChart3, Brain, Clock, Target, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { StateCard } from "@/components/ui/StateCard";
import { getStatsPageData } from "@/lib/data-service";
import type { StatsHighlight, WeakCardStat, WeeklyActivityPoint } from "@/lib/types";

export default function StatsPage() {
  const [highlights, setHighlights] = useState<StatsHighlight[]>([]);
  const [activity, setActivity] = useState<WeeklyActivityPoint[]>([]);
  const [weakCards, setWeakCards] = useState<WeakCardStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);
  const [dataMode, setDataMode] = useState<"mock" | "cloudflare">("mock");

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const result = await getStatsPageData();

      if (!isMounted) {
        return;
      }

      setHighlights(result.highlights);
      setActivity(result.weeklyActivity);
      setWeakCards(result.weakCards);
      setIsFallback(result.isFallback);
      setDataMode(result.dataMode);
      setIsLoading(false);
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const chartStats = useMemo(() => {
    if (activity.length === 0) {
      return { peak: 1, avg: 0, total: 0, peakDay: "-" };
    }
    const counts = activity.map((a) => a.count);
    const peak = Math.max(...counts);
    const total = counts.reduce((a, b) => a + b, 0);
    const avg = Math.round(total / counts.length);
    const peakItem = activity.find((a) => a.count === peak);
    return { peak, avg, total, peakDay: peakItem?.day ?? "-" };
  }, [activity]);

  const maxWeakRating = useMemo(() => {
    if (weakCards.length === 0) return 1;
    return Math.max(...weakCards.map((c) => c.lowRatingCount));
  }, [weakCards]);

  if (isLoading) {
    return (
      <StateCard
        tone="loading"
        title="正在整理学习统计"
        description="正在汇总近 7 日复习量、评分质量和高频失误卡。"
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <BarChart3 size={20} />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-[var(--text-main)]">学习统计</h1>
            <p className="text-sm text-[var(--text-muted)]">近 7 日数据概览</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-[var(--bg-card)] px-3 py-1 text-[var(--text-muted)]">
            数据源：{dataMode}
          </span>
          {isFallback ? (
            <span className="rounded-full bg-warning/10 px-3 py-1 text-warning">
              云端不可用，已回退 mock
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {highlights.map((item) => {
          const isAccuracy = item.label.includes("正确") || item.label.includes("达标") || item.label.includes("率");
          const isDuration = item.label.includes("时长") || item.label.includes("时间");

          const Icon = isAccuracy ? Target : isDuration ? Clock : TrendingUp;
          const colorClass = isAccuracy
            ? "bg-primary/10 text-primary"
            : isDuration
              ? "bg-warning/10 text-warning"
              : "bg-success/10 text-success";

          return (
            <Card key={item.label} className="flex items-center gap-4 p-5">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${colorClass}`}>
                <Icon size={22} />
              </div>
              <div className="min-w-0">
                <div className="text-sm text-[var(--text-muted)]">{item.label}</div>
                <div className="font-display text-3xl font-bold text-[var(--text-main)]">{item.value}</div>
                <div className="text-xs text-[var(--text-muted)]">{item.hint}</div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-6">
        <div className="mb-6">
          <h2 className="flex items-center gap-2 font-bold text-[var(--text-main)]">
            <BarChart3 size={18} className="text-primary" />
            最近 7 日复习热度
          </h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">按最近 7 日的评分记录绘制趋势柱状图。</p>
        </div>

        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-[var(--bg-body)] p-3 text-center">
            <div className="text-xs text-[var(--text-muted)]">平均每日</div>
            <div className="mt-1 font-display text-lg font-bold text-[var(--text-main)]">{chartStats.avg} 张</div>
          </div>
          <div className="rounded-2xl bg-[var(--bg-body)] p-3 text-center">
            <div className="text-xs text-[var(--text-muted)]">最高纪录</div>
            <div className="mt-1 font-display text-lg font-bold text-primary">
              {chartStats.peak} 张
            </div>
          </div>
          <div className="rounded-2xl bg-[var(--bg-body)] p-3 text-center">
            <div className="text-xs text-[var(--text-muted)]">7 日总计</div>
            <div className="mt-1 font-display text-lg font-bold text-success">
              {chartStats.total} 张
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-[72px]">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-8 text-right text-[10px] text-[var(--text-muted)]">
                  {Math.round((chartStats.peak * (4 - i)) / 4)}
                </span>
                <div className="flex-1 border-t border-dashed border-[var(--border-color)] opacity-50" />
              </div>
            ))}
          </div>

          <div className="ml-10 grid grid-cols-7 items-end gap-3">
            {activity.map((item) => {
              const isPeak = item.count === chartStats.peak && chartStats.peak > 0;
              return (
                <div key={item.day} className="flex flex-col items-center gap-2">
                  <div className="flex h-44 w-full items-end rounded-2xl bg-[var(--bg-body)] p-1.5">
                    <div
                      className={`w-full rounded-lg transition-all hover:brightness-110 ${
                        isPeak
                          ? "bg-gradient-to-t from-primary to-primary/70"
                          : "bg-gradient-to-t from-primary/60 to-primary/30"
                      }`}
                      style={{ height: `${(item.count / chartStats.peak) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs font-medium text-[var(--text-muted)]">{item.day}</div>
                  <div className="font-mono text-xs font-bold text-[var(--text-main)]">{item.count}</div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {weakCards.length === 0 ? (
        <StateCard
          tone="empty"
          title="暂时没有高频失误卡"
          description="等产生更多评分记录后，这里会展示最近最容易忘记的词条。"
        />
      ) : (
        <Card className="space-y-5 p-6">
          <div>
            <h2 className="flex items-center gap-2 font-bold text-[var(--text-main)]">
              <Brain size={18} className="text-danger" />
              近期难点
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">按 Again / Hard 次数排序。</p>
          </div>
          <div className="space-y-3">
            {weakCards.map((card) => (
              <div
                key={card.cardId}
                className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-body)] p-4 transition-colors hover:border-danger/20"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-bold text-[var(--text-main)]">{card.front}</div>
                    <div className="mt-0.5 text-sm text-[var(--text-muted)]">{card.deckName}</div>
                  </div>
                  <span className="shrink-0 rounded-full bg-danger/10 px-3 py-1 text-xs font-bold text-danger">
                    {card.lowRatingCount} 次
                  </span>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                    <span>失误强度</span>
                    <span>{Math.round((card.lowRatingCount / maxWeakRating) * 100)}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-color)]">
                    <div
                      className="h-full rounded-full bg-danger transition-all"
                      style={{ width: `${(card.lowRatingCount / maxWeakRating) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="mt-3 text-xs text-[var(--text-muted)]">
                  最近一次：
                  {card.lastReviewedAt
                    ? new Date(card.lastReviewedAt).toLocaleDateString("zh-CN")
                    : "暂无"}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
