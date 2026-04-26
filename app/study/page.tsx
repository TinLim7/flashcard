"use client";

import { useEffect, useMemo, useState } from "react";

import { v4 as uuidv4 } from "uuid";
import { History, Layers, Play } from "lucide-react";
import { useRouter } from "next/navigation";

import BackButton from "@/components/navigation/BackButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StateCard } from "@/components/ui/StateCard";
import {
  createStudySession,
  createTodayReviewSession,
  getActiveStudySession,
  getStudyEntryData,
} from "@/lib/data-service";
import { logger } from "@/lib/logger";
import { buildStudySessionHref } from "@/lib/routes";
import { getStudyEntryQuote } from "@/lib/quotes";
import { consumeSkipAutoResumeOnce } from "@/lib/study-resume";
import type { Deck, HomeStats, StudySession } from "@/lib/types";
import { sleep } from "@/lib/utils";

const DATA_CHANGE_EVENT = "animal-farm:data-changed";

export default function StudyEntryPage() {
  const router = useRouter();
  const quote = useMemo(() => getStudyEntryQuote(), []);
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>([]);
  const [isStarting, setIsStarting] = useState(false);
  const [isStartingTodayReview, setIsStartingTodayReview] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [stats, setStats] = useState<HomeStats | null>(null);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [activeSession, setActiveSession] = useState<StudySession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);
  const [dataMode, setDataMode] = useState<"mock" | "cloudflare">("mock");

  useEffect(() => {
    let isMounted = true;
    const loadStudyEntry = async (refresh = false, allowAutoResume = false) => {
      // 增加一个小延迟，确保云端写入后的最终一致性
      if (refresh) {
        await sleep(500);
      }

      const skipAutoResume = allowAutoResume ? consumeSkipAutoResumeOnce() : false;
      const [result, resumableSession] = await Promise.all([
        getStudyEntryData(refresh),
        getActiveStudySession(),
      ]);

      if (!isMounted) {
        return;
      }

      setStats(result.stats);
      setDecks(result.decks);
      setActiveSession(resumableSession);
      setIsFallback(result.isFallback);
      setDataMode(result.dataMode);
      setIsLoading(false);

      if (allowAutoResume && resumableSession && !skipAutoResume) {
        router.replace(buildStudySessionHref(resumableSession.id));
      }
    };

    const handleWindowRefresh = () => {
      void loadStudyEntry(true);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadStudyEntry(true);
      }
    };

    void loadStudyEntry(false, true);
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

  const toggleDeck = (deckId: string) => {
    setSelectedDeckIds((currentIds) => {
      if (currentIds.includes(deckId)) {
        return currentIds.filter((id) => id !== deckId);
      }

      return [...currentIds, deckId];
    });
  };

  const handleStartSession = async () => {
    if (scope === "selected" && selectedDeckIds.length === 0) {
      setErrorMessage("请选择至少一个牌组，再创建学习队列。");
      return;
    }

    setIsStarting(true);
    setErrorMessage("");

    const traceId = uuidv4();

    logger.log("session.start.before", {
      trace_id: traceId,
      route: "/study",
      action: "click_start_study",
      result: "pending",
      deck_scope: scope,
      selected_deck_ids: selectedDeckIds,
    });

    await sleep(500);

    try {
      const result = await createStudySession(scope === "selected" ? selectedDeckIds : []);

      if (result.queueCounts.review + result.queueCounts.new === 0) {
        const message =
          stats && stats.reviews > 0
            ? "当前学习队列暂时不可用，请刷新页面后重试。"
            : "现在没有可学习的卡片了。等下一批复习到点，或明天再引入新的新词。";

        logger.log("session.start.after", {
          trace_id: traceId,
          session_id: result.sessionId,
          route: "/study",
          action: "click_start_study",
          result: "empty",
          deck_scope: scope,
          selected_deck_ids: selectedDeckIds,
          queue_counts: result.queueCounts,
        });

        setErrorMessage(message);
        setIsStarting(false);
        return;
      }

      logger.log("session.start.after", {
        trace_id: traceId,
        session_id: result.sessionId,
        route: "/study",
        action: "click_start_study",
        result: "success",
        deck_scope: scope,
        selected_deck_ids: selectedDeckIds,
        queue_counts: result.queueCounts,
      });

      router.push(buildStudySessionHref(result.sessionId));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "学习队列生成失败，请稍后重试。";

      logger.log("session.start.after", {
        trace_id: traceId,
        route: "/study",
        action: "click_start_study",
        result: "failure",
        deck_scope: scope,
        selected_deck_ids: selectedDeckIds,
        error_message: message,
      });

      setErrorMessage(message);
      setIsStarting(false);
    }
  };

  const handleStartTodayReview = async () => {
    setIsStartingTodayReview(true);
    setErrorMessage("");

    const traceId = uuidv4();

    logger.log("session.start.before", {
      trace_id: traceId,
      route: "/study",
      action: "click_start_today_review",
      result: "pending",
      today_review_count: stats?.todayReviewedCount ?? 0,
    });

    try {
      const result = await createTodayReviewSession();

      logger.log("session.start.after", {
        trace_id: traceId,
        session_id: result.sessionId,
        route: "/study",
        action: "click_start_today_review",
        result: "success",
        queue_counts: result.queueCounts,
      });

      router.push(buildStudySessionHref(result.sessionId));
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "今日回看队列生成失败，请稍后重试。";

      logger.log("session.start.after", {
        trace_id: traceId,
        route: "/study",
        action: "click_start_today_review",
        result: "failure",
        error_message: message,
      });

      setErrorMessage(message);
      setIsStartingTodayReview(false);
    }
  };

  if (isLoading || !stats) {
    return (
      <div className="mx-auto max-w-[720px] space-y-4 pt-8">
        <BackButton fallbackHref="/" className="-ml-2" />
        <StateCard
          tone="loading"
          title="正在准备学习入口"
          description="正在读取牌组和今日学习概览。"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[720px] animate-in space-y-5 fade-in duration-500 pt-6 md:space-y-6 md:pt-8">
      <BackButton fallbackHref="/" className="-ml-2" />

      <div>
        <h1 className="font-display text-xl font-bold text-[var(--text-main)] md:text-2xl">
          准备开始今日学习
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-muted)] md:mt-2 md:text-base md:leading-normal">
          先生成一份学习队列。当前规则会先清空到期复习，只有没有复习积压时才引入当天最多 25 个新词。
        </p>
        <p className="mt-2 text-xs italic text-[var(--text-muted)] md:text-sm">
          &ldquo;{quote}&rdquo;
        </p>
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

      {activeSession ? (
        <Card className="border-primary/15 bg-primary/5 p-4 md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
            <div className="min-w-0">
              <h2 className="text-base font-bold text-[var(--text-main)] md:text-lg">检测到未完成的学习进度</h2>
              <p className="mt-1 text-xs leading-5 text-[var(--text-muted)] md:text-sm md:leading-6">
                上次正式学习已完成 {activeSession.completedCount} / {activeSession.cards.length} 张。你可以继续同一批卡片，不会丢失之前的学习进度。
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="w-full shrink-0 md:w-auto"
              onClick={() => router.push(buildStudySessionHref(activeSession.id))}
            >
              继续上次学习
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="rounded-card bg-[var(--bg-card)] p-6 shadow-soft md:p-8">
        <div className="space-y-6 md:space-y-8">
          <div className="grid grid-cols-3 gap-2 md:gap-4">
            <div className="text-center">
              <div className="font-display text-3xl font-bold text-primary md:text-4xl">{stats.reviews}</div>
              <div className="mt-1 text-xs text-[var(--text-muted)] md:text-sm">现在可复习</div>
            </div>
            <div className="text-center">
              <div className="font-display text-3xl font-bold text-success md:text-4xl">{stats.newCards}</div>
              <div className="mt-1 text-xs text-[var(--text-muted)] md:text-sm">今日新词剩余</div>
            </div>
            <div className="text-center">
              <div className="font-display text-3xl font-bold text-[var(--text-main)] md:text-4xl">{stats.estMinutes}</div>
              <div className="mt-1 text-xs text-[var(--text-muted)] md:text-sm">预计分钟</div>
            </div>
          </div>

          <div className="space-y-2.5 md:space-y-3">
            <div className="rounded-2xl bg-[var(--bg-body)] px-4 py-3 text-xs leading-5 text-[var(--text-muted)] md:px-5 md:py-3.5 md:text-sm md:leading-normal">
              {stats.reviews > 0
                ? "今天存在复习积压，本轮只会生成复习卡。清空后才会开放新的新词。"
                : `今天已引入 ${stats.todayNewIntroduced} / ${stats.todayNewLimit} 个新词，本轮最多继续放出 ${stats.newCards} 个。`}
            </div>

            {stats.todayReviewedCount > 0 ? (
              <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-xs leading-5 text-[var(--text-main)] md:px-5 md:py-3.5 md:text-sm md:leading-normal">
                今天已经正式学过 {stats.todayReviewedCount} 张卡。你可以随时再刷一遍，它只做当下自测和返场提醒，不会改动正式复习计划。
              </div>
            ) : null}
          </div>

          <div className="space-y-3 border-t border-[var(--border-color)] pt-5 md:space-y-4 md:pt-6">
            <h3 className="text-xs font-bold text-[var(--text-muted)] md:text-sm">学习范围</h3>
            <div className="grid gap-2 md:grid-cols-2 md:gap-3">
              <Button
                variant="secondary"
                size="sm"
                className={
                  scope === "all"
                    ? "justify-start border-primary bg-primary/5 text-primary"
                    : "justify-start"
                }
                onClick={() => setScope("all")}
              >
                <Layers className="mr-2" size={16} />
                <span className="text-sm md:text-base">全部牌组</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className={
                  scope === "selected"
                    ? "justify-start border-primary bg-primary/5 text-primary"
                    : "justify-start"
                }
                onClick={() => setScope("selected")}
              >
                <Layers className="mr-2" size={16} />
                <span className="text-sm md:text-base">指定牌组</span>
              </Button>
            </div>

            {scope === "selected" ? (
              <div className="grid gap-2 md:gap-3">
                {decks.map((deck) => {
                  const isSelected = selectedDeckIds.includes(deck.id);

                  return (
                    <button
                      key={deck.id}
                      onClick={() => toggleDeck(deck.id)}
                      className={`rounded-card border p-4 text-left transition-all duration-200 hover:border-primary/30 md:p-5 ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-[var(--border-color)] bg-[var(--bg-body)]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-bold text-[var(--text-main)] md:text-base">{deck.name}</div>
                          <div className="mt-0.5 text-xs text-[var(--text-muted)] md:text-sm">
                            {deck.dueCount} 现在可复习，+{deck.newCount} 未学新词
                          </div>
                        </div>
                        <div
                          className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold md:text-xs ${
                            isSelected
                              ? "bg-primary text-white"
                              : "bg-[var(--bg-card)] text-[var(--text-muted)]"
                          }`}
                        >
                          {isSelected ? "已选择" : "可加入"}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-2xl bg-[var(--bg-body)] px-4 py-3 text-xs text-[var(--text-muted)] md:px-5 md:text-sm">
                <Layers size={14} className="shrink-0 text-[var(--text-muted)]" />
                <span>将使用全局队列，优先读取最近活跃牌组生成学习序列</span>
              </div>
            )}
          </div>

          {errorMessage ? (
            <StateCard tone="error" title="还不能开始学习" description={errorMessage} />
          ) : null}

          <div className="grid gap-2 md:grid-cols-2 md:gap-3">
            <Button
              className="h-14 w-full text-base shadow-soft md:h-[56px] md:text-lg"
              onClick={handleStartSession}
              isLoading={isStarting}
            >
              {!isStarting ? <Play className="mr-2 fill-current" size={18} /> : null}
              {isStarting ? "正在生成学习队列..." : "开始学习"}
            </Button>
            {stats.todayReviewedCount > 0 ? (
              <Button
                variant="secondary"
                className="h-14 w-full text-base md:h-[56px] md:text-lg"
                onClick={handleStartTodayReview}
                isLoading={isStartingTodayReview}
              >
                {!isStartingTodayReview ? <History className="mr-2" size={18} /> : null}
                {isStartingTodayReview ? "正在生成今日回看..." : "回看今天学过的卡"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
