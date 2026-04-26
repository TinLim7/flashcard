"use client";

import { Suspense, useEffect, useMemo, useState } from "react";

import Link from "next/link";
import { CheckCircle2, History, Home, RotateCw, Sparkles } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import BackButton from "@/components/navigation/BackButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StateCard } from "@/components/ui/StateCard";
import { createTodayReviewSession, getStudyCompletion, getStudySession } from "@/lib/data-service";
import { autoDetectConfusions } from "@/lib/auto-confusion-detector";
import { getStudyDoneQuote } from "@/lib/quotes";
import { buildStudySessionHref } from "@/lib/routes";
import type { StudyCompletionSummary } from "@/lib/types";

function StudyDonePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") ?? "";

  const [summary, setSummary] = useState<StudyCompletionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingTodayReview, setIsStartingTodayReview] = useState(false);
  const [actionError, setActionError] = useState("");
  const [detectStatus, setDetectStatus] = useState<
    "idle" | "detecting" | "found" | "none" | "error"
  >("idle");
  const [foundCount, setFoundCount] = useState(0);
  const quote = useMemo(() => (summary ? getStudyDoneQuote(summary.sessionMode === "formal") : ""), [summary]);

  useEffect(() => {
    if (!sessionId) {
      setSummary(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        const nextSummary = await getStudyCompletion(sessionId);

        if (!isMounted) {
          return;
        }

        setSummary(nextSummary);
        setIsLoading(false);
      })();
    }, 120);

    return () => {
      isMounted = false;
      window.clearTimeout(timeoutId);
    };
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !summary) return;

    // Only detect sessions with new cards
    if ((summary.newCount ?? 0) <= 0) return;

    let isMounted = true;
    setDetectStatus("detecting");

    void (async () => {
      try {
        const session = await getStudySession(sessionId);
        const newCards =
          session?.cards.filter((c) => c.queue === "new") ?? [];

        if (!isMounted) return;

        if (newCards.length === 0) {
          setDetectStatus("none");
          return;
        }

        const result = await autoDetectConfusions(newCards);

        if (!isMounted) return;

        if (result.createdCount > 0) {
          setFoundCount(result.createdCount);
          setDetectStatus("found");
        } else {
          setDetectStatus("none");
        }
      } catch {
        if (isMounted) {
          setDetectStatus("error");
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [sessionId, summary]);

  const handleStartTodayReview = async () => {
    setIsStartingTodayReview(true);
    setActionError("");

    try {
      const result = await createTodayReviewSession();
      router.replace(buildStudySessionHref(result.sessionId));
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "今日回看队列生成失败，请稍后重试。",
      );
      setIsStartingTodayReview(false);
    }
  };

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[720px] items-center px-4">
        <div className="w-full space-y-4">
          <BackButton fallbackHref="/study" />
          <StateCard
            tone="loading"
            title="正在整理学习结果"
            description="马上展示这次 session 的学习摘要。"
            className="w-full"
          />
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[720px] items-center px-4">
        <div className="w-full space-y-4">
          <BackButton fallbackHref="/study" />
          <StateCard
            tone="error"
            title="没有找到学习摘要"
            description="这个 session 可能已经丢失，可以回到学习入口重新开始。"
            action={
              <Link href="/study">
                <Button>重新开始</Button>
              </Link>
            }
            className="w-full"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-[720px] flex-col items-center justify-center p-4 animate-in zoom-in-95 duration-500">
      <div className="mb-6 flex w-full justify-start">
        <BackButton fallbackHref="/study" className="-ml-2" />
      </div>

      <div className="mb-6 rounded-full bg-success/10 p-4 text-success">
        <CheckCircle2 size={64} strokeWidth={2} />
      </div>

      <h1 className="mb-2 text-3xl font-display font-bold text-[var(--text-main)]">
        {summary.sessionMode === "today-review" ? "今天的回看完成了" : "这一批完成了"}
      </h1>
      <p className="mb-4 text-[var(--text-muted)]">
        {summary.sessionMode === "today-review"
          ? "这次只是加练，不会改动正式复习计划。想再刷一遍也可以继续进入今日回看。"
          : "本轮学习批次已经处理完毕，如仍有复习积压，继续学习会自动进入下一批。"}
      </p>
      <p className="mb-8 text-center text-sm italic text-[var(--text-muted)]">
        &ldquo;{quote}&rdquo;
      </p>

      <Card className="mb-8 w-full max-w-sm bg-[var(--bg-card)] p-6">
        <h3 className="mb-4 border-b border-[var(--border-color)] pb-2 text-sm font-bold text-[var(--text-muted)]">
          本次学习摘要
        </h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-main)]">学习总数</span>
            <span className="font-mono text-lg font-bold">{summary.completedCount} 张</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">新词学习</span>
            <span className="font-medium text-success">{summary.newCount} 张</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--text-muted)]">旧词复习</span>
            <span className="font-medium text-primary">{summary.reviewCount} 张</span>
          </div>
        </div>
      </Card>

      {actionError ? (
        <div className="mb-4 w-full max-w-sm">
          <StateCard tone="error" title="还不能开始今日回看" description={actionError} />
        </div>
      ) : null}

      <div className="flex w-full max-w-sm flex-col gap-4">
        {summary.sessionMode === "formal" ? (
          <Button
            variant="secondary"
            className="h-[52px] w-full"
            onClick={() => void handleStartTodayReview()}
            isLoading={isStartingTodayReview}
          >
            {!isStartingTodayReview ? <History className="mr-2" size={20} /> : null}
            {isStartingTodayReview ? "正在生成今日回看..." : "回看今天学过的卡"}
          </Button>
        ) : null}

        <div className="flex w-full flex-col gap-4 sm:flex-row">
        <Link href="/app" className="flex-1">
          <Button variant="secondary" className="h-[52px] w-full">
            <Home className="mr-2" size={20} />
            返回首页
          </Button>
        </Link>
        <Link href="/study" className="flex-1">
          <Button className="h-[52px] w-full">
            <RotateCw className="mr-2" size={20} />
            {summary.sessionMode === "today-review" ? "回到学习入口" : "继续学习"}
          </Button>
        </Link>
        </div>
      </div>

      {detectStatus === "detecting" && (
        <div className="mt-4 flex items-center gap-2 text-sm text-[var(--text-muted)]">
          <Sparkles size={14} className="animate-pulse text-primary" />
          正在检测易混词...
        </div>
      )}

      {detectStatus === "found" && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-primary/10 px-4 py-3 text-sm text-primary">
          <Sparkles size={14} />
          发现 {foundCount} 组易混词，已添加到自动发现
        </div>
      )}

      {detectStatus === "error" && (
        <div className="mt-4 text-sm text-[var(--text-muted)]">
          易混词检测失败，可前往易混词页面手动查看
        </div>
      )}
    </div>
  );
}

export default function StudyDonePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[100dvh] w-full max-w-[720px] items-center px-4">
          <div className="w-full space-y-4">
            <BackButton fallbackHref="/study" />
            <StateCard
              tone="loading"
              title="正在整理学习结果"
              description="马上展示这次 session 的学习摘要。"
              className="w-full"
            />
          </div>
        </div>
      }
    >
      <StudyDonePageContent />
    </Suspense>
  );
}
