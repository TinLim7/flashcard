"use client";

import { useEffect, useMemo, useState } from "react";

import Link from "next/link";
import { ArrowRight, BookOpen, FileSpreadsheet, Layers, MoreVertical, PencilLine, Play, Plus, Search, UploadCloud } from "lucide-react";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { StateCard } from "@/components/ui/StateCard";
import { getDeckListData } from "@/lib/data-service";
import { getEmptyStateQuote } from "@/lib/quotes";
import { buildDeckCardNewHref, buildDeckDetailHref } from "@/lib/routes";
import type { Deck } from "@/lib/types";

type DeckFilter = "all" | "recent" | "due";
const DATA_CHANGE_EVENT = "animal-farm:data-changed";

export default function DecksPage() {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<DeckFilter>("all");
  const [menuDeckId, setMenuDeckId] = useState<string | null>(null);
  const [decks, setDecks] = useState<Deck[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [isFallback, setIsFallback] = useState(false);
  const [dataMode, setDataMode] = useState<"mock" | "cloudflare">("mock");
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const emptyQuote = useMemo(() => getEmptyStateQuote("noDecks"), []);

  useEffect(() => {
    let isMounted = true;
    const loadDecks = async () => {
      const result = await getDeckListData();

      if (!isMounted) {
        return;
      }

      setDecks(result.decks);
      setIsFallback(result.isFallback);
      setDataMode(result.dataMode);
      setIsReady(true);
    };

    const handleWindowRefresh = () => {
      void loadDecks();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadDecks();
      }
    };

    void loadDecks();
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

  const filteredDecks = decks.filter((deck) => {
    const matchesQuery =
      deck.name.toLowerCase().includes(query.toLowerCase()) ||
      deck.tags.join(" ").toLowerCase().includes(query.toLowerCase());

    if (!matchesQuery) {
      return false;
    }

    if (activeFilter === "recent") {
      return deck.lastStudiedLabel !== "从未学习";
    }

    if (activeFilter === "due") {
      return deck.dueCount > 0;
    }

    return true;
  });

  const selectedDeck = decks.find((deck) => deck.id === menuDeckId) ?? null;

  if (!isReady) {
    return (
      <StateCard
        tone="loading"
        title="正在整理牌组"
        description="本地 mock 数据已准备好，马上展示你的学习集合。"
      />
    );
  }

  return (
    <div className="flex h-full flex-col space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text-main)]">我的牌组</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">共 {decks.length} 个牌组</p>
          <div className="mt-2 flex gap-2 text-xs">
            <span className="rounded-full bg-[var(--bg-card)] px-3 py-1 text-[var(--text-muted)]">
              数据源：{dataMode}
            </span>
            {isFallback ? (
              <span className="rounded-full bg-warning/10 px-3 py-1 text-warning">
                已回退到 mock
              </span>
            ) : null}
          </div>
        </div>
        <div className="hidden items-center gap-3 md:flex">
          <Link href="/import">
            <Button variant="secondary">
              <UploadCloud className="mr-2" size={18} />
              导入 CSV
            </Button>
          </Link>
          <Link href="/decks/new">
            <Button>
              <Plus className="mr-2" size={20} />
              新建牌组
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-4 md:flex-row">
        <div className="relative flex-1">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
            size={20}
          />
          <Input
            placeholder="搜索牌组名称或标签..."
            className="pl-11"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="hide-scrollbar flex space-x-2 overflow-x-auto pb-2 md:pb-0">
          <Button
            variant={activeFilter === "all" ? "secondary" : "ghost"}
            size="sm"
            className={
              activeFilter === "all"
                ? "whitespace-nowrap rounded-full border-primary bg-primary/5 text-primary"
                : "whitespace-nowrap rounded-full"
            }
            onClick={() => setActiveFilter("all")}
          >
            全部牌组
          </Button>
          <Button
            variant={activeFilter === "recent" ? "secondary" : "ghost"}
            size="sm"
            className={
              activeFilter === "recent"
                ? "whitespace-nowrap rounded-full border-primary bg-primary/5 text-primary"
                : "whitespace-nowrap rounded-full"
            }
            onClick={() => setActiveFilter("recent")}
          >
            最近学习
          </Button>
          <Button
            variant={activeFilter === "due" ? "secondary" : "ghost"}
            size="sm"
            className={
              activeFilter === "due"
                ? "whitespace-nowrap rounded-full border-primary bg-primary/5 text-primary"
                : "whitespace-nowrap rounded-full"
            }
            onClick={() => setActiveFilter("due")}
          >
            有复习任务
          </Button>
        </div>
      </div>

      {filteredDecks.length === 0 ? (
        <StateCard
          tone="empty"
          title="没有匹配的牌组"
          description="可以换个关键词，或者切回“全部牌组”看看已有内容。"
          quote={emptyQuote}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setQuery("");
                setActiveFilter("all");
              }}
            >
              清空筛选
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 pb-20 md:grid-cols-2 md:pb-0 lg:grid-cols-3">
          {filteredDecks.map((deck) => (
            <Card key={deck.id} interactive className="group relative flex flex-col">
              <Link href={buildDeckDetailHref(deck.id)} className="flex flex-1 flex-col p-5">
                <div className="mb-4 flex items-start justify-between">
                  <div className="rounded-xl bg-primary/10 p-2 text-primary">
                    <Layers size={24} />
                  </div>
                  <button
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setMenuDeckId(deck.id);
                    }}
                    className="-mr-2 -mt-2 relative z-10 rounded-full p-2 text-[var(--text-muted)] transition-colors hover:bg-black/5 hover:text-[var(--text-main)]"
                    aria-label={`打开 ${deck.name} 的操作菜单`}
                  >
                    <MoreVertical size={20} />
                  </button>
                </div>

                <h3 className="mb-1 line-clamp-2 text-lg font-bold leading-tight text-[var(--text-main)]">
                  {deck.name}
                </h3>
                <p className="mb-3 line-clamp-2 text-sm leading-6 text-[var(--text-muted)]">
                  {deck.description}
                </p>
                <p className="mb-6 text-xs text-[var(--text-muted)]">
                  上次学习: {deck.lastStudiedLabel}
                </p>

                <div className="mt-auto flex items-center justify-between border-t border-[var(--border-color)] pt-4 text-sm">
                  <span className="font-medium text-[var(--text-muted)]">{deck.totalCount} 词</span>

                  <div className="flex space-x-2">
                    {deck.newCount > 0 ? (
                      <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-bold text-success">
                        +{deck.newCount} 新
                      </span>
                    ) : null}
                    {deck.dueCount > 0 ? (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                        {deck.dueCount} 现在可复习
                      </span>
                    ) : null}
                  </div>
                </div>
              </Link>
            </Card>
          ))}
        </div>
      )}

      <div className="fixed bottom-[80px] right-4 z-40 md:hidden">
        <Button
          size="icon"
          className="h-[56px] w-[56px] rounded-full shadow-soft"
          aria-label="打开添加菜单"
          onClick={() => setIsCreateMenuOpen(true)}
        >
          <Plus size={28} />
        </Button>
      </div>

      <Modal
        isOpen={isCreateMenuOpen}
        onClose={() => setIsCreateMenuOpen(false)}
        title="添加内容"
      >
        <div className="space-y-2">
          <Link href="/decks/new" onClick={() => setIsCreateMenuOpen(false)}>
            <div className="group flex items-center gap-4 rounded-2xl p-4 transition-all duration-200 hover:bg-[var(--bg-body)]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-110">
                <Layers size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold text-[var(--text-main)]">新建牌组</div>
                <div className="mt-0.5 text-[13px] text-[var(--text-muted)]">先建立一个新的学习集合</div>
              </div>
              <ArrowRight size={16} className="shrink-0 text-[var(--text-muted)] transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
          </Link>

          <Link href="/import" onClick={() => setIsCreateMenuOpen(false)}>
            <div className="group flex items-center gap-4 rounded-2xl p-4 transition-all duration-200 hover:bg-[var(--bg-body)]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success transition-transform duration-200 group-hover:scale-110">
                <FileSpreadsheet size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold text-[var(--text-main)]">导入 CSV 单词</div>
                <div className="mt-0.5 text-[13px] text-[var(--text-muted)]">批量添加词汇并自动归入牌组</div>
              </div>
              <ArrowRight size={16} className="shrink-0 text-[var(--text-muted)] transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-success" />
            </div>
          </Link>
        </div>
      </Modal>

      <Modal
        isOpen={selectedDeck !== null}
        onClose={() => setMenuDeckId(null)}
        title={selectedDeck?.name}
      >
        {selectedDeck ? (
          <div className="space-y-6">
            {/* Deck quick stats */}
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <Layers size={20} />
              </div>
              <div className="min-w-0">
                <div className="text-[15px] font-bold text-[var(--text-main)]">{selectedDeck.totalCount} 张卡片</div>
                <div className="mt-0.5 text-[13px] text-[var(--text-muted)]">
                  {selectedDeck.dueCount > 0 ? `${selectedDeck.dueCount} 张待复习` : "暂无复习任务"}
                  {selectedDeck.newCount > 0 ? ` · ${selectedDeck.newCount} 张新卡` : ""}
                </div>
              </div>
            </div>

            <div className="h-px bg-[var(--border-color)]" />

            {/* Action list */}
            <div className="space-y-1">
              <Link href={buildDeckDetailHref(selectedDeck.id)} onClick={() => setMenuDeckId(null)}>
                <div className="group flex items-center gap-4 rounded-2xl p-4 transition-all duration-200 hover:bg-[var(--bg-body)]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-110">
                    <BookOpen size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-bold text-[var(--text-main)]">查看牌组详情</div>
                    <div className="mt-0.5 text-[13px] text-[var(--text-muted)]">浏览、编辑和管理卡片</div>
                  </div>
                  <ArrowRight size={16} className="shrink-0 text-[var(--text-muted)] transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
              </Link>

              <Link href={buildDeckCardNewHref(selectedDeck.id)} onClick={() => setMenuDeckId(null)}>
                <div className="group flex items-center gap-4 rounded-2xl p-4 transition-all duration-200 hover:bg-[var(--bg-body)]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success transition-transform duration-200 group-hover:scale-110">
                    <PencilLine size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-bold text-[var(--text-main)]">新增卡片</div>
                    <div className="mt-0.5 text-[13px] text-[var(--text-muted)]">手动添加一张新词汇卡片</div>
                  </div>
                  <ArrowRight size={16} className="shrink-0 text-[var(--text-muted)] transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-success" />
                </div>
              </Link>

              <Link href="/study" onClick={() => setMenuDeckId(null)}>
                <div className="group relative mt-3 flex items-center gap-4 overflow-hidden rounded-2xl bg-primary p-5 transition-all duration-200 hover:shadow-md hover:brightness-110 active:scale-[0.98]">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white transition-transform duration-200 group-hover:scale-110">
                    <Play size={18} className="ml-0.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[15px] font-bold text-white">开始学习此类内容</div>
                    <div className="mt-0.5 text-[13px] text-white/70">进入复习队列，按艾宾浩斯计划学习</div>
                  </div>
                  <ArrowRight size={16} className="shrink-0 text-white/70 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-white" />
                </div>
              </Link>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
