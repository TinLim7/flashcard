import type {
  Card,
  ConfusionGroup,
  Deck,
  HomeStats,
  QueueKind,
  SessionCard,
  StudyCompletionSummary,
} from "@/lib/types";

export const homeStats: HomeStats = {
  reviews: 42,
  newCards: 0,
  completed: 18,
  total: 60,
  streak: 12,
  estMinutes: 12,
  todayNewLimit: 25,
  todayNewIntroduced: 25,
  todayReviewedCount: 18,
};

export const decks: Deck[] = [
  {
    id: "deck-core-5500",
    name: "考研英语核心 5500 词",
    description: "高频核心词，覆盖阅读、写作和完形常见场景。",
    dueCount: 28,
    newCount: 15,
    totalCount: 5500,
    lastStudiedLabel: "2 小时前",
    tags: ["考研", "高频", "核心词"],
  },
  {
    id: "deck-speaking",
    name: "日常英语口语高频句",
    description: "以表达块为主，适合碎片时间跟读记忆。",
    dueCount: 14,
    newCount: 0,
    totalCount: 300,
    lastStudiedLabel: "昨天",
    tags: ["口语", "表达", "跟读"],
  },
  {
    id: "deck-frontend",
    name: "前端开发专业术语",
    description: "面向技术阅读和面试表达的专业词汇卡片。",
    dueCount: 0,
    newCount: 5,
    totalCount: 120,
    lastStudiedLabel: "3 天前",
    tags: ["技术", "阅读", "面试"],
  },
  {
    id: "deck-travel",
    name: "日本旅游实用会话",
    description: "机场、交通、餐厅和问路的常用表达。",
    dueCount: 0,
    newCount: 0,
    totalCount: 50,
    lastStudiedLabel: "从未学习",
    tags: ["旅行", "会话"],
  },
];

export const cards: Card[] = [
  {
    id: "card-ubiquitous",
    deckId: "deck-core-5500",
    front: "ubiquitous",
    phonetic: "/juːˈbɪkwɪtəs/",
    back: "adj. 普遍存在的；无处不在的",
    example: "Coffee shops are ubiquitous in the city.",
  },
  {
    id: "card-ephemeral",
    deckId: "deck-core-5500",
    front: "ephemeral",
    phonetic: "/ɪˈfemərəl/",
    back: "adj. 短暂的；转瞬即逝的",
    example: "Fame in pop culture can be remarkably ephemeral.",
  },
  {
    id: "card-serendipity",
    deckId: "deck-core-5500",
    front: "serendipity",
    phonetic: "/ˌserənˈdɪpəti/",
    back: "n. 机缘巧合；意外发现珍奇事物的能力",
    example: "Their reunion felt like pure serendipity.",
  },
  {
    id: "card-cut-to-the-chase",
    deckId: "deck-speaking",
    front: "cut to the chase",
    back: "v. 直奔主题；别绕圈子",
    example: "Let's cut to the chase and decide the budget.",
  },
  {
    id: "card-touch-base",
    deckId: "deck-speaking",
    front: "touch base",
    back: "v. 简短沟通一下；同步进展",
    example: "I'll touch base with you after the meeting.",
  },
  {
    id: "card-hydration",
    deckId: "deck-frontend",
    front: "hydration",
    back: "n. 前端渲染后的激活过程",
    example: "A hydration mismatch usually means server and client output differ.",
  },
  {
    id: "card-suspense",
    deckId: "deck-frontend",
    front: "Suspense",
    back: "n. React 用于协调异步 UI 的机制",
    example: "We wrapped the list in Suspense to show a fallback skeleton.",
  },
];

export const importSampleRows = [
  "ubiquitous,adj. 普遍存在的,Coffee shops are ubiquitous in the city.",
  "ephemeral,adj. 短暂的,Fame can be ephemeral.",
  "serendipity,n. 机缘巧合,Their reunion felt like serendipity.",
];

export const statsHighlights = [
  { label: "7 日复习量", value: "286 张", hint: "较上周 +12%" },
  { label: "正确率", value: "87%", hint: "困难卡集中在核心词库" },
  { label: "平均学习时长", value: "11 分钟", hint: "本周共 6 次学习" },
];

export const weeklyActivity = [
  { day: "一", count: 28 },
  { day: "二", count: 42 },
  { day: "三", count: 36 },
  { day: "四", count: 31 },
  { day: "五", count: 55 },
  { day: "六", count: 44 },
  { day: "日", count: 50 },
];

export const confusionGroups: ConfusionGroup[] = [
  {
    cardId: "card-thrashing",
    front: "thrashing",
    back: "n. 猛烈抽打；痛打",
    deckName: "Animal Farm 例句词库",
    lowRatingCount: 15,
    lastReviewedAt: "2026-04-21T00:04:17.000Z",
    source: "auto",
    confusions: [
      {
        cardId: "card-threshing",
        front: "threshing",
        back: "n. 打谷；脱粒",
        deckName: "Animal Farm 例句词库",
        lowRatingCount: 10,
        lastReviewedAt: "2026-04-21T00:04:30.000Z",
        similarityScore: 0.96,
      },
      {
        cardId: "card-grazing",
        front: "grazing",
        back: "n. 吃草；放牧",
        deckName: "Animal Farm 例句词库",
        lowRatingCount: 7,
        lastReviewedAt: "2026-04-20T23:41:02.000Z",
        similarityScore: 0.58,
      },
    ],
  },
  {
    cardId: "card-gazing",
    front: "gazing",
    back: "v. 凝视；注视",
    deckName: "Animal Farm 例句词库",
    lowRatingCount: 8,
    lastReviewedAt: "2026-04-20T23:40:32.000Z",
    source: "auto",
    confusions: [
      {
        cardId: "card-grazing",
        front: "grazing",
        back: "n. 吃草；放牧",
        deckName: "Animal Farm 例句词库",
        lowRatingCount: 7,
        lastReviewedAt: "2026-04-20T23:41:02.000Z",
        similarityScore: 0.88,
      },
    ],
  },
];

export const settingsSections = [
  { id: "daily-new", label: "每日新卡上限", value: "25 张", hint: "仅影响新词配额，不影响复习队列" },
  { id: "theme", label: "主题模式", value: "跟随系统", hint: "支持明暗主题可读性预览" },
];

export function getRecentDecks() {
  return decks.slice(0, 3);
}

export function getDeckById(deckId: string) {
  return decks.find((deck) => deck.id === deckId) ?? null;
}

export function getCardsByDeckId(deckId: string) {
  return cards.filter((card) => card.deckId === deckId);
}

export function buildStudyQueue(selectedDeckIds: string[] = []) {
  const sourceDeckIds = selectedDeckIds.length > 0 ? selectedDeckIds : decks.slice(0, 3).map((deck) => deck.id);
  const selectedCards = cards
    .filter((card) => sourceDeckIds.includes(card.deckId))
    .slice(0, 5);

  return selectedCards.map<SessionCard>((card, index) => {
    const queue: QueueKind = index < 3 ? "review" : "new";

    return {
      ...card,
      queue,
      position: index + 1,
    };
  });
}

export function getStudyCompletionSummary(
  sessionId: string,
  completedCount: number,
  queueCounts: { review: number; new: number },
  totalCount: number,
): StudyCompletionSummary {
  return {
    sessionId,
    sessionMode: "formal",
    completedCount,
    reviewCount: queueCounts.review,
    newCount: queueCounts.new,
    remainingCount: Math.max(totalCount - completedCount, 0),
  };
}

export const ratingCopy: Record<string, string> = {
  "1": "10 分钟后",
  "2": "10 分钟后",
  "3": "明天",
  "4": "2 天后",
};
