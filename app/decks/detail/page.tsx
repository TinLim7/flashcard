"use client";

import { Suspense, useEffect, useMemo, useState } from "react";

import Link from "next/link";
import {
  BookOpen,
  Check,
  CheckSquare,
  Clock,
  GitCompare,
  Layers,
  Play,
  Plus,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import BackButton from "@/components/navigation/BackButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CardSelector } from "@/components/ui/CardSelector";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { StateCard } from "@/components/ui/StateCard";
import { parseCardBack, parseCardNote } from "@/lib/card-content";
import { createManualConfusionGroup, deleteDeck, getDeckDetailData } from "@/lib/data-service";
import { getEmptyStateQuote } from "@/lib/quotes";
import { buildDeckCardNewHref } from "@/lib/routes";
import type { Card as DeckCard, Deck } from "@/lib/types";

function DeckDetailPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const deckId = searchParams.get("deckId") ?? "";

  const [deck, setDeck] = useState<Deck | null>(null);
  const [deckCards, setDeckCards] = useState<DeckCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [isFallback, setIsFallback] = useState(false);
  const [dataMode, setDataMode] = useState<"mock" | "cloudflare">("mock");
  const emptyQuote = useMemo(() => getEmptyStateQuote("noCards"), []);

  const [isCardSelectorOpen, setIsCardSelectorOpen] = useState(false);
  const [activeSourceCardId, setActiveSourceCardId] = useState("");
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [batchSelectedIds, setBatchSelectedIds] = useState<Set<string>>(new Set());
  const [batchSearchQuery, setBatchSearchQuery] = useState("");
  const [isCreatingConfusion, setIsCreatingConfusion] = useState(false);
  const [createConfusionError, setCreateConfusionError] = useState("");
  const filteredDeckCards = useMemo(() => {
    if (!batchSearchQuery.trim()) {
      return deckCards;
    }

    const q = batchSearchQuery.toLowerCase();

    return deckCards.filter((c) => {
      const parsed = parseCardBack(c.back);

      return (
        c.front.toLowerCase().includes(q) ||
        (c.phonetic?.toLowerCase().includes(q) ?? false) ||
        parsed.meanings.some((m) => m.toLowerCase().includes(q))
      );
    });
  }, [deckCards, batchSearchQuery]);

  useEffect(() => {
    if (!deckId) {
      setDeck(null);
      setDeckCards([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    void (async () => {
      try {
        const result = await getDeckDetailData(deckId);

        if (!isMounted) {
          return;
        }

        setDeck(result.deck);
        setDeckCards(result.cards);
        setIsFallback(result.isFallback);
        setDataMode(result.dataMode);
      } catch {
        if (!isMounted) {
          return;
        }

        setDeck(null);
        setDeckCards([]);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [deckId]);

  if (isLoading) {
    return (
      <StateCard
        tone="loading"
        title="正在加载牌组详情"
        description="马上展示这个牌组的学习摘要和卡片列表。"
      />
    );
  }

  if (!deckId || !deck) {
    return (
      <StateCard
        tone="error"
        title="找不到这个牌组"
        description="牌组 ID 可能无效，或者当前数据源里暂时没有这条记录。"
        action={
          <Link href="/decks">
            <Button variant="secondary">返回牌组列表</Button>
          </Link>
        }
      />
    );
  }

  const handleDeleteDeck = async () => {
    if (!deck) {
      return;
    }

    setIsDeleting(true);
    setDeleteError("");

    try {
      await deleteDeck({
        deckId: deck.id,
      });
      setIsDeleteDialogOpen(false);
      router.push("/decks");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除牌组失败，请稍后重试。";
      setDeleteError(message);
      setIsDeleteDialogOpen(false);
      setIsDeleting(false);
    }
  };

  const handleOpenCardSelector = (cardId: string) => {
    setActiveSourceCardId(cardId);
    setIsCardSelectorOpen(true);
  };

  const handleCardSelectorConfirm = async (targetCardIds: string[]) => {
    if (!activeSourceCardId || targetCardIds.length === 0) {
      return;
    }

    setIsCreatingConfusion(true);
    setCreateConfusionError("");

    try {
      await createManualConfusionGroup(activeSourceCardId, targetCardIds);
      setIsCardSelectorOpen(false);
      setActiveSourceCardId("");
    } catch (error) {
      setCreateConfusionError(error instanceof Error ? error.message : "创建易混分组失败");
    } finally {
      setIsCreatingConfusion(false);
    }
  };

  const toggleBatchCard = (cardId: string) => {
    setBatchSelectedIds((prev) => {
      const next = new Set(prev);

      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }

      return next;
    });
  };

  const handleBatchCreateConfusion = async () => {
    const ids = Array.from(batchSelectedIds);

    if (ids.length < 2) {
      return;
    }

    setIsCreatingConfusion(true);
    setCreateConfusionError("");

    try {
      const sourceId = ids[0];
      const targets = ids.slice(1);

      await createManualConfusionGroup(sourceId, targets);
      setBatchSelectedIds(new Set());
      setIsBatchMode(false);
      setBatchSearchQuery("");
    } catch (error) {
      setCreateConfusionError(error instanceof Error ? error.message : "创建易混分组失败");
    } finally {
      setIsCreatingConfusion(false);
    }
  };

  const exitBatchMode = () => {
    setIsBatchMode(false);
    setBatchSelectedIds(new Set());
    setBatchSearchQuery("");
  };

  return (
    <div className="space-y-5 md:space-y-6">
      <BackButton fallbackHref="/decks" className="-ml-2" />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold text-[var(--text-main)] md:text-3xl">
            {deck.name}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--text-muted)] md:text-base">
            {deck.description}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="secondary"
            size="sm"
            className={isBatchMode ? "border-primary bg-primary/5 text-primary" : ""}
            onClick={() => {
              if (isBatchMode) {
                exitBatchMode();
              } else {
                setIsBatchMode(true);
              }
            }}
          >
            <CheckSquare size={16} className="mr-1.5" />
            {isBatchMode ? "退出选择" : "批量选择"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-danger hover:bg-danger/10"
            onClick={() => {
              setDeleteError("");
              setIsDeleteDialogOpen(true);
            }}
          >
            <Trash2 size={16} />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-[10px] md:text-xs">
        <span className="rounded-full bg-[var(--bg-card)] px-2.5 py-1 text-[var(--text-muted)] md:px-3">
          数据源：{dataMode}
        </span>
        {isFallback ? (
          <span className="rounded-full bg-warning/10 px-2.5 py-1 text-warning md:px-3">
            已回退到 mock
          </span>
        ) : null}
        {deck.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary md:px-3"
          >
            {tag}
          </span>
        ))}
      </div>

      {deleteError ? (
        <StateCard tone="error" title="删除没有完成" description={deleteError} />
      ) : null}

      <Card className="border-primary/15 bg-gradient-to-br from-primary/[0.06] via-transparent to-transparent p-5 md:p-6">
        <div className="grid grid-cols-3 gap-2 md:gap-4">
          <div className="flex flex-col items-center text-center md:items-start md:text-left">
            <span className="font-display text-3xl font-bold text-primary md:text-4xl">{deck.dueCount}</span>
            <span className="mt-1 flex items-center justify-center gap-1 text-xs text-[var(--text-muted)] md:justify-start md:text-sm">
              <RotateCcw size={13} className="text-primary" />
              现在可复习
            </span>
          </div>
          <div className="flex flex-col items-center text-center md:items-start md:text-left">
            <span className="font-display text-3xl font-bold text-success md:text-4xl">{deck.newCount}</span>
            <span className="mt-1 flex items-center justify-center gap-1 text-xs text-[var(--text-muted)] md:justify-start md:text-sm">
              <Sparkles size={13} className="text-success" />
              未学习新词
            </span>
          </div>
          <div className="flex flex-col items-center text-center md:items-start md:text-left">
            <span className="font-display text-3xl font-bold text-[var(--text-main)] md:text-4xl">{deck.totalCount}</span>
            <span className="mt-1 flex items-center justify-center gap-1 text-xs text-[var(--text-muted)] md:justify-start md:text-sm">
              <Layers size={13} />
              总卡片数
            </span>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2.5 border-t border-[var(--border-color)] pt-5 md:mt-6 md:flex-row md:gap-3 md:pt-6">
          <Link href="/study" className="block w-full md:w-auto">
            <Button className="h-14 w-full text-base shadow-soft md:h-[52px] md:w-[220px] md:text-lg">
              <Play className="mr-2 fill-current" size={18} />
              去学习
            </Button>
          </Link>
          <Link href={buildDeckCardNewHref(deck.id)} className="block w-full md:w-auto">
            <Button variant="secondary" className="h-14 w-full text-base md:h-[52px] md:w-auto">
              <Plus className="mr-2" size={18} />
              新增卡片
            </Button>
          </Link>
        </div>
      </Card>

      {createConfusionError ? (
        <StateCard tone="error" title="创建易混分组失败" description={createConfusionError} />
      ) : null}

      {deckCards.length === 0 ? (
        <StateCard
          tone="empty"
          title="这个牌组还没有示例卡片"
          description="可以先从 CSV 导入，或者直接手动新建一张卡片试试。"
          quote={emptyQuote}
          action={
            <Link href={buildDeckCardNewHref(deck.id)}>
              <Button>新增卡片</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="flex items-center gap-2 text-base font-bold text-[var(--text-muted)] md:text-lg">
              <BookOpen size={18} />
              卡片列表
            </h2>
            {isBatchMode ? (
              <div className="relative max-w-xs flex-1">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
                />
                <Input
                  placeholder="搜索当前牌组..."
                  className="h-9 pl-9 text-sm"
                  value={batchSearchQuery}
                  onChange={(e) => setBatchSearchQuery(e.target.value)}
                />
              </div>
            ) : null}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {filteredDeckCards.map((card) => {
              const parsedBack = parseCardBack(card.back);
              const parsedNote = parseCardNote(card.note);
              const isBatchSelected = batchSelectedIds.has(card.id);

              return (
                <Card
                  key={card.id}
                  className={`relative overflow-hidden p-4 md:p-5 ${
                    isBatchMode && isBatchSelected
                      ? "border-primary bg-primary/5"
                      : ""
                  }`}
                >
                  {isBatchMode ? (
                    <button
                      type="button"
                      onClick={() => toggleBatchCard(card.id)}
                      className={`absolute left-4 top-4 z-10 flex h-5 w-5 items-center justify-center rounded-md border transition-colors ${
                        isBatchSelected
                          ? "border-primary bg-primary text-white"
                          : "border-[var(--border-color)] bg-[var(--bg-card)]"
                      }`}
                    >
                      {isBatchSelected ? <Check size={12} strokeWidth={3} /> : null}
                    </button>
                  ) : (
                    <div className="absolute left-0 top-0 h-full w-1 bg-primary/70" />
                  )}

                  <div
                    className={`flex items-start justify-between gap-4 ${isBatchMode ? "pl-8" : ""}`}
                  >
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-[var(--text-main)] md:text-xl">
                        {card.front}
                      </h3>
                      {card.phonetic ? (
                        <p className="mt-0.5 font-mono text-sm text-[var(--text-muted)]">
                          {card.phonetic}
                        </p>
                      ) : null}
                    </div>
                    {isBatchMode ? null : (
                      <div className="flex shrink-0 gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2.5 text-primary hover:bg-primary/10"
                          onClick={() => handleOpenCardSelector(card.id)}
                        >
                          <GitCompare size={14} className="mr-1" />
                          标记易混
                        </Button>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold md:text-xs ${
                            card.status === "review"
                              ? "bg-primary/10 text-primary"
                              : card.status === "new"
                                ? "bg-success/10 text-success"
                                : "bg-[var(--bg-body)] text-[var(--text-muted)]"
                          }`}
                        >
                          {card.status ?? "新卡"}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className={`mt-4 ${isBatchMode ? "pl-8" : ""}`}>
                    {parsedBack.pos ? (
                      <span className="mb-2 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                        {parsedBack.pos}
                      </span>
                    ) : null}
                    <ul className="space-y-1.5">
                      {parsedBack.meanings.map((meaning) => (
                        <li
                          key={meaning}
                          className="flex items-start gap-2 text-sm text-[var(--text-main)]"
                        >
                          <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-primary/50" />
                          <span className="leading-relaxed">{meaning}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {card.example ? (
                    <div className={`mt-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-body)] p-3.5 md:p-4 ${isBatchMode ? "ml-8" : ""}`}>
                      <div className="mb-1.5 text-xs font-semibold text-[var(--text-muted)]">
                        原文例句
                      </div>
                      <p className="text-sm italic leading-6 text-[var(--text-muted)]">
                        &ldquo;{card.example}&rdquo;
                      </p>
                    </div>
                  ) : null}

                  {card.note ? (
                    <div className={`mt-4 space-y-2.5 ${isBatchMode ? "ml-8" : ""}`}>
                      <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        语境理解
                      </div>
                      {parsedNote?.sentence ? (
                        <div className="rounded-2xl bg-[var(--bg-body)] px-4 py-3">
                          <div className="mb-1 text-xs font-semibold text-[var(--text-muted)]">
                            整句意思
                          </div>
                          <div className="text-sm leading-6 text-[var(--text-main)]">
                            {parsedNote.sentence}
                          </div>
                        </div>
                      ) : null}
                      {parsedNote?.contextMeaning ? (
                        <div className="rounded-2xl border-l-4 border-primary bg-primary/5 px-4 py-3">
                          <div className="mb-1 text-xs font-semibold text-primary">句中义</div>
                          <div className="text-sm leading-6 text-[var(--text-main)]">
                            {parsedNote.contextMeaning}
                          </div>
                        </div>
                      ) : null}
                      {parsedNote?.source ? (
                        <div className="text-xs text-[var(--text-muted)]">
                          出处：{parsedNote.source}
                        </div>
                      ) : null}
                      {!parsedNote?.sentence && !parsedNote?.contextMeaning ? (
                        <div className="rounded-2xl bg-[var(--bg-body)] px-4 py-3 text-sm leading-6 text-[var(--text-muted)]">
                          {card.note}
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {card.nextDueAt ? (
                    <div className={`mt-4 flex items-center gap-1.5 text-xs text-[var(--text-muted)] ${isBatchMode ? "ml-8" : ""}`}>
                      <Clock size={12} />
                      下次复习：{card.nextDueAt}
                    </div>
                  ) : null}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {isBatchMode && (
        <div className="fixed bottom-4 left-4 right-4 z-50 md:absolute md:bottom-0 md:left-0 md:right-0">
          <div className="mx-auto flex max-w-[720px] items-center justify-between gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-2xl">
            <span className="text-sm text-[var(--text-muted)]">
              已选择{" "}
              <span className="font-bold text-[var(--text-main)]">{batchSelectedIds.size}</span>{" "}
              张
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={exitBatchMode}>
                <X size={14} className="mr-1.5" />
                取消
              </Button>
              <Button
                size="sm"
                isLoading={isCreatingConfusion}
                disabled={batchSelectedIds.size < 2}
                onClick={() => void handleBatchCreateConfusion()}
              >
                <GitCompare size={14} className="mr-1.5" />
                标记为易混
              </Button>
            </div>
          </div>
        </div>
      )}

      <CardSelector
        isOpen={isCardSelectorOpen}
        onClose={() => {
          setIsCardSelectorOpen(false);
          setActiveSourceCardId("");
        }}
        sourceCardId={activeSourceCardId}
        onConfirm={(ids) => void handleCardSelectorConfirm(ids)}
      />

      <Modal
        isOpen={isDeleteDialogOpen}
        onClose={() => {
          if (!isDeleting) {
            setIsDeleteDialogOpen(false);
          }
        }}
        title="确认删除牌组"
      >
        <div className="space-y-5">
          <p className="text-sm leading-6 text-[var(--text-muted)]">
            删除“{deck.name}”会同时移除这个牌组下的卡片和学习记录。
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              variant="secondary"
              disabled={isDeleting}
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              取消
            </Button>
            <Button
              className="bg-danger text-white hover:bg-danger/90"
              isLoading={isDeleting}
              onClick={() => {
                void handleDeleteDeck();
              }}
            >
              删除牌组
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default function DeckDetailPage() {
  return (
    <Suspense
      fallback={
        <StateCard
          tone="loading"
          title="正在加载牌组详情"
          description="马上展示这个牌组的学习摘要和卡片列表。"
        />
      }
    >
      <DeckDetailPageContent />
    </Suspense>
  );
}
