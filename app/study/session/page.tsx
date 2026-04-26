"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";

import { v4 as uuidv4 } from "uuid";
import { BookOpen, CheckCircle2, GitCompare, Lightbulb, Quote, Volume2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import BackButton from "@/components/navigation/BackButton";
import { Button } from "@/components/ui/Button";
import { CardSelector } from "@/components/ui/CardSelector";
import { StateCard } from "@/components/ui/StateCard";
import { parseCardBack, parseCardNote } from "@/lib/card-content";
import { createManualConfusionGroup, getStudyCompletion, getStudySession, submitReview } from "@/lib/data-service";
import { logger } from "@/lib/logger";
import { buildStudyDoneHref } from "@/lib/routes";
import {
  getBrowserSpeechRateValue,
  getDefaultSpeechPreferences,
  readSpeechPreferences,
  resolvePreferredFallbackVoice,
} from "@/lib/speech";
import { setSkipAutoResumeOnce } from "@/lib/study-resume";
import type { ReviewRating, StudySession } from "@/lib/types";
import { cn, sleep } from "@/lib/utils";

const ratingButtons = [
  {
    key: "1",
    label: "完全不会",
    time: "一点都想不起来",
    color: "text-danger hover:bg-danger/10 border-danger/20",
  },
  {
    key: "2",
    label: "有点印象",
    time: "模糊记得，今天还得再看",
    color: "text-warning hover:bg-warning/10 border-warning/20",
  },
  {
    key: "3",
    label: "认识",
    time: "能认出来，进入下一阶段",
    color: "text-primary hover:bg-primary/10 border-primary/20",
  },
  {
    key: "4",
    label: "很熟",
    time: "很轻松，复习间隔更长",
    color: "text-success hover:bg-success/10 border-success/20",
  },
] as const;

type StudyViewState = "loading" | "ready" | "empty" | "error";

function buildReviewFeedback(
  sessionMode: StudySession["mode"],
  nextDuePreview?: string,
  sameDayRequeueRequired?: boolean,
  sameDayRequeueOffset?: number,
) {
  if (sessionMode === "today-review") {
    if (sameDayRequeueRequired) {
      return `本轮约 ${sameDayRequeueOffset ?? 4} 张后再看；这次只是加练，不影响正式复习计划`;
    }

    return "这次回看已完成；正式复习计划保持不变。";
  }

  if (sameDayRequeueRequired) {
    const requeueCopy = `本轮约 ${sameDayRequeueOffset ?? 4} 张后返场`;
    return nextDuePreview ? `${requeueCopy}；长期复习：${nextDuePreview}` : requeueCopy;
  }

  return `下次复习：${nextDuePreview ?? "稍后复习"}`;
}

function StudySessionPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("sessionId") ?? "";

  const [session, setSession] = useState<StudySession | null>(null);
  const [viewState, setViewState] = useState<StudyViewState>("loading");
  const [isFlipped, setIsFlipped] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [speechMessage, setSpeechMessage] = useState("");
  const [speechPreferences, setSpeechPreferences] = useState(getDefaultSpeechPreferences());
  const [speechVoices, setSpeechVoices] = useState<SpeechSynthesisVoice[]>([]);
  const speechTimeoutRef = useRef<number | null>(null);

  const [isCardSelectorOpen, setIsCardSelectorOpen] = useState(false);
  const [confusionError, setConfusionError] = useState("");

  useEffect(() => {
    if (!sessionId) {
      setViewState("error");
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        try {
          const nextSession = await getStudySession(sessionId);

          if (!nextSession) {
            setViewState("error");
            return;
          }

          if (nextSession.cards.length === 0 || nextSession.currentIndex >= nextSession.cards.length) {
            setSession(nextSession);
            setViewState("empty");
            return;
          }

          setSession(nextSession);
          setViewState("ready");
        } catch (error) {
          logger.log("session.load.failure", {
            session_id: sessionId,
            route: "/study/session",
            action: "load_session",
            result: "failure",
            message: error instanceof Error ? error.message : "unknown_error",
          });
          setViewState("error");
        }
      })();
    }, 140);

    return () => window.clearTimeout(timeoutId);
  }, [sessionId]);

  const currentCard = session?.cards[session.currentIndex] ?? null;
  const parsedBack = currentCard ? parseCardBack(currentCard.back) : null;
  const parsedNote = currentCard ? parseCardNote(currentCard.note) : null;
  const progressPercent =
    session && session.cards.length > 0
      ? Math.round((session.completedCount / session.cards.length) * 100)
      : 0;

  useEffect(() => {
    if (!session || !currentCard || viewState !== "ready") {
      return;
    }

    logger.log("session.card.show", {
      session_id: sessionId,
      owner_id: session.ownerId,
      card_id: currentCard.id,
      route: "/study/session",
      action: "show_card",
      result: "success",
      position: session.currentIndex + 1,
      queue_remaining: session.cards.length - session.currentIndex - 1,
    });
  }, [currentCard, session, sessionId, viewState]);

  const handleFlip = useCallback(() => {
    if (!currentCard || isFlipped || isSubmitting) {
      return;
    }

    const traceId = uuidv4();

    logger.log("session.card.flip.before", {
      trace_id: traceId,
      session_id: sessionId,
      owner_id: session?.ownerId,
      card_id: currentCard.id,
      route: "/study/session",
      action: "flip_card",
      result: "pending",
      is_flipped: false,
    });

    setIsFlipped(true);

    logger.log("session.card.flip.after", {
      trace_id: traceId,
      session_id: sessionId,
      owner_id: session?.ownerId,
      card_id: currentCard.id,
      route: "/study/session",
      action: "flip_card",
      result: "success",
      is_flipped: true,
    });
  }, [currentCard, isFlipped, isSubmitting, session?.ownerId, sessionId]);

  const handleRate = useCallback(async (ratingKey: ReviewRating) => {
    if (!currentCard || !session || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

    const traceId = uuidv4();

    logger.log("review.submit.before", {
      trace_id: traceId,
      session_id: sessionId,
      owner_id: session.ownerId,
      card_id: currentCard.id,
      route: "/study/session",
      action: `rate_${ratingKey}`,
      result: "pending",
      rating: ratingKey,
    });

    try {
      const response = await submitReview({
        sessionId,
        cardId: currentCard.id,
        rating: ratingKey,
      });

      if (response.status === "failure") {
        logger.log("review.submit.failure", {
          trace_id: traceId,
          session_id: sessionId,
          owner_id: session.ownerId,
          card_id: currentCard.id,
          route: "/study/session",
          action: `rate_${ratingKey}`,
          result: "failure",
          rating: ratingKey,
          stage: response.stage,
          message: response.message,
        });

        setSubmitError(response.message ?? "提交失败，请稍后重试。");
        setIsSubmitting(false);
        return;
      }

      logger.log("review.submit.after", {
        trace_id: traceId,
        session_id: sessionId,
        owner_id: session.ownerId,
        card_id: currentCard.id,
        route: "/study/session",
        action: `rate_${ratingKey}`,
        result: "success",
        rating: ratingKey,
        next_due_preview: response.nextDuePreview,
      });

      setFeedbackText(
        buildReviewFeedback(
          session.mode,
          response.nextDuePreview,
          response.sameDayRequeueRequired,
          response.sameDayRequeueOffset,
        ),
      );
      setIsFlipped(false);

      const nextSession = await getStudySession(sessionId);

      if (!nextSession) {
        setViewState("error");
        setIsSubmitting(false);
        return;
      }

      if (nextSession.currentIndex >= nextSession.cards.length) {
        const summary = await getStudyCompletion(sessionId);

        logger.log("session.complete.before", {
          trace_id: traceId,
          session_id: sessionId,
          owner_id: session.ownerId,
          route: "/study/session",
          action: "complete_session",
          result: "pending",
          completed_count: summary?.completedCount ?? session.completedCount + 1,
          remaining_count: summary?.remainingCount ?? 0,
        });

        logger.log("session.complete.after", {
          trace_id: traceId,
          session_id: sessionId,
          owner_id: session.ownerId,
          route: "/study/session",
          action: "complete_session",
          result: "success",
          completed_count: summary?.completedCount ?? session.completedCount + 1,
          route_to: buildStudyDoneHref(sessionId),
        });

        await sleep(320);
        router.replace(buildStudyDoneHref(sessionId));
        return;
      }

      await sleep(320);
      setSession(nextSession);
      setFeedbackText("");
      setSubmitError("");
      setIsSubmitting(false);
    } catch (error) {
      logger.log("review.submit.exception", {
        trace_id: traceId,
        session_id: sessionId,
        owner_id: session.ownerId,
        card_id: currentCard.id,
        route: "/study/session",
        action: `rate_${ratingKey}`,
        result: "failure",
        rating: ratingKey,
        message: error instanceof Error ? error.message : "unknown_error",
      });

      setSubmitError(error instanceof Error ? error.message : "提交失败，请稍后重试。");
      setIsSubmitting(false);
    }
  }, [currentCard, isSubmitting, router, session, sessionId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === "Space") {
        event.preventDefault();
        handleFlip();
      }

      if (!isFlipped || isSubmitting) {
        return;
      }

      if (event.key === "1") void handleRate("1");
      if (event.key === "2") void handleRate("2");
      if (event.key === "3") void handleRate("3");
      if (event.key === "4") void handleRate("4");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleFlip, handleRate, isFlipped, isSubmitting]);

  useEffect(() => {
    setSpeechPreferences(readSpeechPreferences());

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }

    const loadVoices = () => {
      setSpeechVoices(window.speechSynthesis.getVoices());
    };

    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);

    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (speechTimeoutRef.current) {
        window.clearTimeout(speechTimeoutRef.current);
      }

      if (typeof window !== "undefined") {
        window.speechSynthesis?.cancel();
      }
    };
  }, []);

  const scheduleSpeechMessageClear = () => {
    if (speechTimeoutRef.current) {
      window.clearTimeout(speechTimeoutRef.current);
    }

    speechTimeoutRef.current = window.setTimeout(() => {
      setSpeechMessage("");
      speechTimeoutRef.current = null;
    }, 2400);
  };

  const speakWithBrowserFallback = async (text: string, leadingMessage?: string) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      setSpeechMessage("当前浏览器不支持系统朗读。");
      scheduleSpeechMessageClear();
      return false;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const preferredVoice = resolvePreferredFallbackVoice(speechVoices);

    utterance.lang = preferredVoice?.lang || "en-US";
    utterance.rate = getBrowserSpeechRateValue(speechPreferences.rate);
    utterance.pitch = 1;
    utterance.voice = preferredVoice;
    utterance.onstart = () => {
      setSpeechMessage(
        leadingMessage
          ? `${leadingMessage}，已切到系统朗读`
          : preferredVoice
            ? `正在使用系统语音：${preferredVoice.name}`
            : "正在使用系统英文语音朗读...",
      );
    };
    utterance.onend = () => {
      setSpeechMessage("朗读完成。");
      scheduleSpeechMessageClear();
    };
    utterance.onerror = () => {
      setSpeechMessage("系统朗读失败，请稍后重试。");
      scheduleSpeechMessageClear();
    };

    window.speechSynthesis.speak(utterance);
    return true;
  };

  const speakCurrentCard = async () => {
    if (!currentCard) {
      return;
    }

    if (typeof window !== "undefined") {
      window.speechSynthesis?.cancel();
    }

    await speakWithBrowserFallback(currentCard.front);
  };

  const handleSpeak = async (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    await speakCurrentCard();
  };

  const handleOpenCardSelector = () => {
    setConfusionError("");
    setIsCardSelectorOpen(true);
  };

  const handleCardSelectorConfirm = async (targetCardIds: string[]) => {
    if (!currentCard || targetCardIds.length === 0) {
      return;
    }

    try {
      await createManualConfusionGroup(currentCard.id, targetCardIds);
      setIsCardSelectorOpen(false);
    } catch (error) {
      setConfusionError(error instanceof Error ? error.message : "创建易混分组失败");
    }
  };

  if (viewState === "loading") {
    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[720px] items-center px-4">
        <div className="w-full space-y-4">
          <BackButton fallbackHref="/study" onBeforeBack={setSkipAutoResumeOnce} />
          <StateCard
            tone="loading"
            title="正在加载学习队列"
            description="正在读取这次 session 的卡片与进度，马上进入卡片模式。"
            className="w-full"
          />
        </div>
      </div>
    );
  }

  if (viewState === "error") {
    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[720px] items-center px-4">
        <div className="w-full space-y-4">
          <BackButton fallbackHref="/study" onBeforeBack={setSkipAutoResumeOnce} />
          <StateCard
            tone="error"
            title="学习 session 不可用"
            description="这个 session 可能已经丢失或尚未创建，请返回学习入口重新开始。"
            action={
              <Button onClick={() => router.replace("/study")} variant="secondary">
                返回学习入口
              </Button>
            }
            className="w-full"
          />
        </div>
      </div>
    );
  }

  if (viewState === "empty" || !currentCard || !session) {
    return (
      <div className="mx-auto flex min-h-[100dvh] w-full max-w-[720px] items-center px-4">
        <div className="w-full space-y-4">
          <BackButton fallbackHref="/study" onBeforeBack={setSkipAutoResumeOnce} />
          <StateCard
            tone="empty"
            title="当前学习批次已经完成"
            description="这一批卡片已经处理完了。若还有复习积压，继续开始学习会自动进入下一批。"
            action={
              <Button onClick={() => router.replace("/study")} variant="secondary">
                回到学习入口
              </Button>
            }
            className="w-full"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-[720px] flex-col px-4 py-6">
      <BackButton
        fallbackHref="/study"
        onBeforeBack={setSkipAutoResumeOnce}
        className="mb-4 -ml-2"
      />

      <header className="mb-6">
        <div className="mb-3 flex items-center justify-between text-sm font-medium text-[var(--text-muted)]">
          <span>
            第 {session.currentIndex + 1} / {session.cards.length} 张
          </span>
          <span className="font-mono text-xs">{progressPercent}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--border-color)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${currentCard.id}-${session.currentIndex}-${isFlipped ? "back" : "front"}`}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="flex flex-1 flex-col"
        >
          <div
            role="button"
            tabIndex={0}
            onClick={handleFlip}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleFlip();
              }
            }}
            className="flex flex-1 flex-col justify-between overflow-hidden rounded-3xl border border-[var(--border-color)] bg-gradient-to-br from-[var(--bg-card)] to-[var(--bg-body)] px-6 py-8 text-left shadow-soft transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {!isFlipped ? (
              <>
                <div className="flex items-start justify-between gap-4">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold",
                      session.mode === "today-review"
                        ? "bg-primary/10 text-primary"
                        : currentCard.needsSameDayPass
                        ? "bg-warning/10 text-warning"
                        : currentCard.queue === "review"
                        ? "bg-primary/10 text-primary"
                        : "bg-success/10 text-success",
                    )}
                  >
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        session.mode === "today-review"
                          ? "bg-primary"
                          : currentCard.needsSameDayPass
                          ? "bg-warning"
                          : currentCard.queue === "review"
                          ? "bg-primary"
                          : "bg-success",
                      )}
                    />
                    {session.mode === "today-review"
                      ? currentCard.revisitStep
                        ? `今日回看 · 第 ${currentCard.revisitStep} 轮`
                        : "今日回看"
                      : currentCard.revisitStep
                      ? `当天返场 · 第 ${currentCard.revisitStep} 轮`
                      : currentCard.needsSameDayPass
                        ? "当天未过关"
                      : currentCard.queue === "review"
                        ? "复习卡"
                        : "新卡"}
                  </span>
                </div>

                <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <h2 className="font-display text-[44px] font-bold leading-tight tracking-tight text-[var(--text-main)] md:text-[60px]">
                    {currentCard.front}
                  </h2>
                  {currentCard.phonetic ? (
                    <button
                      type="button"
                      onClick={handleSpeak}
                      className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-body)] px-5 py-2 text-[var(--text-muted)] shadow-sm transition-all hover:border-primary/35 hover:bg-primary/5 hover:text-[var(--text-main)] hover:shadow-md active:scale-[0.98]"
                      aria-label={`朗读单词 ${currentCard.front}`}
                    >
                      <Volume2 size={15} />
                      <span className="font-sans text-base tracking-wide">{currentCard.phonetic}</span>
                    </button>
                  ) : null}
                </div>

                <div className="flex items-end justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleSpeak}
                    className="rounded-full p-2.5 text-[var(--text-muted)] transition-all hover:bg-[var(--bg-body)] hover:text-[var(--text-main)] hover:shadow-sm active:scale-95"
                    aria-label="朗读当前单词"
                  >
                    <Volume2 size={18} />
                  </button>
                  <div className="flex-1 space-y-2 text-center">
                    <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--bg-body)] px-4 py-1.5 text-sm text-[var(--text-muted)]">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--text-muted)] opacity-50" />
                      点击卡片或按空格翻面
                    </div>
                    {speechMessage ? (
                      <p className="text-xs text-primary">{speechMessage}</p>
                    ) : null}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4 border-b border-[var(--border-color)] pb-5">
                  <div>
                    <h2 className="font-display text-3xl font-bold tracking-tight text-[var(--text-main)]">
                      {currentCard.front}
                    </h2>
                    {currentCard.phonetic ? (
                      <button
                        type="button"
                        onClick={handleSpeak}
                        className="mt-2 inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-body)] px-3 py-1.5 font-sans text-sm text-[var(--text-muted)] transition-all hover:border-primary/35 hover:bg-primary/5 hover:text-[var(--text-main)] hover:shadow-sm active:scale-[0.98]"
                        aria-label={`朗读单词 ${currentCard.front}`}
                      >
                        <Volume2 size={14} />
                        <span>{currentCard.phonetic}</span>
                      </button>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 shrink-0 px-2.5 text-primary hover:bg-primary/10"
                    onClick={handleOpenCardSelector}
                  >
                    <GitCompare size={14} className="mr-1" />
                    标记易混
                  </Button>
                </div>

                <div className="space-y-6 overflow-y-auto pr-1">
                  <div>
                    <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                      <BookOpen size={14} />
                      常见义项
                    </div>
                    {parsedBack?.pos ? (
                      <div className="mb-3 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                        {parsedBack.pos}
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      {(parsedBack?.meanings ?? [currentCard.back]).map((meaning, index) => (
                        <div
                          key={meaning}
                          className="flex items-start gap-3 rounded-2xl bg-[var(--bg-body)] px-4 py-3"
                        >
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--border-color)] text-[10px] font-bold text-[var(--text-muted)]">
                            {index + 1}
                          </span>
                          <span className="text-base leading-7 text-[var(--text-main)]">{meaning}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {currentCard.example ? (
                    <div>
                      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        <Quote size={14} />
                        原文例句
                      </div>
                      <div className="relative rounded-2xl border-l-4 border-primary/30 bg-[var(--bg-body)] p-4">
                        <span className="absolute left-2 top-1 text-2xl leading-none text-[var(--border-color)] select-none">&ldquo;</span>
                        <p className="pl-4 text-[15px] leading-7 text-[var(--text-main)]">
                          {currentCard.example}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {currentCard.note ? (
                    <div>
                      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">
                        <Lightbulb size={14} />
                        语境理解
                      </div>
                      <div className="space-y-3">
                        {parsedNote?.sentence ? (
                          <div className="rounded-2xl bg-[var(--bg-body)] px-4 py-3">
                            <div className="mb-1 text-xs font-semibold text-[var(--text-muted)]">整句意思</div>
                            <div className="text-sm leading-7 text-[var(--text-main)]">{parsedNote.sentence}</div>
                          </div>
                        ) : null}
                        {parsedNote?.contextMeaning ? (
                          <div className="rounded-2xl border-l-4 border-primary bg-gradient-to-r from-primary/5 to-transparent px-4 py-3">
                            <div className="mb-1 text-xs font-semibold text-primary">句中义</div>
                            <div className="text-sm leading-7 text-[var(--text-main)]">{parsedNote.contextMeaning}</div>
                          </div>
                        ) : (
                          <div className="text-sm leading-7 text-[var(--text-muted)]">{currentCard.note}</div>
                        )}
                        {parsedNote?.source ? (
                          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                            <span className="h-px w-3 bg-[var(--border-color)]" />
                            出处：{parsedNote.source}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>

                {feedbackText ? (
                  <div className="flex items-center gap-3 border-t border-[var(--border-color)] pt-5">
                    <button
                      type="button"
                      onClick={handleSpeak}
                      className="rounded-full p-2.5 text-[var(--text-muted)] transition-all hover:bg-[var(--bg-body)] hover:text-[var(--text-main)] hover:shadow-sm active:scale-95"
                      aria-label="再次朗读当前单词"
                    >
                      <Volume2 size={18} />
                    </button>
                    <div className="min-w-0 rounded-2xl bg-success/10 px-4 py-3">
                      <div className="flex items-start gap-2 text-sm font-semibold text-success">
                        <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
                        <span className="min-w-0 break-words">{feedbackText}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 border-t border-[var(--border-color)] pt-5">
                    <button
                      type="button"
                      onClick={handleSpeak}
                      className="rounded-full p-2.5 text-[var(--text-muted)] transition-all hover:bg-[var(--bg-body)] hover:text-[var(--text-main)] hover:shadow-sm active:scale-95"
                      aria-label="再次朗读当前单词"
                    >
                      <Volume2 size={18} />
                    </button>
                    <div className="flex-1 space-y-1">
                      <div className="text-sm text-[var(--text-muted)]">
                        {session.mode === "today-review"
                          ? "这次回看只用于加练和自测，不会改动正式复习计划。"
                          : currentCard.needsSameDayPass
                          ? "这张卡今天还没真正过关，请至少重新答对一次后再离开。"
                          : "请选择一个评分，系统会按固定艾宾浩斯阶段更新下次复习时间。"}
                      </div>
                      {speechMessage ? <div className="text-xs text-primary">{speechMessage}</div> : null}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </AnimatePresence>

      {submitError ? (
        <div className="mt-4">
          <StateCard tone="error" title="评分提交失败" description={submitError} />
        </div>
      ) : null}

      {confusionError ? (
        <div className="mt-4">
          <StateCard tone="error" title="创建易混分组失败" description={confusionError} />
        </div>
      ) : null}

      <CardSelector
        isOpen={isCardSelectorOpen}
        onClose={() => {
          setIsCardSelectorOpen(false);
        }}
        sourceCardId={currentCard?.id ?? ""}
        onConfirm={(ids) => void handleCardSelectorConfirm(ids)}
      />

      <div className="mt-6 grid grid-cols-2 gap-3">
        {ratingButtons.map((button) => (
          <Button
            key={button.key}
            variant="secondary"
            disabled={!isFlipped || isSubmitting}
            className={cn(
              "h-auto min-h-[78px] flex-col items-start justify-center rounded-2xl border px-4 py-3 text-left transition-all hover:scale-[1.02] active:scale-[0.98]",
              button.key === "1" && "bg-danger/5 border-danger/20 text-danger hover:bg-danger/10",
              button.key === "2" && "bg-warning/5 border-warning/20 text-warning hover:bg-warning/10",
              button.key === "3" && "bg-primary/5 border-primary/20 text-primary hover:bg-primary/10",
              button.key === "4" && "bg-success/5 border-success/20 text-success hover:bg-success/10",
            )}
            onClick={() => {
              void handleRate(button.key);
            }}
          >
            <span className="flex items-center gap-2 text-base font-bold">
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white",
                  button.key === "1" && "bg-danger",
                  button.key === "2" && "bg-warning",
                  button.key === "3" && "bg-primary",
                  button.key === "4" && "bg-success",
                )}
              >
                {button.key}
              </span>
              {button.label}
            </span>
            <span className="mt-1.5 pl-7 text-xs opacity-70">
              {isSubmitting ? "提交中..." : button.time}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}

export default function StudySessionPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex min-h-[100dvh] w-full max-w-[720px] items-center px-4">
          <div className="w-full space-y-4">
            <BackButton fallbackHref="/study" onBeforeBack={setSkipAutoResumeOnce} />
            <StateCard
              tone="loading"
              title="正在加载学习队列"
              description="正在读取这次 session 的卡片与进度，马上进入卡片模式。"
              className="w-full"
            />
          </div>
        </div>
      }
    >
      <StudySessionPageContent />
    </Suspense>
  );
}
