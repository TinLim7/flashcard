# 自动易混词检测升级设计文档

## 1. 背景与目标

当前易混词自动发现存在两个问题：
1. **算法单一**：仅使用逐字符位置匹配（positional character matching），无法识别 `thrashing/threshing` 这类中间字母差异，也忽略音标和释义的相似性
2. **缺乏动态感知**：不会在学习新词后自动检测其与已学词汇的易混关系

本设计升级为**多维度相似度算法**，并在**学习完成时自动触发检测**。

## 2. 方案概述（方案 B）

- **前端**：实现多维度相似度计算（拼写 + 音标 + 释义），在学习完成页自动触发
- **后端**：新增 `createAutoConfusionGroups` CloudBase 云函数，批量保存自动发现的分组
- **数据**：自动发现的组标记 `source: "auto"`，与手动标记区分

## 3. 多维度相似度算法

### 3.1 算法入口

```ts
// lib/confusion-similarity.ts
export function calculateMultiDimensionalSimilarity(a: Card, b: Card): number;
```

### 3.2 拼写维度（权重 50%）

从逐字符位置匹配升级为 **Levenshtein 编辑距离归一化**：

```ts
function levenshteinSimilarity(a: string, b: string): number {
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase());
  const maxLength = Math.max(a.length, b.length);
  return maxLength === 0 ? 1 : 1 - distance / maxLength;
}
```

能正确识别：
- `thrashing` / `threshing` → 距离 2，相似度 ~0.78
- `gazing` / `grazing` → 距离 1，相似度 ~0.83

### 3.3 音标维度（权重 30%）

提取**辅音骨架**（consonant skeleton）进行对比：

```ts
function phoneticSkeletonSimilarity(a?: string, b?: string): number {
  if (!a || !b) return 0;
  
  const skeletonA = extractConsonants(a); // /ˈsɒləm/ → "slm"
  const skeletonB = extractConsonants(b); // /ˈsɒlɪd/ → "sld"
  
  return lcsSimilarity(skeletonA, skeletonB); // 最长公共子序列归一化
}
```

- 元音变化对发音影响较小（如 `solemn/solid`），辅音骨架能抓住核心发音结构
- 无音标的卡片此维度得 0，由其他维度补偿

### 3.4 释义维度（权重 20%）

提取释义关键词，计算 **Jaccard 系数**：

```ts
function meaningJaccardSimilarity(aBack: string, bBack: string): number {
  const wordsA = extractMeaningKeywords(parseCardBack(aBack).meanings.join(" "));
  const wordsB = extractMeaningKeywords(parseCardBack(bBack).meanings.join(" "));
  
  const intersection = wordsA.filter(w => wordsB.includes(w)).length;
  const union = new Set([...wordsA, ...wordsB]).size;
  
  return union === 0 ? 0 : intersection / union;
}
```

- 过滤停用词（的、了、是、在等）
- 只取前 5 个核心实词，避免长释义稀释相似度

### 3.5 综合评分与阈值

```ts
const totalScore = spelling * 0.5 + phonetic * 0.3 + meaning * 0.2;

// 认定为易混候选的条件：
// 1. 总分 >= 0.65
// 2. 至少两个维度 > 0.5（避免单一维度极端值拉高总分）
```

## 4. 自动检测触发流程

### 4.1 触发时机

在学习完成页面（`/study/done`）加载时自动触发：

```
Study Done Page Load
  → 读取 sessionId from URL
  → getStudyCompletion(sessionId)
  → 若 session 包含 new 卡片：
      → 调用 autoDetectConfusions(newCards)
  → 无论是否发现，均静默完成（不阻塞页面）
```

### 4.2 检测流程

```ts
async function autoDetectConfusions(newCards: Card[]): Promise<number> {
  const allCards = await getAllCards();
  const candidates: { sourceCardId: string; targetCardIds: string[] }[] = [];

  for (const newCard of newCards) {
    const scores = allCards
      .filter(c => c.id !== newCard.id && c.deckId === newCard.deckId) // 同牌组内检测
      .map(c => ({
        cardId: c.id,
        score: calculateMultiDimensionalSimilarity(newCard, c),
      }))
      .filter(s => s.score >= 0.65)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3); // 每个新词最多保留前 3 个

    if (scores.length > 0) {
      candidates.push({
        sourceCardId: newCard.id,
        targetCardIds: scores.map(s => s.cardId),
      });
    }
  }

  if (candidates.length === 0) return 0;

  const result = await createAutoConfusionGroups(candidates);
  return result.createdCount;
}
```

### 4.3 范围限制

- **只检测同牌组内卡片**：跨牌组检测会产生过多无关结果（如考研词和日语旅游词不可能混淆）
- **只检测新卡片**：避免每次复习都重复计算
- **每个新词最多 3 个目标**：防止一个热门词产生 20+ 易混项

## 5. 后端 API 设计

### 5.1 新增接口

```ts
// lib/types.ts
export interface CreateAutoConfusionGroupsInput {
  groups: {
    sourceCardId: string;
    targetCardIds: string[];
  }[];
}

export interface CreateAutoConfusionGroupsResult {
  createdCount: number;
}

// lib/data-service.ts
export async function createAutoConfusionGroups(
  groups: CreateAutoConfusionGroupsInput["groups"],
): Promise<CreateAutoConfusionGroupsResult>;
```

### 5.2 CloudBase 云函数

- **Action**: `createAutoConfusionGroups`
- **Payload**: `{ groups: [{ sourceCardId, targetCardIds }] }`
- **行为**:
  1. 遍历每个 group
  2. 查询 sourceCard 和 targetCards 的完整数据
  3. 计算相似度（可复用前端算法或简单赋值 0.8）
  4. 写入 `confusion_groups` 集合：
     - `cardId`: sourceCardId
     - `front/back/deckName`: sourceCard 的数据
     - `source`: `"auto"`
     - `lowRatingCount`: 0
     - `lastReviewedAt`: null
     - `confusions`: ConfusionCandidate[]
  5. 返回 `{ createdCount: number }`

### 5.3 幂等性

- 若同一 sourceCardId 已存在自动分组，**追加**新的 targetCards（去重）
- 不删除旧数据，只增量更新

## 6. 前端集成点

### 6.1 新增文件

| 文件 | 说明 |
|------|------|
| `lib/confusion-similarity.ts` | 多维度相似度算法（Levenshtein、辅音骨架、Jaccard） |
| `lib/auto-confusion-detector.ts` | 自动检测 orchestration（读取 session、计算、调用 API） |

### 6.2 修改文件

| 文件 | 修改内容 |
|------|---------|
| `lib/data-service.ts` | 新增 `createAutoConfusionGroups` |
| `lib/types.ts` | 新增 `CreateAutoConfusionGroupsInput/Result` |
| `app/study/done/page.tsx` | 加载时调用 `autoDetectConfusions`，显示轻量 toast |

### 6.3 用户感知

- **检测中**：Study Done 页面底部出现一行灰色小字"正在检测易混词..."
- **发现结果**：检测完成后 toast 提示"发现 3 组易混词，已添加到自动发现"
- **未发现**：无任何提示，避免打扰
- **失败**：静默失败，不阻塞页面，console 输出 error

## 7. 验证方式

1. 学习一个包含新词的 session
2. 进入 Study Done 页面，观察底部检测提示
3. 切换到 `/confusions` 自动发现 tab，查看是否出现新分组
4. 检查分组内的相似度 badge 是否合理

## 8. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `lib/confusion-similarity.ts` | **新建** | 多维度相似度算法 |
| `lib/auto-confusion-detector.ts` | **新建** | 自动检测 orchestration |
| `lib/types.ts` | 修改 | 新增 CreateAutoConfusionGroupsInput/Result |
| `lib/data-service.ts` | 修改 | 新增 createAutoConfusionGroups API |
| `app/study/done/page.tsx` | 修改 | 加载时触发自动检测 |
| CloudBase 后端 | 新增 | createAutoConfusionGroups 云函数 |
