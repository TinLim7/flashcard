"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import {
  BookOpen,
  Clock,
  Flame,
  Layers,
  Play,
  Plus,
  RotateCcw,
  Sparkles,
  TrendingUp,
  Upload,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StateCard } from "@/components/ui/StateCard";
import { getHomePageData } from "@/lib/data-service";
import { getHomeQuote } from "@/lib/quotes";
import { buildDeckDetailHref } from "@/lib/routes";
import type { Deck, HomeStats } from "@/lib/types";

const DATA_CHANGE_EVENT = "animal-farm:data-changed";

export default function HomePage() {
  const [recentDecks, setRecentDecks] = useState<Deck[]>([]);
  const [stats, setStats] = useState<HomeStats | null>(null);
  const [isFallback, setIsFallback] = useState(false);
  const [dataMode, setDataMode] = useState<"mock" | "cloudflare">("mock");
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const quote = getHomeQuote(stats?.reviews ?? 0, stats?.newCards ?? 0);

  useEffect(() => {
    let isMounted = true;
    const loadHomeData = async () => {
      if (isMounted) {
        setIsLoading(true);
        setErrorMessage("");
      }

      try {
        const result = await getHomePageData();

        if (!isMounted) {
          return;
        }

        setRecentDecks(result.recentDecks);
        setStats(result.stats);
        setDataMode(result.dataMode);
        setIsFallback(result.isFallback);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setErrorMessage(
          error instanceof Error ? error.message : "首页数据暂时加载失败，请稍后重试。",
        );
        setRecentDecks([]);
        setStats(null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    const handleWindowRefresh = () => {
      void loadHomeData();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadHomeData();
      }
    };

    void loadHomeData();
    window.addEventListener(DATA_CHANGE_EVENT, handleWindowRefresh);
    window.addEventListener("focus", handleWindowRefresh);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      window.removeEventListener(DATA_CHANGE_EVENT, handleWindowRefresh);
      window.removeEventListener("focus", handleWindowRefresh);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  if (isLoading) {
    return (
      <StateCard
        tone="loading"
        title="正在准备首页概览"
        description="正在读取今日学习摘要和最近牌组。"
      />
    );
  }

  if (errorMessage || !stats) {
    return (
      <StateCard
        tone="error"
        title="首页暂时没加载出来"
        description={errorMessage || "首页数据暂时加载失败，请稍后重试。"}
        action={
          <Button variant="secondary" onClick={() => window.location.reload()}>
            重新加载首页
          </Button>
        }
      />
    );
  }

  const progressPercent = Math.round((stats.completed / Math.max(stats.total, 1)) * 100);

  return (
    <div className="animate-in space-y-6 fade-in slide-in-from-bottom-4 duration-500 md:space-y-8">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-xl font-bold tracking-tight text-[var(--text-main)] md:text-2xl">
            早上好，准备好记忆了吗？
          </h1>
          <p className="mt-1 text-sm text-[var(--text-muted)] md:text-base">
            {stats.reviews > 0
              ? `今天先清空 ${stats.reviews} 张现在可复习卡片`
              : `今天还可以引入 ${stats.newCards} 个新词`}
          </p>
          <p className="mt-2 text-xs italic text-[var(--text-muted)] md:text-sm">&ldquo;{quote}&rdquo;</p>
          <div className="mt-2 flex flex-wrap gap-2 text-[10px] md:mt-3 md:text-xs">
            <span className="rounded-full bg-[var(--bg-card)] px-2.5 py-1 text-[var(--text-muted)] md:px-3">
              数据源：{dataMode}
            </span>
            {isFallback ? (
              <span className="rounded-full bg-warning/10 px-2.5 py-1 text-warning md:px-3">
                云端不可用，已回退 mock
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-warning/10 px-3 py-1.5 text-sm font-bold text-warning">
          <Flame size={16} />
          <span>{stats.streak}</span>
          <span className="text-xs font-normal opacity-70">天</span>
        </div>
      </header>

      <Card className="border-primary/15 bg-gradient-to-br from-primary/[0.06] via-transparent to-transparent p-5 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="grid flex-1 grid-cols-3 gap-2 md:gap-4">
            <div className="flex flex-col items-center text-center md:items-start md:text-left">
              <span className="font-display text-3xl font-bold text-primary md:text-4xl">{stats.reviews}</span>
              <span className="mt-1 flex items-center justify-center gap-1 text-xs font-medium text-[var(--text-muted)] md:justify-start md:text-sm">
                <RotateCcw size={13} className="text-primary" />
                现在可复习
              </span>
            </div>
            <div className="flex flex-col items-center text-center md:items-start md:text-left">
              <span className="font-display text-3xl font-bold text-success md:text-4xl">{stats.newCards}</span>
              <span className="mt-1 flex items-center justify-center gap-1 text-xs font-medium text-[var(--text-muted)] md:justify-start md:text-sm">
                <Sparkles size={13} className="text-success" />
                今日新词剩余
              </span>
            </div>
            <div className="flex flex-col items-center text-center md:items-start md:text-left">
              <span className="font-display text-3xl font-bold text-[var(--text-main)] md:text-4xl">{stats.estMinutes}</span>
              <span className="mt-1 flex items-center justify-center gap-1 text-xs font-medium text-[var(--text-muted)] md:justify-start md:text-sm">
                <Clock size={13} className="text-[var(--text-muted)]" />
                预计分钟
              </span>
            </div>
          </div>

          <div className="w-full md:w-auto">
            <Link href="/study" className="block w-full md:w-auto">
              <Button className="group h-14 w-full text-base shadow-soft md:h-[52px] md:w-[220px] md:text-lg">
                <Play
                  className="mr-2 fill-current transition-transform group-hover:scale-110"
                  size={18}
                />
                开始今日学习
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-6 md:mt-8">
          <div className="mb-2 flex items-center justify-between text-xs font-medium text-[var(--text-muted)]">
            <span className="flex items-center gap-1.5">
              <TrendingUp size={13} />
              今日进度
            </span>
            <span className="font-mono">
              {stats.completed} / {stats.total} 张 · {progressPercent}%
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--border-color)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-success to-success/80 transition-all duration-1000 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="space-y-4 md:col-span-2">
          <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text-main)] md:text-lg">
            <Zap size={18} className="text-primary" />
            最近学习
          </h2>
          {recentDecks.length === 0 ? (
            <StateCard
              tone="empty"
              title="还没有牌组"
              description="可以先新建一个牌组，或者导入一份 CSV 词库开始。"
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4">
              {recentDecks.map((deck) => (
                <Link key={deck.id} href={buildDeckDetailHref(deck.id)}>
                  <Card
                    interactive
                    className="relative flex h-full flex-col justify-between overflow-hidden p-4 md:p-5"
                  >
                    <div className="absolute left-0 top-0 h-full w-1 bg-primary/70" />
                    <div>
                      <h3 className="line-clamp-2 text-base font-bold text-[var(--text-main)] md:text-[17px]">
                        {deck.name}
                      </h3>
                      <p className="mt-1.5 text-sm leading-6 text-[var(--text-muted)] md:mt-2">
                        {deck.description}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between md:mt-4">
                      <span className="flex items-center gap-1 text-xs text-[var(--text-muted)] md:text-sm">
                        <Layers size={13} />
                        {deck.totalCount} 词
                      </span>
                      <div className="flex gap-1.5 md:gap-2">
                        {deck.newCount > 0 ? (
                          <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success md:px-2.5 md:text-xs">
                            +{deck.newCount} 新
                          </span>
                        ) : null}
                        {deck.dueCount > 0 ? (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary md:px-2.5 md:text-xs">
                            {deck.dueCount} 可复习
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <h2 className="text-base font-bold text-[var(--text-main)] md:text-lg">快捷操作</h2>
          <div className="flex flex-col gap-3">
            <Link href="/decks/new">
              <Button
                variant="secondary"
                className="h-auto w-full justify-start gap-3 px-4 py-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Plus size={18} />
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-[var(--text-main)]">新建牌组</div>
                  <div className="text-xs text-[var(--text-muted)]">从零开始创建</div>
                </div>
              </Button>
            </Link>
            <Link href="/import">
              <Button
                variant="secondary"
                className="h-auto w-full justify-start gap-3 px-4 py-3"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
                  <Upload size={18} />
                </div>
                <div className="text-left">
                  <div className="text-sm font-bold text-[var(--text-main)]">导入 CSV 词库</div>
                  <div className="text-xs text-[var(--text-muted)]">批量导入已有词库</div>
                </div>
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
