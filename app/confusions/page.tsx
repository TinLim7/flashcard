"use client";

import { useEffect, useState } from "react";

import { AlertTriangle, ChevronDown, ChevronUp, Plus, User } from "lucide-react";

import { Card } from "@/components/ui/Card";
import { CardSelector } from "@/components/ui/CardSelector";
import { StateCard } from "@/components/ui/StateCard";
import { Button } from "@/components/ui/Button";
import { parseCardBack } from "@/lib/card-content";
import { createManualConfusionGroup, getConfusionPageData, getManualConfusionGroups } from "@/lib/data-service";
import type { ConfusionGroup } from "@/lib/types";

function buildDiffSegments(left: string, right: string) {
  const maxLength = Math.max(left.length, right.length);
  const leftSegments: { text: string; changed: boolean }[] = [];
  const rightSegments: { text: string; changed: boolean }[] = [];

  let currentLeft = "";
  let currentRight = "";
  let currentChanged = false;

  const flush = () => {
    if (currentLeft) {
      leftSegments.push({ text: currentLeft, changed: currentChanged });
    }
    if (currentRight) {
      rightSegments.push({ text: currentRight, changed: currentChanged });
    }
    currentLeft = "";
    currentRight = "";
  };

  for (let index = 0; index < maxLength; index += 1) {
    const leftChar = left[index] ?? "";
    const rightChar = right[index] ?? "";
    const changed = leftChar !== rightChar;

    if (index === 0) {
      currentChanged = changed;
    }

    if (changed !== currentChanged) {
      flush();
      currentChanged = changed;
    }

    currentLeft += leftChar;
    currentRight += rightChar;
  }

  flush();

  return { leftSegments, rightSegments };
}

function buildConfusionHint(group: ConfusionGroup, candidate: ConfusionGroup["confusions"][number]) {
  const left = group.front.toLowerCase();
  const right = candidate.front.toLowerCase();
  const diffCount = Math.max(left.length, right.length) - [...left].filter((char, index) => char === (right[index] ?? "")).length;
  const vowels = new Set(["a", "e", "i", "o", "u"]);
  const differingPairs = [...Array(Math.max(left.length, right.length)).keys()]
    .map((index) => [left[index] ?? "", right[index] ?? ""])
    .filter(([leftChar, rightChar]) => leftChar !== rightChar);
  const onlyVowelDifference =
    differingPairs.length === 1 &&
    vowels.has(differingPairs[0][0]) &&
    vowels.has(differingPairs[0][1]);

  if (onlyVowelDifference) {
    return "只有一个元音不同，容易记串";
  }

  if (diffCount <= 2) {
    return "少数字母不同，容易记串";
  }

  return "拼写接近，建议对比记忆";
}

function renderWordSegments(
  segments: { text: string; changed: boolean }[],
  variant: "source" | "target",
) {
  return segments.map((segment, index) => (
    <span
      key={`${segment.text}-${index}`}
      className={
        segment.changed
          ? variant === "source"
            ? "border-b-2 border-primary text-primary"
            : "border-b-2 border-warning text-warning"
          : undefined
      }
    >
      {segment.text}
    </span>
  ));
}

function SimilarityBadge({ score }: { score: number }) {
  const percentage = Math.round(score * 100);
  if (score >= 0.85) {
    return (
      <span className="shrink-0 rounded-md bg-danger/10 px-2 py-0.5 text-xs font-bold text-danger">
        相似度 {percentage}%
      </span>
    );
  }
  if (score >= 0.7) {
    return (
      <span className="shrink-0 rounded-md bg-warning/15 px-2 py-0.5 text-xs font-bold text-warning">
        相似度 {percentage}%
      </span>
    );
  }
  return (
    <span className="shrink-0 rounded-md bg-black/5 px-2 py-0.5 text-xs font-bold text-[var(--text-muted)] dark:bg-white/10">
      相似度 {percentage}%
    </span>
  );
}

type ConfusionTab = "auto" | "manual";

export default function ConfusionsPage() {
  const [groups, setGroups] = useState<ConfusionGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);
  const [dataMode, setDataMode] = useState<"mock" | "cloudflare">("mock");
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ConfusionTab>("auto");
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [creatorError, setCreatorError] = useState("");

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    void (async () => {
      const result = activeTab === "auto"
        ? await getConfusionPageData()
        : await getManualConfusionGroups();

      if (!isMounted) {
        return;
      }

      setGroups(result.groups);
      setIsFallback(result.isFallback);
      setDataMode(result.dataMode);
      setExpandedCardId(result.groups[0]?.cardId ?? null);
      setIsLoading(false);
    })();

    return () => {
      isMounted = false;
    };
  }, [activeTab]);

  const handleCreatorConfirm = async (selectedIds: string[]) => {
    if (selectedIds.length < 2) {
      return;
    }

    const sourceId = selectedIds[0];
    const targets = selectedIds.slice(1);

    setCreatorError("");

    try {
      await createManualConfusionGroup(sourceId, targets);
      setIsCreatorOpen(false);
      // Refresh manual groups if on manual tab
      if (activeTab === "manual") {
        setIsLoading(true);
        const result = await getManualConfusionGroups();
        setGroups(result.groups);
        setIsFallback(result.isFallback);
        setDataMode(result.dataMode);
        setExpandedCardId(result.groups[0]?.cardId ?? null);
        setIsLoading(false);
      } else {
        // Switch to manual tab to show the new group
        setActiveTab("manual");
      }
    } catch (error) {
      setCreatorError(error instanceof Error ? error.message : "创建失败");
    }
  };

  if (isLoading) {
    return (
      <StateCard
        tone="loading"
        title="正在整理易混词"
        description="正在根据你的低评分记录和拼写相似度生成对比记忆列表。"
      />
    );
  }

  if (groups.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-[var(--text-main)]">易混词</h1>
          <p className="mt-2 text-[var(--text-muted)]">
            把最近容易记串的词放在一起对比。
          </p>
        </div>

        <div className="flex rounded-2xl bg-[var(--bg-card)] p-1">
          <button
            type="button"
            onClick={() => setActiveTab("auto")}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-all ${
              activeTab === "auto"
                ? "bg-primary text-white shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
          >
            自动发现
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("manual")}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-all ${
              activeTab === "manual"
                ? "bg-primary text-white shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
          >
            手动标记
          </button>
        </div>

        <StateCard
          tone="empty"
          title={activeTab === "auto" ? "暂时还没有易混词" : "还没有手动标记的易混词"}
          description={
            activeTab === "auto"
              ? "先正常学习一段时间；当系统发现你经常记串的词时，这里会自动生成对比记忆列表。"
              : "去牌组详情页选择几张相似卡片，手动创建易混分组吧。"
          }
          action={
            activeTab === "manual" ? (
              <Button onClick={() => setIsCreatorOpen(true)}>
                <Plus size={16} className="mr-1.5" />
                新建手动分组
              </Button>
            ) : undefined
          }
        />

        {creatorError ? (
          <div className="mt-4">
            <StateCard tone="error" title="创建失败" description={creatorError} />
          </div>
        ) : null}

        <CardSelector
          isOpen={isCreatorOpen}
          onClose={() => {
            setIsCreatorOpen(false);
            setCreatorError("");
          }}
          onConfirm={(ids) => void handleCreatorConfirm(ids)}
          title="选择卡片创建易混分组"
          confirmLabel="创建分组"
          minSelection={2}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-[var(--text-main)]">易混词</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          把最近容易记串的词放在一起对比。
        </p>
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

      <div className="flex items-center gap-3">
        <div className="flex flex-1 rounded-2xl bg-[var(--bg-card)] p-1">
          <button
            type="button"
            onClick={() => setActiveTab("auto")}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-all ${
              activeTab === "auto"
                ? "bg-primary text-white shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
          >
            自动发现
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("manual")}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-all ${
              activeTab === "manual"
                ? "bg-primary text-white shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
            }`}
          >
            手动标记
          </button>
        </div>
        {activeTab === "manual" ? (
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0"
            onClick={() => setIsCreatorOpen(true)}
          >
            <Plus size={14} className="mr-1" />
            新建
          </Button>
        ) : null}
      </div>

      <div className="space-y-4">
        {groups.map((group, groupIndex) => {
          const isExpanded = expandedCardId === group.cardId;
          const sourceBack = parseCardBack(group.back);

          return (
            <Card
              key={group.cardId}
              className="confusion-animate-in overflow-hidden"
              style={{ animationDelay: `${groupIndex * 80}ms` }}
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-2xl font-bold text-[var(--text-main)]">
                        {group.front}
                      </h2>
                      {sourceBack.pos ? (
                        <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                          {sourceBack.pos}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-sm text-[var(--text-main)]">
                      {sourceBack.meanings[0] ?? group.back}
                    </div>
                  </div>
                  {group.source === "manual" ? (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                      <User className="h-3 w-3" />
                      手动标记
                    </span>
                  ) : (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-warning/10 px-2.5 py-1 text-xs font-bold text-warning">
                      <AlertTriangle className="h-3 w-3" />
                      {group.lowRatingCount} 次低评分
                    </span>
                  )}
                </div>

                <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-[var(--bg-body)] px-4 py-3">
                  <div className="text-sm text-[var(--text-muted)]">
                    找到 {group.confusions.length} 个易混词
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedCardId(isExpanded ? null : group.cardId)}
                    className="min-h-[36px] px-3"
                  >
                    {isExpanded ? "收起对比" : "查看易混词"}
                    {isExpanded ? <ChevronUp className="ml-2 h-4 w-4" /> : <ChevronDown className="ml-2 h-4 w-4" />}
                  </Button>
                </div>

                <div className={`confusion-expand ${isExpanded ? "confusion-expand-open" : ""}`}>
                  <div>
                    <div className="mt-4 space-y-3">
                      {group.confusions.map((candidate) => {
                        const candidateBack = parseCardBack(candidate.back);
                        const diff = buildDiffSegments(group.front, candidate.front);

                        return (
                          <div
                            key={candidate.cardId}
                            className="rounded-2xl bg-[var(--bg-body)] p-4"
                          >
                            <div className="grid grid-cols-2 gap-3">
                              <div className="text-center">
                                <div className="font-display text-xl font-bold tracking-wide text-[var(--text-main)]">
                                  {renderWordSegments(diff.leftSegments, "source")}
                                </div>
                                <div className="mt-1.5 flex items-center justify-center gap-1.5">
                                  {sourceBack.pos ? (
                                    <span className="text-xs font-medium text-primary">
                                      {sourceBack.pos}
                                    </span>
                                  ) : null}
                                  <span className="text-sm text-[var(--text-muted)]">
                                    {sourceBack.meanings[0] ?? group.back}
                                  </span>
                                </div>
                              </div>

                              <div className="text-center">
                                <div className="font-display text-xl font-bold tracking-wide text-[var(--text-main)]">
                                  {renderWordSegments(diff.rightSegments, "target")}
                                </div>
                                <div className="mt-1.5 flex items-center justify-center gap-1.5">
                                  {candidateBack.pos ? (
                                    <span className="text-xs font-medium text-warning">
                                      {candidateBack.pos}
                                    </span>
                                  ) : null}
                                  <span className="text-sm text-[var(--text-muted)]">
                                    {candidateBack.meanings[0] ?? candidate.back}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between border-t border-[var(--border-color)] pt-3">
                              <span className="text-xs text-[var(--text-muted)]">
                                {buildConfusionHint(group, candidate)}
                              </span>
                              <SimilarityBadge score={candidate.similarityScore} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {creatorError ? (
        <div className="mt-4">
          <StateCard tone="error" title="创建失败" description={creatorError} />
        </div>
      ) : null}

      <CardSelector
        isOpen={isCreatorOpen}
        onClose={() => {
          setIsCreatorOpen(false);
          setCreatorError("");
        }}
        onConfirm={(ids) => void handleCreatorConfirm(ids)}
        title="选择卡片创建易混分组"
        confirmLabel="创建分组"
        minSelection={2}
      />
    </div>
  );
}
