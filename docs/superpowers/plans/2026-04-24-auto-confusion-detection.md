# 自动易混词检测升级 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 升级易混词检测为多维度算法（拼写+音标+释义），并在学习完成时自动触发检测创建分组。

**Architecture:** 前端纯算法实现（Levenshtein、辅音骨架、Jaccard），学习完成页异步触发，批量调用后端 CloudBase 云函数保存。检测范围限制在同牌组、仅新词、最多3目标。

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, CloudBase

---

## 文件结构

| 文件 | 职责 |
|------|------|
| `lib/confusion-similarity.ts` | 多维度相似度算法（新建） |
| `lib/auto-confusion-detector.ts` | 自动检测 orchestration（新建） |
| `lib/types.ts` | 新增 `CreateAutoConfusionGroupsInput/Result`（修改） |
| `lib/data-service.ts` | 新增 `createAutoConfusionGroups` API（修改） |
| `app/study/done/page.tsx` | 加载时触发自动检测（修改） |

---

## Task 1: 多维度相似度算法 — `lib/confusion-similarity.ts`

**Files:**
- Create: `lib/confusion-similarity.ts`
- Modify: `lib/data-service.ts:2052-2064` (删除旧的 `calculateSimilarity`)
- Test: 通过 `npm run build:prod` 类型检查

- [ ] **Step 1: 创建 `lib/confusion-similarity.ts`，实现 Levenshtein 编辑距离**

```ts
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] =
        b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1,
            );
    }
  }
  return matrix[b.length][a.length];
}

export function levenshteinSimilarity(a: string, b: string): number {
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  const maxLength = Math.max(a.length, b.length);
  return maxLength === 0 ? 1 : 1 - distance / maxLength;
}
```

- [ ] **Step 2: 实现辅音骨架提取与 LCS 相似度**

在 `lib/confusion-similarity.ts` 中追加：

```ts
function extractConsonants(phonetic: string): string {
  // 移除音标符号和重音标记，保留英文字母
  return phonetic
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/[aeiou]/g, "");
}

function lcsLength(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0),
  );
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

export function phoneticSkeletonSimilarity(
  a?: string,
  b?: string,
): number {
  if (!a || !b) return 0;
  const skeletonA = extractConsonants(a);
  const skeletonB = extractConsonants(b);
  const maxLen = Math.max(skeletonA.length, skeletonB.length);
  if (maxLen === 0) return 0;
  return lcsLength(skeletonA, skeletonB) / maxLen;
}
```

- [ ] **Step 3: 实现释义 Jaccard 相似度**

在 `lib/confusion-similarity.ts` 中追加：

```ts
import { parseCardBack } from "./card-content";

const STOP_WORDS = new Set([
  "的", "了", "是", "在", "和", "与", "或", "等", "之", "为", "有", "被", "从", "到", "以", "及", "其", "这", "那",
]);

function extractMeaningKeywords(meaningText: string): string[] {
  const words = meaningText
    .split(/[,;，；/|·\s]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
  return words.slice(0, 5);
}

export function meaningJaccardSimilarity(
  aBack: string,
  bBack: string,
): number {
  const wordsA = extractMeaningKeywords(
    parseCardBack(aBack).meanings.join(" "),
  );
  const wordsB = extractMeaningKeywords(
    parseCardBack(bBack).meanings.join(" "),
  );
  const intersection = wordsA.filter((w) => wordsB.includes(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  return union === 0 ? 0 : intersection / union;
}
```

- [ ] **Step 4: 实现综合多维度相似度入口函数**

在 `lib/confusion-similarity.ts` 中追加：

```ts
import type { Card } from "./types";

export interface SimilarityBreakdown {
  spelling: number;
  phonetic: number;
  meaning: number;
  total: number;
  isConfusionCandidate: boolean;
}

export function calculateMultiDimensionalSimilarity(
  a: Card,
  b: Card,
): SimilarityBreakdown {
  const spelling = levenshteinSimilarity(a.front, b.front);
  const phonetic = phoneticSkeletonSimilarity(a.phonetic, b.phonetic);
  const meaning = meaningJaccardSimilarity(a.back, b.back);
  const total = spelling * 0.5 + phonetic * 0.3 + meaning * 0.2;

  const dimensionsAboveThreshold = [
    spelling > 0.5,
    phonetic > 0.5,
    meaning > 0.5,
  ].filter(Boolean).length;

  return {
    spelling,
    phonetic,
    meaning,
    total,
    isConfusionCandidate: total >= 0.65 && dimensionsAboveThreshold >= 2,
  };
}
```

- [ ] **Step 5: 删除 `lib/data-service.ts` 中旧的 `calculateSimilarity` 函数**

删除 `lib/data-service.ts` 第 2052-2064 行的旧函数：

```ts
function calculateSimilarity(a: string, b: string): number {
  const left = a.toLowerCase();
  const right = b.toLowerCase();
  const maxLength = Math.max(left.length, right.length);
  if (maxLength === 0) {
    return 1;
  }
  const matches = [...left].filter((char, index) => char === (right[index] ?? "")).length;
  return matches / maxLength;
}
```

- [ ] **Step 6: 更新 `lib/data-service.ts` 中引用旧算法的地方**

找到 `createManualConfusionGroup` 函数中调用 `calculateSimilarity` 的地方（大约在 1928 行），替换为：

```ts
import { calculateMultiDimensionalSimilarity } from "./confusion-similarity";

// 在 createManualConfusionGroup 的 mock 路径中：
const similarityScore = calculateMultiDimensionalSimilarity(
  sourceCard,
  card,
).total;
```

- [ ] **Step 7: 运行类型检查**

Run: `npm run build:prod`
Expected: 编译成功，0 errors, 0 warnings

---

## Task 2: 自动检测 orchestration — `lib/auto-confusion-detector.ts`

**Files:**
- Create: `lib/auto-confusion-detector.ts`
- Modify: `lib/types.ts`
- Modify: `lib/data-service.ts`

- [ ] **Step 1: 在 `lib/types.ts` 中新增接口**

```ts
export interface CreateAutoConfusionGroupsInput {
  groups: {
    sourceCardId: string;
    targetCardIds: string[];
  }[];
}

export interface CreateAutoConfusionGroupsResult {
  createdCount: number;
}
```

- [ ] **Step 2: 在 `lib/data-service.ts` 中新增 API 函数**

```ts
import type {
  CreateAutoConfusionGroupsInput,
  CreateAutoConfusionGroupsResult,
} from "./types";

export async function createAutoConfusionGroups(
  groups: CreateAutoConfusionGroupsInput["groups"],
): Promise<CreateAutoConfusionGroupsResult> {
  const runtime = getServiceRuntimeInfo();

  if (runtime.mode === "mock") {
    // Mock path: 逐个调用 createManualConfusionGroup
    let createdCount = 0;
    for (const group of groups) {
      if (group.targetCardIds.length > 0) {
        await createManualConfusionGroup(
          group.sourceCardId,
          group.targetCardIds,
        );
        createdCount++;
      }
    }
    return { createdCount };
  }

  const result = await callCloudBaseOrThrow<CreateAutoConfusionGroupsResult>(
    "createAutoConfusionGroups",
    { groups },
  );

  return result;
}
```

- [ ] **Step 3: 创建 `lib/auto-confusion-detector.ts`**

```ts
import { getAllCards } from "./data-service";
import { calculateMultiDimensionalSimilarity } from "./confusion-similarity";
import { createAutoConfusionGroups } from "./data-service";
import type { Card } from "./types";

export interface AutoDetectResult {
  createdCount: number;
}

export async function autoDetectConfusions(
  newCards: Card[],
): Promise<AutoDetectResult> {
  if (newCards.length === 0) {
    return { createdCount: 0 };
  }

  const allCards = await getAllCards();
  const candidates: { sourceCardId: string; targetCardIds: string[] }[] = [];

  for (const newCard of newCards) {
    const scores = allCards
      .filter(
        (c) =>
          c.id !== newCard.id && c.deckId === newCard.deckId,
      )
      .map((c) => ({
        cardId: c.id,
        breakdown: calculateMultiDimensionalSimilarity(newCard, c),
      }))
      .filter((s) => s.breakdown.isConfusionCandidate)
      .sort((a, b) => b.breakdown.total - a.breakdown.total)
      .slice(0, 3);

    if (scores.length > 0) {
      candidates.push({
        sourceCardId: newCard.id,
        targetCardIds: scores.map((s) => s.cardId),
      });
    }
  }

  if (candidates.length === 0) {
    return { createdCount: 0 };
  }

  const result = await createAutoConfusionGroups(candidates);
  return result;
}
```

- [ ] **Step 4: 运行类型检查**

Run: `npm run build:prod`
Expected: 编译成功

---

## Task 3: 学习完成页集成 — `app/study/done/page.tsx`

**Files:**
- Modify: `app/study/done/page.tsx`

- [ ] **Step 1: 读取当前 `app/study/done/page.tsx` 内容**

- [ ] **Step 2: 新增 imports**

```ts
import { useEffect, useState } from "react";
import { autoDetectConfusions } from "@/lib/auto-confusion-detector";
import { Sparkles } from "lucide-react";
```

- [ ] **Step 3: 在页面组件内新增检测状态**

```ts
const [detectStatus, setDetectStatus] = useState<
  "idle" | "detecting" | "found" | "none" | "error"
>("idle");
const [foundCount, setFoundCount] = useState(0);
```

- [ ] **Step 4: 新增 useEffect，在加载时触发检测**

```ts
useEffect(() => {
  if (!sessionId || !summary) return;

  // 只检测包含新词的 session
  if ((summary.newCount ?? 0) <= 0) return;

  setDetectStatus("detecting");

  void (async () => {
    try {
      // 获取 session 详情以拿到新卡片列表
      const session = await getStudySession(sessionId);
      const newCards =
        session?.cards.filter((c) => c.queue === "new") ?? [];

      if (newCards.length === 0) {
        setDetectStatus("none");
        return;
      }

      const result = await autoDetectConfusions(newCards);

      if (result.createdCount > 0) {
        setFoundCount(result.createdCount);
        setDetectStatus("found");
      } else {
        setDetectStatus("none");
      }
    } catch {
      setDetectStatus("error");
    }
  })();
}, [sessionId, summary]);
```

- [ ] **Step 5: 在页面底部新增检测状态 UI**

在返回 JSX 的适当位置（通常在成绩统计卡片下方）插入：

```tsx
{detectStatus === "detecting" && (
  <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
    <Sparkles size={14} className="animate-pulse text-primary" />
    正在检测易混词...
  </div>
)}

{detectStatus === "found" && (
  <div className="flex items-center gap-2 rounded-2xl bg-primary/10 px-4 py-3 text-sm text-primary">
    <Sparkles size={14} />
    发现 {foundCount} 组易混词，已添加到自动发现
  </div>
)}
```

- [ ] **Step 6: 运行类型检查**

Run: `npm run build:prod`
Expected: 编译成功

---

## Task 4: 构建与部署

- [ ] **Step 1: 生产构建**

Run: `npm run build:prod`
Expected: Compiled successfully, 0 errors, 0 warnings

- [ ] **Step 2: 验证静态导出**

Run: `npm run verify:export`
Expected: Verified exported pages

- [ ] **Step 3: 部署到 CloudBase**

Run: `tcb hosting deploy out -e yingyujiyi-0g70wt6z061f0bc4`
Expected: 部署完成

---

## Self-Review Checklist

1. **Spec coverage:**
   - [x] 多维度相似度算法（拼写 50% + 音标 30% + 释义 20%）→ Task 1
   - [x] 自动检测触发时机（Study Done 页面）→ Task 3
   - [x] 检测范围限制（同牌组、新词、最多 3 目标）→ Task 2
   - [x] 后端 API 设计（createAutoConfusionGroups）→ Task 2
   - [x] 用户感知（检测中/发现/失败）→ Task 3

2. **Placeholder scan:** 无 TBD/TODO

3. **Type consistency:**
   - `calculateMultiDimensionalSimilarity` 返回 `SimilarityBreakdown`
   - `autoDetectConfusions` 接收 `Card[]`，返回 `{ createdCount: number }`
   - `createAutoConfusionGroups` 接收 `{ sourceCardId, targetCardIds }[]`
